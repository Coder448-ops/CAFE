"use client";

import Link from "next/link";
import { useApi } from "@/shared/hooks/useApi";
import { useRealtime } from "@/shared/hooks/useRealtime";
import { ErrorState, Skeleton } from "@/shared/components/ui/empty-state";
import { ConnectionBadge } from "@/shared/components/ui/connection-badge";
import { Badge } from "@/shared/components/ui/badge";
import { formatUzs } from "@/shared/lib/money";
import { formatBusinessDate, formatDateTime } from "@/shared/lib/datetime";
import type { AuditLogEntry, Reports } from "@/shared/types/domain";

type Snapshot = {
  businessDate: string;
  openOrders: number;
  openTables: number;
  outstandingTiyin: number;
  paymentsTodayTiyin: number;
  activeTickets: number;
};

export function AdminDashboard() {
  const snapshot = useApi<Snapshot>("/api/staff/dashboard", { pollMs: 20_000 });
  const reports = useApi<Reports>("/api/staff/reports", { pollMs: 60_000 });
  const audit = useApi<{ entries: AuditLogEntry[] }>("/api/staff/audit?limit=8", { pollMs: 60_000 });
  const { state } = useRealtime(() => {
    void snapshot.refresh({ silent: true });
  });

  const data = snapshot.data;
  const summary = reports.data?.summary;

  return (
    <div className="px-4 py-5 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-coffee-900">Boshqaruv paneli</h1>
          <p className="text-sm text-coffee-500">
            {data ? `${formatBusinessDate(data.businessDate)} · Asia/Tashkent` : "Bugungi ko'rsatkichlar"}
          </p>
        </div>
        <ConnectionBadge state={state} />
      </div>

      {snapshot.error ? <ErrorState message={snapshot.error} onRetry={() => void snapshot.refresh()} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {!data ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28" />)
        ) : (
          <>
            <StatCard
              label="Bugungi tushum"
              value={formatUzs(data.paymentsTodayTiyin)}
              hint="Qayd etilgan to'lovlar"
              tone="moss"
            />
            <StatCard
              label="To'lanmagan summa"
              value={formatUzs(data.outstandingTiyin)}
              hint="Faol buyurtmalar bo'yicha qarz"
              tone="terracotta"
            />
            <StatCard label="Faol buyurtmalar" value={String(data.openOrders)} hint="Yakunlanmagan" />
            <StatCard
              label="Band stollar"
              value={String(data.openTables)}
              hint={`${data.activeTickets} ta faol bilet`}
            />
          </>
        )}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.4fr,1fr]">
        <section className="surface p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-coffee-900">Bugungi moliyaviy xulosa</h2>
            <Link href="/admin/reports" className="text-sm font-semibold text-moss-600 hover:text-moss-700">
              Hisobotlar →
            </Link>
          </div>
          {!summary ? (
            <Skeleton className="h-40" />
          ) : (
            <dl className="grid gap-3 sm:grid-cols-2">
              <Metric label="Qayd etilgan to'lovlar" value={formatUzs(summary.paymentsRecordedTiyin)} />
              <Metric label="Sotuv (buyurtmalar)" value={formatUzs(summary.netSalesTiyin)} />
              <Metric label="Qaytarishlar" value={formatUzs(summary.refundsTiyin)} />
              <Metric label="Qarzdorlik" value={formatUzs(summary.outstandingTiyin)} />
              <Metric label="Buyurtmalar" value={`${summary.ordersSubmitted} ta`} />
              <Metric label="O'rtacha chek" value={formatUzs(summary.averageOrderTiyin)} />
            </dl>
          )}
          <p className="mt-4 rounded-lg bg-cream-100 px-3 py-2 text-[11px] leading-relaxed text-coffee-500">
            To&apos;lovlar va buyurtmalar alohida hisoblanadi: kassada qayd etilgan summa tushum, buyurtma
            summasi esa sotuv hisoblanadi. To&apos;lanmagan buyurtmalar tushumga kirmaydi.
          </p>
        </section>

        <section className="surface p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-coffee-900">So&apos;nggi harakatlar</h2>
            <Link href="/admin/audit" className="text-sm font-semibold text-moss-600 hover:text-moss-700">
              Jurnal →
            </Link>
          </div>
          {audit.loading && !audit.data ? <Skeleton className="h-40" /> : null}
          <ul className="space-y-2">
            {(audit.data?.entries ?? []).map((entry) => (
              <li key={entry.id} className="rounded-lg bg-cream-100/70 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <Badge tone="muted">{entry.action}</Badge>
                  <span className="text-[11px] text-coffee-400">{formatDateTime(entry.createdAt)}</span>
                </div>
                <p className="mt-1 text-xs text-coffee-600">
                  {entry.actorLabel} · {entry.entityType}
                  {entry.entityId ? ` #${entry.entityId}` : ""}
                </p>
              </li>
            ))}
            {audit.data && audit.data.entries.length === 0 ? (
              <li className="text-sm text-coffee-400">Hozircha yozuv yo&apos;q.</li>
            ) : null}
          </ul>
        </section>
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { href: "/admin/menu", title: "Menyu boshqaruvi", description: "Narxlar, mavjudlik, kategoriyalar" },
          { href: "/admin/tables", title: "Stollar va qurilmalar", description: "Sessiyalar, ulash kodlari" },
          { href: "/admin/staff", title: "Xodimlar", description: "Rollar va kirish huquqlari" },
          { href: "/admin/settings", title: "Sozlamalar", description: "Restoran ma'lumotlari, chek" },
        ].map((item) => (
          <Link key={item.href} href={item.href} className="surface p-4 transition hover:border-moss-300">
            <p className="font-semibold text-coffee-900">{item.title}</p>
            <p className="mt-1 text-xs text-coffee-500">{item.description}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "neutral" | "moss" | "terracotta";
}) {
  return (
    <div className="surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-coffee-400">{label}</p>
      <p
        className={`mt-2 font-display text-2xl font-semibold ${
          tone === "moss" ? "text-moss-700" : tone === "terracotta" ? "text-terracotta-600" : "text-coffee-900"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-[11px] text-coffee-400">{hint}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-cream-100/70 px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-coffee-400">{label}</dt>
      <dd className="mt-0.5 font-semibold text-coffee-900">{value}</dd>
    </div>
  );
}
