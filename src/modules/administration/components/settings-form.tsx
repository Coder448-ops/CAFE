"use client";

import * as React from "react";
import { useApi } from "@/shared/hooks/useApi";
import { apiFetch, errorMessage } from "@/modules/shared/api";
import { useToast } from "@/shared/components/ui/toast";
import { Button } from "@/shared/components/ui/button";
import { Field, Input, Textarea } from "@/shared/components/ui/field";
import { ErrorState, Skeleton } from "@/shared/components/ui/empty-state";
import type { AppSettings } from "@/shared/types/domain";

export function SettingsForm() {
  const toast = useToast();
  const settingsApi = useApi<{ settings: AppSettings }>("/api/staff/settings");
  const [form, setForm] = React.useState<AppSettings | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (settingsApi.data && !form) setForm(settingsApi.data.settings);
  }, [settingsApi.data, form]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setError(null);
    setSaving(true);
    try {
      await apiFetch("/api/staff/settings", {
        method: "PATCH",
        body: {
          restaurantName: form.restaurantName,
          address: form.address,
          phone: form.phone,
          receiptFooter: form.receiptFooter,
          serviceChargePercent: form.serviceChargePercent,
        },
      });
      toast.success("Sozlamalar saqlandi");
      await settingsApi.refresh({ silent: true });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-4 py-5 sm:px-6">
      <div className="mb-4">
        <h1 className="font-display text-2xl font-semibold text-coffee-900">Sozlamalar</h1>
        <p className="text-sm text-coffee-500">Restoran ma&apos;lumotlari chek va interfeysda ko&apos;rinadi</p>
      </div>

      {settingsApi.error ? (
        <ErrorState message={settingsApi.error} onRetry={() => void settingsApi.refresh()} />
      ) : null}
      {!form ? <Skeleton className="h-80" /> : null}

      {form ? (
        <form onSubmit={submit} className="surface max-w-2xl space-y-4 p-5">
          <Field label="Restoran nomi" htmlFor="set-name">
            <Input
              id="set-name"
              required
              value={form.restaurantName}
              onChange={(event) => setForm({ ...form, restaurantName: event.target.value })}
            />
          </Field>
          <Field label="Manzil" htmlFor="set-address">
            <Input
              id="set-address"
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
            />
          </Field>
          <Field label="Telefon" htmlFor="set-phone">
            <Input
              id="set-phone"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
          </Field>
          <Field label="Chek pastidagi matn" htmlFor="set-footer">
            <Textarea
              id="set-footer"
              value={form.receiptFooter}
              onChange={(event) => setForm({ ...form, receiptFooter: event.target.value })}
              className="min-h-16"
            />
          </Field>
          <Field
            label="Xizmat haqi (%)"
            htmlFor="set-service"
            hint="0 bo'lsa qo'shimcha haq olinmaydi. O'zgartirish faqat yangi buyurtmalarga ta'sir qiladi."
          >
            <Input
              id="set-service"
              type="number"
              min={0}
              max={30}
              value={form.serviceChargePercent}
              onChange={(event) =>
                setForm({ ...form, serviceChargePercent: Number(event.target.value) || 0 })
              }
            />
          </Field>
          <dl className="grid gap-2 rounded-xl bg-cream-100 p-3 text-xs text-coffee-500 sm:grid-cols-2">
            <div>
              <dt className="uppercase tracking-wide text-coffee-400">Valyuta</dt>
              <dd className="font-semibold text-coffee-800">{form.currency} (tiyin)</dd>
            </div>
            <div>
              <dt className="uppercase tracking-wide text-coffee-400">Vaqt zonasi</dt>
              <dd className="font-semibold text-coffee-800">{form.timezone}</dd>
            </div>
          </dl>

          {error ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <Button type="submit" loading={saving}>
            Saqlash
          </Button>
        </form>
      ) : null}
    </div>
  );
}
