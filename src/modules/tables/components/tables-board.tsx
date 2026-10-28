"use client";

import * as React from "react";
import { useApi } from "@/shared/hooks/useApi";
import { useRealtime } from "@/shared/hooks/useRealtime";
import { apiFetch, errorMessage } from "@/modules/shared/api";
import { useToast } from "@/shared/components/ui/toast";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Modal } from "@/shared/components/ui/modal";
import { EmptyState, ErrorState, Skeleton } from "@/shared/components/ui/empty-state";
import { ConnectionBadge } from "@/shared/components/ui/connection-badge";
import { formatUzs } from "@/shared/lib/money";
import { formatDuration, formatTime, minutesSince } from "@/shared/lib/datetime";
import type { RestaurantTable } from "@/shared/types/domain";

export function TablesBoard() {
  const toast = useToast();
  const tablesApi = useApi<{ tables: RestaurantTable[] }>("/api/staff/tables", { pollMs: 30_000 });
  const [pairing, setPairing] = React.useState<{ code: string; tableLabel: string } | null>(null);
  const [busyTableId, setBusyTableId] = React.useState<number | null>(null);
  const [guestPrompt, setGuestPrompt] = React.useState<RestaurantTable | null>(null);
  const [guests, setGuests] = React.useState("2");
  const [billAlerts, setBillAlerts] = React.useState<string[]>([]);

  const { state: connectionState } = useRealtime((event) => {
    void tablesApi.refresh({ silent: true });
    if (event.type === "table.bill_requested") {
      const label = (event.payload as { tableLabel?: string }).tableLabel ?? "Stol";
      setBillAlerts((current) => [label, ...current].slice(0, 4));
    }
  });

  const tables = tablesApi.data?.tables ?? [];

  async function createPairingCode(table: RestaurantTable) {
    setBusyTableId(table.id);
    try {
      const result = await apiFetch<{ pairing: { code: string; expiresAt: string } }>(
        `/api/staff/tables/${table.id}/pairing-code`,
        { method: "POST" },
      );
      setPairing({ code: result.pairing.code, tableLabel: table.label });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyTableId(null);
    }
  }

  async function openSession(table: RestaurantTable) {
    setBusyTableId(table.id);
    try {
      await apiFetch(`/api/staff/tables/${table.id}/session`, {
        method: "POST",
        body: { guests: Number(guests) || undefined },
      });
      toast.success(`${table.label} uchun sessiya ochildi`);
      setGuestPrompt(null);
      await tablesApi.refresh({ silent: true });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyTableId(null);
    }
  }

  async function closeSession(table: RestaurantTable) {
    if (!table.openSessionId) return;
    setBusyTableId(table.id);
    try {
      await apiFetch(`/api/staff/tables/${table.id}/session?sessionId=${table.openSessionId}`, {
        method: "DELETE",
      });
      toast.success(`${table.label} sessiyasi yopildi`);
      await tablesApi.refresh({ silent: true });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyTableId(null);
    }
  }

  return (
    <div className="px-4 py-5 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-coffee-900">Stollar</h1>
          <p className="text-sm text-coffee-500">Sessiyalar, qarzlar va qurilma ulash kodlari</p>
        </div>
        <div className="flex items-center gap-2">
          <ConnectionBadge state={connectionState} />
          <Button variant="outline" size="sm" onClick={() => void tablesApi.refresh()}>
            Yangilash
          </Button>
        </div>
      </div>

      {billAlerts.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span className="font-semibold">Hisob so&apos;rovlari:</span>
          {billAlerts.map((label) => (
            <Badge key={label} tone="warning">
              {label}
            </Badge>
          ))}
          <button
            type="button"
            onClick={() => setBillAlerts([])}
            className="ml-auto font-semibold underline hover:no-underline"
          >
            Tozalash
          </button>
        </div>
      ) : null}

      {tablesApi.error ? <ErrorState message={tablesApi.error} onRetry={() => void tablesApi.refresh()} /> : null}

      {tablesApi.loading && !tablesApi.data ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-40" />
          ))}
        </div>
      ) : null}

      {!tablesApi.loading && tables.length === 0 ? (
        <EmptyState title="Stollar yo'q" description="Administrator panelida stol qo'shing." icon="🪑" />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tables.map((table) => {
          const occupied = Boolean(table.openSessionId);
          return (
            <article
              key={table.id}
              className={`surface flex flex-col gap-3 p-4 ${occupied ? "border-moss-300/70" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-semibold text-coffee-900">{table.label}</h2>
                  <p className="text-xs text-coffee-400">
                    {table.code} · {table.zone} · {table.seats} o&apos;rin
                  </p>
                </div>
                <Badge tone={occupied ? "success" : "muted"}>{occupied ? "Band" : "Bo'sh"}</Badge>
              </div>

              {occupied ? (
                <dl className="grid grid-cols-2 gap-2 rounded-lg bg-cream-100/70 p-2.5 text-xs">
                  <div>
                    <dt className="text-coffee-400">Sessiya</dt>
                    <dd className="font-semibold text-coffee-800">
                      {table.sessionOpenedAt
                        ? `${formatTime(table.sessionOpenedAt)} · ${formatDuration(minutesSince(table.sessionOpenedAt))}`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-coffee-400">Faol buyurtma</dt>
                    <dd className="font-semibold text-coffee-800">{table.activeOrders} ta</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-coffee-400">To&apos;lanmagan</dt>
                    <dd className="font-semibold text-terracotta-600">{formatUzs(table.unpaidTiyin)}</dd>
                  </div>
                </dl>
              ) : (
                <p className="rounded-lg bg-cream-100/70 p-2.5 text-xs text-coffee-500">
                  Stol bo&apos;sh. Mijoz buyurtma yuborsa sessiya avtomatik ochiladi.
                </p>
              )}

              <div className="mt-auto flex flex-wrap gap-2">
                {occupied ? (
                  <Button
                    size="sm"
                    variant="outline"
                    loading={busyTableId === table.id}
                    onClick={() => void closeSession(table)}
                  >
                    Sessiyani yopish
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setGuestPrompt(table)}>
                    Sessiya ochish
                  </Button>
                )}
                <Button
                  size="sm"
                  loading={busyTableId === table.id}
                  onClick={() => void createPairingCode(table)}
                >
                  Ulash kodi
                </Button>
              </div>
            </article>
          );
        })}
      </div>

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
            Kod 10 daqiqa amal qiladi va faqat bir marta ishlatiladi. Stol qurilmasida <code>/pair</code>{" "}
            sahifasini ochib, kodni kiriting.
          </p>
        </div>
      </Modal>

      <Modal
        open={Boolean(guestPrompt)}
        onClose={() => setGuestPrompt(null)}
        title={`${guestPrompt?.label ?? ""} — sessiya ochish`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setGuestPrompt(null)}>
              Bekor qilish
            </Button>
            <Button loading={busyTableId === guestPrompt?.id} onClick={() => guestPrompt && void openSession(guestPrompt)}>
              Ochish
            </Button>
          </>
        }
      >
        <label className="label-base" htmlFor="guests">
          Mehmonlar soni
        </label>
        <input
          id="guests"
          type="number"
          min={1}
          max={50}
          value={guests}
          onChange={(event) => setGuests(event.target.value)}
          className="input-base h-11"
        />
      </Modal>
    </div>
  );
}
