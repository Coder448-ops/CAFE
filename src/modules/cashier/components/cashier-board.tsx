"use client";

import * as React from "react";
import Link from "next/link";
import { useApi } from "@/shared/hooks/useApi";
import { useRealtime } from "@/shared/hooks/useRealtime";
import { apiFetch, errorMessage } from "@/modules/shared/api";
import { useToast } from "@/shared/components/ui/toast";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/field";
import { Modal } from "@/shared/components/ui/modal";
import { EmptyState, ErrorState, LoadingBlock, Skeleton } from "@/shared/components/ui/empty-state";
import { ConnectionBadge } from "@/shared/components/ui/connection-badge";
import { OrderStatusBadge, PaymentStatusBadge } from "@/shared/components/ui/status-badge";
import { formatUzs } from "@/shared/lib/money";
import { formatDuration, formatTime, minutesSince } from "@/shared/lib/datetime";
import { ORDER_STATUS_LABELS } from "@/shared/constants/orders";
import type { Order, OrderStatus } from "@/shared/types/domain";
import { PaymentPanel } from "@/modules/cashier/components/payment-panel";

type Filter = "active" | "new" | "unpaid" | "all";
const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "active", label: "Faol" },
  { value: "new", label: "Yangi" },
  { value: "unpaid", label: "To'lanmagan" },
  { value: "all", label: "Barchasi" },
];

const NEXT_ACTIONS: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  new: { status: "accepted", label: "Qabul qilish" },
  accepted: { status: "preparing", label: "Tayyorlashga" },
  preparing: { status: "ready", label: "Tayyor" },
  ready: { status: "served", label: "Berildi" },
  served: { status: "completed", label: "Yakunlash" },
};

export function CashierBoard() {
  const toast = useToast();
  const [filter, setFilter] = React.useState<Filter>("active");
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [cancelTarget, setCancelTarget] = React.useState<Order | null>(null);
  const [cancelReason, setCancelReason] = React.useState("");
  const [refundTarget, setRefundTarget] = React.useState<{ order: Order; paymentId: number } | null>(null);
  const [refundAmount, setRefundAmount] = React.useState("");
  const [refundReason, setRefundReason] = React.useState("");

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const query = new URLSearchParams();
  query.set("status", filter === "unpaid" ? "active" : filter);
  if (filter === "unpaid") query.set("paymentStatus", "unpaid");
  if (debouncedSearch) query.set("q", debouncedSearch);
  const ordersApi = useApi<{ orders: Order[] }>(`/api/staff/orders?${query.toString()}`, { pollMs: 30_000 });

  const { state: connectionState } = useRealtime((event) => {
    void ordersApi.refresh({ silent: true });
    if (event.type === "table.bill_requested") {
      const label = (event.payload as { tableLabel?: string }).tableLabel;
      toast.push(`${label ?? "Stol"} hisobni so'ramoqda`, "info");
    }
  });

  const orders = React.useMemo(() => ordersApi.data?.orders ?? [], [ordersApi.data]);
  React.useEffect(() => {
    if (selectedId && !orders.some((order) => order.id === selectedId)) {
      setSelectedId(orders[0]?.id ?? null);
    }
    if (!selectedId && orders.length > 0) setSelectedId(orders[0]!.id);
  }, [orders, selectedId]);

  const selected = orders.find((order) => order.id === selectedId) ?? null;

  function replaceOrder(updated: Order) {
    ordersApi.setData((current) =>
      current ? { orders: current.orders.map((order) => (order.id === updated.id ? updated : order)) } : current,
    );
    void ordersApi.refresh({ silent: true });
  }

  async function changeStatus(order: Order, status: OrderStatus, reason?: string) {
    setBusy(true);
    try {
      const result = await apiFetch<{ order: Order }>(`/api/staff/orders/${order.id}/status`, {
        method: "POST",
        body: { status, reason },
      });
      replaceOrder(result.order);
      toast.success(`#${order.orderNumber}: ${ORDER_STATUS_LABELS[status]}`);
      setCancelTarget(null);
      setCancelReason("");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function submitRefund() {
    if (!refundTarget) return;
    const amount = Number(refundAmount.replace(/[^\d]/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Qaytarish summasini kiriting");
      return;
    }
    setBusy(true);
    try {
      const result = await apiFetch<{ order: Order }>(
        `/api/staff/orders/${refundTarget.order.id}/payments`,
        {
          method: "PATCH",
          body: {
            paymentId: refundTarget.paymentId,
            amountTiyin: amount * 100,
            reason: refundReason || "Mijoz iltimosiga ko'ra",
          },
        },
      );
      replaceOrder(result.order);
      toast.success("Qaytarish qayd etildi");
      setRefundTarget(null);
      setRefundAmount("");
      setRefundReason("");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 py-5 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-coffee-900">Kassir terminali</h1>
          <p className="text-sm text-coffee-500">Buyurtmalar real vaqtda yangilanadi</p>
        </div>
        <div className="flex items-center gap-2">
          <ConnectionBadge state={connectionState} />
          <Button variant="outline" size="sm" onClick={() => void ordersApi.refresh()}>
            Yangilash
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(320px,420px),1fr]">
        <section aria-label="Buyurtmalar ro'yxati" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl bg-cream-200/70 p-1" role="tablist" aria-label="Filtr">
              {FILTERS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="tab"
                  aria-selected={filter === option.value}
                  onClick={() => setFilter(option.value)}
                  className={
                    filter === option.value
                      ? "rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-coffee-900 shadow-sm"
                      : "rounded-lg px-3 py-1.5 text-xs font-semibold text-coffee-500 hover:text-coffee-800"
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="№ yoki stol bo'yicha qidirish"
              aria-label="Buyurtma qidirish"
              className="h-9 flex-1 text-sm"
            />
          </div>

          {ordersApi.error ? <ErrorState message={ordersApi.error} onRetry={() => void ordersApi.refresh()} /> : null}
          {ordersApi.loading && !ordersApi.data ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-24" />
              ))}
            </div>
          ) : null}
          {!ordersApi.loading && orders.length === 0 ? (
            <EmptyState
              title="Buyurtma topilmadi"
              description="Mijoz buyurtma yuborsa, bu yerda avtomatik paydo bo'ladi."
              icon="🧾"
            />
          ) : null}

          <ul className="space-y-2">
            {orders.map((order) => {
              const waiting = formatDuration(minutesSince(order.createdAt));
              return (
                <li key={order.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(order.id)}
                    aria-current={selectedId === order.id ? "true" : undefined}
                    className={`w-full rounded-xl border px-3.5 py-3 text-left transition ${
                      selectedId === order.id
                        ? "border-moss-400 bg-moss-50/60 shadow-card"
                        : "border-coffee-100 bg-cream-50 hover:border-coffee-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-display text-base font-semibold text-coffee-900">
                          #{order.orderNumber} · {order.tableLabel}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-coffee-500">
                          {order.items.length} ta pozitsiya · {waiting}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-coffee-900">{formatUzs(order.totalTiyin)}</p>
                        <p className="text-[11px] text-coffee-400">{formatTime(order.createdAt)}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <OrderStatusBadge status={order.status} />
                      <PaymentStatusBadge status={order.paymentStatus} />
                      {order.note ? <Badge tone="muted">Izoh</Badge> : null}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-label="Buyurtma tafsiloti" className="min-w-0">
          {!selected ? (
            <EmptyState
              title="Buyurtmani tanlang"
              description="Chapdagi ro'yxatdan buyurtma tanlab, holatini boshqaring va to'lovni qayd eting."
              icon="☕"
              className="h-full"
            />
          ) : (
            <div className="surface overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-coffee-100 p-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-xl font-semibold text-coffee-900">
                      Buyurtma #{selected.orderNumber}
                    </h2>
                    <OrderStatusBadge status={selected.status} />
                    <PaymentStatusBadge status={selected.paymentStatus} />
                  </div>
                  <p className="mt-1 text-sm text-coffee-500">
                    {selected.tableLabel} ({selected.tableCode}) · {formatTime(selected.createdAt)} ·{" "}
                    {formatDuration(minutesSince(selected.createdAt))} oldin
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {NEXT_ACTIONS[selected.status] ? (
                    <Button
                      size="sm"
                      loading={busy}
                      onClick={() => void changeStatus(selected, NEXT_ACTIONS[selected.status]!.status)}
                    >
                      {NEXT_ACTIONS[selected.status]!.label}
                    </Button>
                  ) : null}
                  <Link href={`/cashier/orders/${selected.id}/receipt`} target="_blank">
                    <Button variant="outline" size="sm">
                      Chek
                    </Button>
                  </Link>
                  {selected.status !== "cancelled" && selected.status !== "completed" ? (
                    <Button variant="ghost" size="sm" onClick={() => setCancelTarget(selected)}>
                      Bekor qilish
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-5 p-5 lg:grid-cols-[1.4fr,1fr]">
                <div>
                  {selected.note ? (
                    <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Mijoz izohi: «{selected.note}»
                    </p>
                  ) : null}
                  <ul className="space-y-2">
                    {selected.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-start justify-between gap-3 rounded-lg bg-cream-100/70 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-coffee-900">
                            {item.quantity} × {item.productName}
                          </p>
                          {item.options.length > 0 ? (
                            <p className="text-xs text-coffee-500">
                              {item.options.map((option) => option.optionName).join(" · ")}
                            </p>
                          ) : null}
                          {item.note ? <p className="text-xs italic text-coffee-400">{item.note}</p> : null}
                        </div>
                        <p className="shrink-0 text-sm text-coffee-700">{formatUzs(item.lineTotalTiyin)}</p>
                      </li>
                    ))}
                  </ul>

                  <dl className="mt-4 space-y-1.5 border-t border-coffee-100 pt-3 text-sm">
                    <div className="flex justify-between text-coffee-600">
                      <dt>Taomlar</dt>
                      <dd>{formatUzs(selected.subtotalTiyin)}</dd>
                    </div>
                    <div className="flex justify-between font-semibold text-coffee-900">
                      <dt>Jami</dt>
                      <dd>{formatUzs(selected.totalTiyin)}</dd>
                    </div>
                    <div className="flex justify-between text-moss-700">
                      <dt>To&apos;langan</dt>
                      <dd>{formatUzs(selected.paidTiyin)}</dd>
                    </div>
                    <div className="flex justify-between text-terracotta-600">
                      <dt>Qarz</dt>
                      <dd>{formatUzs(selected.dueTiyin)}</dd>
                    </div>
                  </dl>

                  {selected.payments.length > 0 ? (
                    <div className="mt-4">
                      <p className="label-base">To&apos;lovlar</p>
                      <ul className="space-y-1.5 text-xs text-coffee-600">
                        {selected.payments.map((payment) => (
                          <li
                            key={payment.id}
                            className="flex items-center justify-between gap-2 rounded-lg bg-cream-100/70 px-3 py-2"
                          >
                            <span>
                              {formatUzs(payment.amountTiyin)} ·{" "}
                              {payment.method === "cash" ? "Naqd" : payment.method === "card_manual" ? "Karta" : "Boshqa"}{" "}
                              · {formatTime(payment.createdAt)}
                            </span>
                            <button
                              type="button"
                              onClick={() => setRefundTarget({ order: selected, paymentId: payment.id })}
                              className="font-semibold text-coffee-500 underline hover:text-red-600"
                            >
                              Qaytarish
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-xl border border-coffee-100 bg-white p-4">
                  <h3 className="mb-3 font-display text-base font-semibold text-coffee-900">To&apos;lov</h3>
                  {selected.status === "cancelled" ? (
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                      Buyurtma bekor qilingan. To&apos;lov qabul qilinmaydi.
                    </p>
                  ) : (
                    <PaymentPanel order={selected} onPaid={replaceOrder} />
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      <Modal
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title={`Buyurtma #${cancelTarget?.orderNumber ?? ""} ni bekor qilish`}
        description="Bekor qilish sababi audit jurnaliga yoziladi."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelTarget(null)} disabled={busy}>
              Yopish
            </Button>
            <Button
              variant="danger"
              loading={busy}
              disabled={cancelReason.trim().length < 2}
              onClick={() => cancelTarget && void changeStatus(cancelTarget, "cancelled", cancelReason.trim())}
            >
              Bekor qilish
            </Button>
          </>
        }
      >
        <Input
          value={cancelReason}
          onChange={(event) => setCancelReason(event.target.value)}
          placeholder="Sabab (masalan: mijoz voz kechdi)"
          maxLength={200}
          aria-label="Bekor qilish sababi"
        />
      </Modal>

      <Modal
        open={Boolean(refundTarget)}
        onClose={() => setRefundTarget(null)}
        title="To'lovni qaytarish"
        description="Qaytarish moliyaviy jurnalga alohida yozuv sifatida qo'shiladi."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRefundTarget(null)} disabled={busy}>
              Yopish
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void submitRefund()}>
              Qaytarishni tasdiqlash
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="label-base" htmlFor="refund-amount">
            Summa (so&apos;m)
          </label>
          <Input
            id="refund-amount"
            inputMode="numeric"
            value={refundAmount}
            onChange={(event) => setRefundAmount(event.target.value.replace(/[^\d]/g, ""))}
            placeholder="45000"
          />
          <label className="label-base" htmlFor="refund-reason">
            Sabab
          </label>
          <Input
            id="refund-reason"
            value={refundReason}
            onChange={(event) => setRefundReason(event.target.value)}
            placeholder="Masalan: buyurtma xato kiritilgan"
          />
        </div>
      </Modal>

      {busy ? <span className="sr-only" role="status">Amal bajarilmoqda</span> : null}
      {ordersApi.loading && ordersApi.data ? <LoadingBlock label="Yangilanmoqda..." /> : null}
    </div>
  );
}
