"use client";

import * as React from "react";
import { useApi } from "@/shared/hooks/useApi";
import { apiFetch, errorMessage } from "@/modules/shared/api";
import { useToast } from "@/shared/components/ui/toast";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Field, Input, Switch } from "@/shared/components/ui/field";
import { Modal } from "@/shared/components/ui/modal";
import { EmptyState, ErrorState, Skeleton } from "@/shared/components/ui/empty-state";
import { formatUzs } from "@/shared/lib/money";
import { formatDateTime, formatTime } from "@/shared/lib/datetime";
import type { RestaurantTable, TableDevice } from "@/shared/types/domain";

type TableDraft = {
  id: number | null;
  code: string;
  label: string;
  zone: string;
  seats: string;
  isActive: boolean;
};

export function TableAdmin() {
  const toast = useToast();
  const tablesApi = useApi<{ tables: RestaurantTable[] }>("/api/staff/tables");
  const [draft, setDraft] = React.useState<TableDraft | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pairing, setPairing] = React.useState<{ code: string; tableLabel: string } | null>(null);
  const [devicesFor, setDevicesFor] = React.useState<RestaurantTable | null>(null);
  const [devices, setDevices] = React.useState<TableDevice[] | null>(null);

  const tables = tablesApi.data?.tables ?? [];

  async function saveTable(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setFormError(null);
    setSaving(true);
    try {
      const body = {
        code: draft.code.toUpperCase(),
        label: draft.label,
        zone: draft.zone,
        seats: Number(draft.seats) || 1,
        isActive: draft.isActive,
      };
      if (draft.id) {
        await apiFetch(`/api/staff/tables/${draft.id}`, { method: "PATCH", body });
        toast.success("Stol saqlandi");
      } else {
        await apiFetch("/api/staff/tables", { method: "POST", body });
        toast.success("Stol qo'shildi");
      }
      setDraft(null);
      await tablesApi.refresh({ silent: true });
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function createPairingCode(table: RestaurantTable) {
    try {
      const result = await apiFetch<{ pairing: { code: string } }>(
        `/api/staff/tables/${table.id}/pairing-code`,
        { method: "POST" },
      );
      setPairing({ code: result.pairing.code, tableLabel: table.label });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function openDevices(table: RestaurantTable) {
    setDevicesFor(table);
    setDevices(null);
    try {
      const result = await apiFetch<{ devices: TableDevice[] }>(`/api/staff/tables/${table.id}/devices`);
      setDevices(result.devices);
    } catch (error) {
      toast.error(errorMessage(error));
      setDevices([]);
    }
  }

  async function revokeDevice(device: TableDevice) {
    try {
      await apiFetch(`/api/staff/devices/${device.id}`, { method: "DELETE" });
      toast.success("Qurilma bekor qilindi");
      if (devicesFor) await openDevices(devicesFor);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <div className="px-4 py-5 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-coffee-900">Stollar va qurilmalar</h1>
          <p className="text-sm text-coffee-500">Zonalar, sig&apos;im, ulash kodlari va biriktirilgan qurilmalar</p>
        </div>
        <Button
          onClick={() =>
            setDraft({
              id: null,
              code: `T${String(tables.length + 1).padStart(2, "0")}`,
              label: `${tables.length + 1}-stol`,
              zone: "Asosiy zal",
              seats: "4",
              isActive: true,
            })
          }
        >
          Stol qo&apos;shish
        </Button>
      </div>

      {tablesApi.error ? <ErrorState message={tablesApi.error} onRetry={() => void tablesApi.refresh()} /> : null}
      {tablesApi.loading && !tablesApi.data ? <Skeleton className="h-64" /> : null}
      {tablesApi.data && tables.length === 0 ? (
        <EmptyState title="Stollar yo'q" description="Birinchi stolni qo'shing." icon="🪑" />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tables.map((table) => (
          <article key={table.id} className="surface p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-semibold text-coffee-900">{table.label}</h2>
                <p className="text-xs text-coffee-400">
                  {table.code} · {table.zone} · {table.seats} o&apos;rin
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {table.isActive ? <Badge tone="success">Faol</Badge> : <Badge tone="muted">Nofaol</Badge>}
                {table.openSessionId ? <Badge tone="warning">Band</Badge> : null}
              </div>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-cream-100/70 p-2.5 text-xs">
              <div>
                <dt className="text-coffee-400">Sessiya</dt>
                <dd className="font-semibold text-coffee-800">
                  {table.sessionOpenedAt ? formatTime(table.sessionOpenedAt) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-coffee-400">Qarz</dt>
                <dd className="font-semibold text-terracotta-600">{formatUzs(table.unpaidTiyin)}</dd>
              </div>
            </dl>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setDraft({
                    id: table.id,
                    code: table.code,
                    label: table.label,
                    zone: table.zone,
                    seats: String(table.seats),
                    isActive: table.isActive,
                  })
                }
              >
                Tahrir
              </Button>
              <Button size="sm" variant="outline" onClick={() => void createPairingCode(table)}>
                Ulash kodi
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void openDevices(table)}>
                Qurilmalar
              </Button>
            </div>
          </article>
        ))}
      </div>

      <Modal
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Stolni tahrirlash" : "Yangi stol"}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraft(null)} disabled={saving}>
              Bekor qilish
            </Button>
            <Button type="submit" form="table-form" loading={saving}>
              Saqlash
            </Button>
          </>
        }
      >
        {draft ? (
          <form id="table-form" onSubmit={saveTable} className="space-y-3">
            <Field label="Kod" htmlFor="t-code" hint="Masalan: T05 (katta harf va raqam)">
              <Input
                id="t-code"
                required
                value={draft.code}
                onChange={(event) => setDraft({ ...draft, code: event.target.value.toUpperCase() })}
              />
            </Field>
            <Field label="Nomi" htmlFor="t-label">
              <Input
                id="t-label"
                required
                value={draft.label}
                onChange={(event) => setDraft({ ...draft, label: event.target.value })}
              />
            </Field>
            <Field label="Zona" htmlFor="t-zone">
              <Input
                id="t-zone"
                required
                value={draft.zone}
                onChange={(event) => setDraft({ ...draft, zone: event.target.value })}
              />
            </Field>
            <Field label="O'rinlar soni" htmlFor="t-seats">
              <Input
                id="t-seats"
                type="number"
                min={1}
                max={50}
                required
                value={draft.seats}
                onChange={(event) => setDraft({ ...draft, seats: event.target.value })}
              />
            </Field>
            <div className="flex items-center gap-3">
              <Switch
                checked={draft.isActive}
                onChange={(value) => setDraft({ ...draft, isActive: value })}
                label="Faol stol"
              />
              <span className="text-sm text-coffee-700">Faol stol</span>
            </div>
            {formError ? (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </p>
            ) : null}
          </form>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(pairing)}
        onClose={() => setPairing(null)}
        title="Qurilmani ulash kodi"
        description={`${pairing?.tableLabel ?? ""} stoli uchun bir martalik kod`}
        size="sm"
        footer={
          <Button variant="ghost" onClick={() => setPairing(null)}>
            Yopish
          </Button>
        }
      >
        <div className="rounded-2xl border border-dashed border-moss-300 bg-moss-50 px-4 py-8 text-center">
          <p className="font-mono text-3xl font-bold tracking-[0.3em] text-coffee-900">{pairing?.code}</p>
          <p className="mt-3 text-xs text-coffee-500">
            Kod 10 daqiqa amal qiladi va bir marta ishlatiladi. Qurilmada <code>/pair</code> sahifasini oching.
          </p>
        </div>
      </Modal>

      <Modal
        open={Boolean(devicesFor)}
        onClose={() => setDevicesFor(null)}
        title={`${devicesFor?.label ?? ""} — qurilmalar`}
        description="Bu stolga biriktirilgan qurilmalar. Keraksiz qurilmani bekor qiling."
        size="lg"
        footer={
          <Button variant="ghost" onClick={() => setDevicesFor(null)}>
            Yopish
          </Button>
        }
      >
        {devices === null ? (
          <Skeleton className="h-24" />
        ) : devices.length === 0 ? (
          <EmptyState title="Qurilma yo'q" description="Ulash kodi orqali yangi qurilma qo'shing." icon="📱" />
        ) : (
          <ul className="space-y-2">
            {devices.map((device) => (
              <li
                key={device.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-cream-100/70 px-3 py-2.5"
              >
                <div>
                  <p className="text-sm font-semibold text-coffee-900">{device.label ?? "Mijoz qurilmasi"}</p>
                  <p className="text-xs text-coffee-400">
                    Yaratilgan: {formatDateTime(device.createdAt)} · Amal qiladi:{" "}
                    {formatDateTime(device.expiresAt)}
                    {device.lastSeenAt ? ` · Oxirgi faollik: ${formatDateTime(device.lastSeenAt)}` : ""}
                  </p>
                </div>
                {device.revokedAt ? (
                  <Badge tone="danger">Bekor qilingan</Badge>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => void revokeDevice(device)}>
                    Bekor qilish
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}
