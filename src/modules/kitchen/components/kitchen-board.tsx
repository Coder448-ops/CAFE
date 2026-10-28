"use client";

import * as React from "react";
import { useApi } from "@/shared/hooks/useApi";
import { useRealtime } from "@/shared/hooks/useRealtime";
import { apiFetch, errorMessage } from "@/modules/shared/api";
import { useToast } from "@/shared/components/ui/toast";
import { Button } from "@/shared/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/shared/components/ui/empty-state";
import { ConnectionBadge } from "@/shared/components/ui/connection-badge";
import { formatDuration, minutesSince } from "@/shared/lib/datetime";
import type { KitchenTicket } from "@/shared/types/domain";

type Station = "all" | "kitchen" | "bar";

const COLUMNS: Array<{ status: KitchenTicket["status"]; title: string; hint: string }> = [
  { status: "queued", title: "Navbatda", hint: "Yangi biletlar" },
  { status: "preparing", title: "Tayyorlanmoqda", hint: "Oshxonada" },
  { status: "ready", title: "Tayyor", hint: "Ofitsiantga" },
];

export function KitchenBoard({ history = false }: { history?: boolean }) {
  const toast = useToast();
  const [station, setStation] = React.useState<Station>("all");
  const [busyId, setBusyId] = React.useState<number | null>(null);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(interval);
  }, []);

  const path = `/api/staff/kitchen/tickets${history ? "?history=1" : ""}`;
  const ticketsApi = useApi<{ tickets: KitchenTicket[] }>(path, { pollMs: 30_000 });

  const { state: connectionState } = useRealtime((event) => {
    void ticketsApi.refresh({ silent: true });
    if (event.type === "ticket.created") {
      toast.push("Yangi bilet keldi", "info");
    }
  });

  const tickets = (ticketsApi.data?.tickets ?? []).filter(
    (ticket) => station === "all" || ticket.station === station,
  );

  async function advance(ticket: KitchenTicket, status: KitchenTicket["status"]) {
    setBusyId(ticket.id);
    try {
      await apiFetch(`/api/staff/kitchen/tickets/${ticket.id}`, { method: "POST", body: { status } });
      await ticketsApi.refresh({ silent: true });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  function elapsed(ticket: KitchenTicket): string {
    const reference = new Date(now);
    const minutes = minutesSince(ticket.status === "preparing" && ticket.startedAt ? ticket.startedAt : ticket.createdAt, reference);
    return formatDuration(minutes);
  }

  return (
    <div className="px-4 py-5 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-coffee-900">
            {history ? "Biletlar tarixi" : "Oshxona ekrani"}
          </h1>
          <p className="text-sm text-coffee-500">
            {history ? "Yakunlangan biletlar" : "Real vaqtda yangilanadigan tayyorlash biletlari"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ConnectionBadge state={connectionState} />
          <div className="flex rounded-xl bg-cream-200/70 p-1" role="tablist" aria-label="Stansiya">
            {(
              [
                { value: "all", label: "Barchasi" },
                { value: "kitchen", label: "Oshxona" },
                { value: "bar", label: "Bar" },
              ] as Array<{ value: Station; label: string }>
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={station === option.value}
                onClick={() => setStation(option.value)}
                className={
                  station === option.value
                    ? "rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-coffee-900 shadow-sm"
                    : "rounded-lg px-3 py-1.5 text-xs font-semibold text-coffee-500 hover:text-coffee-800"
                }
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {ticketsApi.error ? <ErrorState message={ticketsApi.error} onRetry={() => void ticketsApi.refresh()} /> : null}

      {ticketsApi.loading && !ticketsApi.data ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-64" />
          ))}
        </div>
      ) : null}

      {history ? (
        <HistoryTable tickets={tickets} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {COLUMNS.map((column) => {
            const columnTickets = tickets.filter((ticket) => ticket.status === column.status);
            return (
              <section key={column.status} aria-label={column.title} className="min-w-0">
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <h2 className="font-display text-lg font-semibold text-coffee-900">{column.title}</h2>
                  <span className="text-xs text-coffee-400">
                    {columnTickets.length} ta · {column.hint}
                  </span>
                </div>
                <div className="space-y-3">
                  {columnTickets.length === 0 ? (
                    <EmptyState
                      title="Bo'sh"
                      description="Bu ustunda hozircha bilet yo'q."
                      className="py-8"
                      icon="✓"
                    />
                  ) : (
                    columnTickets.map((ticket) => (
                      <TicketCard
                        key={ticket.id}
                        ticket={ticket}
                        elapsed={elapsed(ticket)}
                        busy={busyId === ticket.id}
                        onAdvance={(status) => void advance(ticket, status)}
                      />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TicketCard({
  ticket,
  elapsed,
  busy,
  onAdvance,
}: {
  ticket: KitchenTicket;
  elapsed: string;
  busy: boolean;
  onAdvance: (status: KitchenTicket["status"]) => void;
}) {
  const urgent = minutesSince(ticket.createdAt) >= 15 && ticket.status !== "ready";
  return (
    <article
      className={`surface animate-fade-in overflow-hidden ${urgent ? "border-terracotta-300" : ""}`}
    >
      <header
        className={`flex items-start justify-between gap-2 px-4 py-3 ${
          ticket.status === "queued"
            ? "bg-terracotta-50"
            : ticket.status === "preparing"
              ? "bg-amber-50"
              : "bg-moss-50"
        }`}
      >
        <div>
          <p className="font-display text-2xl font-bold leading-none text-coffee-900">{ticket.tableLabel}</p>
          <p className="mt-1 text-xs font-semibold text-coffee-500">
            #{ticket.orderNumber} · {ticket.station === "bar" ? "Bar" : "Oshxona"}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-sm font-bold ${urgent ? "text-terracotta-600" : "text-coffee-700"}`}>{elapsed}</p>
          <p className="text-[10px] uppercase tracking-wide text-coffee-400">kutish</p>
        </div>
      </header>

      <div className="px-4 py-3">
        <ul className="space-y-2">
          {ticket.items.map((item) => (
            <li key={item.orderItemId} className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-coffee-800 text-sm font-bold text-cream-50">
                {item.quantity}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-snug text-coffee-900">{item.productName}</p>
                {item.options.length > 0 ? (
                  <p className="text-xs text-coffee-500">{item.options.join(" · ")}</p>
                ) : null}
                {item.note ? (
                  <p className="mt-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-900">
                    {item.note}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        {ticket.orderNote ? (
          <p className="mt-3 rounded-lg bg-cream-100 px-2.5 py-1.5 text-xs text-coffee-600">
            Buyurtma izohi: {ticket.orderNote}
          </p>
        ) : null}
      </div>

      <footer className="flex gap-2 border-t border-coffee-100 px-4 py-3">
        {ticket.status === "queued" ? (
          <Button size="sm" fullWidth loading={busy} onClick={() => onAdvance("preparing")}>
            Boshlash
          </Button>
        ) : null}
        {ticket.status === "preparing" ? (
          <Button size="sm" fullWidth variant="secondary" loading={busy} onClick={() => onAdvance("ready")}>
            Tayyor
          </Button>
        ) : null}
        {ticket.status === "ready" ? (
          <p className="w-full rounded-lg bg-moss-50 px-3 py-2 text-center text-xs font-semibold text-moss-700">
            Ofitsiant olib ketishi mumkin
          </p>
        ) : null}
      </footer>
    </article>
  );
}

function HistoryTable({ tickets }: { tickets: KitchenTicket[] }) {
  if (tickets.length === 0) {
    return <EmptyState title="Tarix bo'sh" description="Yakunlangan biletlar bu yerda ko'rinadi." icon="🕘" />;
  }
  return (
    <div className="surface overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-cream-100 text-left text-xs uppercase tracking-wide text-coffee-500">
          <tr>
            <th className="px-4 py-3">Bilet</th>
            <th className="px-4 py-3">Stol</th>
            <th className="px-4 py-3">Stansiya</th>
            <th className="px-4 py-3">Taomlar</th>
            <th className="px-4 py-3">Holat</th>
            <th className="px-4 py-3">Tayyorlanish vaqti</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => {
            const duration =
              ticket.readyAt && ticket.startedAt
                ? formatDuration(
                    Math.max(
                      0,
                      Math.round(
                        (new Date(ticket.readyAt).getTime() - new Date(ticket.startedAt).getTime()) / 60_000,
                      ),
                    ),
                  )
                : "—";
            return (
              <tr key={ticket.id} className="border-t border-coffee-100">
                <td className="px-4 py-2.5 font-semibold">#{ticket.orderNumber}</td>
                <td className="px-4 py-2.5">{ticket.tableLabel}</td>
                <td className="px-4 py-2.5">{ticket.station === "bar" ? "Bar" : "Oshxona"}</td>
                <td className="px-4 py-2.5 text-coffee-600">
                  {ticket.items.map((item) => `${item.quantity}× ${item.productName}`).join(", ")}
                </td>
                <td className="px-4 py-2.5">{ticket.status}</td>
                <td className="px-4 py-2.5">{duration}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
