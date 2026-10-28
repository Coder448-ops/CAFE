"use client";

import * as React from "react";
import { Button } from "@/shared/components/ui/button";
import { Field, Input, Select } from "@/shared/components/ui/field";
import { useToast } from "@/shared/components/ui/toast";
import { apiFetch, errorMessage } from "@/modules/shared/api";
import { formatUzs, parseSomInput } from "@/shared/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/shared/constants/orders";
import { newRequestId } from "@/shared/lib/requestId";
import type { Order } from "@/shared/types/domain";

type PaymentMethod = "cash" | "card_manual" | "other";

export function PaymentPanel({
  order,
  onPaid,
}: {
  order: Order;
  onPaid: (order: Order) => void;
}) {
  const toast = useToast();
  const [method, setMethod] = React.useState<PaymentMethod>("cash");
  const [amountInput, setAmountInput] = React.useState("");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const requestIdRef = React.useRef(newRequestId());

  React.useEffect(() => {
    setAmountInput(order.dueTiyin > 0 ? String(Math.round(order.dueTiyin / 100)) : "");
    setError(null);
    requestIdRef.current = newRequestId();
  }, [order.id, order.dueTiyin]);

  if (order.paymentStatus === "paid") {
    return (
      <div className="rounded-xl bg-moss-50 p-4 text-sm text-moss-700 ring-1 ring-moss-100">
        <p className="font-semibold">To&apos;liq to&apos;langan</p>
        <p className="mt-1 text-xs">
          {order.payments.length} ta to&apos;lov qayd etilgan · {formatUzs(order.paidTiyin)}
        </p>
      </div>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = parseSomInput(amountInput);
    if (parsed === null || parsed <= 0) {
      setError("Summani to'g'ri kiriting (masalan: 45000)");
      return;
    }
    if (parsed > order.dueTiyin) {
      setError(`Summa qarzdan (${formatUzs(order.dueTiyin)}) katta bo'lishi mumkin emas`);
      return;
    }
    setSubmitting(true);
    try {
      const result = await apiFetch<{ order: Order; duplicate: boolean }>(
        `/api/staff/orders/${order.id}/payments`,
        {
          method: "POST",
          body: {
            method,
            amountTiyin: parsed,
            note: note || undefined,
            clientRequestId: requestIdRef.current,
          },
        },
      );
      onPaid(result.order);
      toast.success(result.duplicate ? "Bu to'lov avval qayd etilgan" : "To'lov qayd etildi");
      requestIdRef.current = newRequestId();
      setNote("");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex items-center justify-between rounded-xl bg-cream-100 px-3.5 py-2.5 text-sm">
        <span className="text-coffee-500">Qolgan qarz</span>
        <span className="font-display text-lg font-semibold text-terracotta-600">{formatUzs(order.dueTiyin)}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="To'lov usuli" htmlFor="payment-method">
          <Select
            id="payment-method"
            value={method}
            onChange={(event) => setMethod(event.target.value as PaymentMethod)}
          >
            {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Summa (so'm)" htmlFor="payment-amount">
          <Input
            id="payment-amount"
            inputMode="numeric"
            value={amountInput}
            onChange={(event) => setAmountInput(event.target.value.replace(/[^\d\s.,]/g, ""))}
            placeholder="45000"
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setAmountInput(String(Math.round(order.dueTiyin / 100)))}
          className="rounded-full bg-cream-200 px-3 py-1 text-xs font-semibold text-coffee-700 hover:bg-cream-300"
        >
          To&apos;liq summa
        </button>
        <button
          type="button"
          onClick={() => setAmountInput(String(Math.round(order.dueTiyin / 200)))}
          className="rounded-full bg-cream-200 px-3 py-1 text-xs font-semibold text-coffee-700 hover:bg-cream-300"
        >
          Yarim summa (bo&apos;lib to&apos;lash)
        </button>
      </div>

      <Field label="Izoh (ixtiyoriy)" htmlFor="payment-note">
        <Input
          id="payment-note"
          value={note}
          maxLength={200}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Masalan: terminal cheki №1234"
        />
      </Field>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {error}
        </p>
      ) : null}

      <Button type="submit" fullWidth loading={submitting}>
        To&apos;lovni qayd etish
      </Button>
      <p className="text-[11px] leading-relaxed text-coffee-400">
        Karta to&apos;lovi faqat jismoniy terminalda tasdiqlanganidan keyin qo&apos;lda kiritiladi. Tizimga
        to&apos;lov shlyuzi ulanmagan.
      </p>
    </form>
  );
}
