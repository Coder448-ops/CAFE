"use client";

import * as React from "react";
import { useApi } from "@/shared/hooks/useApi";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/field";
import { ErrorState, Skeleton } from "@/shared/components/ui/empty-state";
import { formatUzs } from "@/shared/lib/money";
import { formatBusinessDate, todayBusinessDate } from "@/shared/lib/datetime";
import { PAYMENT_METHOD_LABELS } from "@/shared/constants/orders";
import type { Reports } from "@/shared/types/domain";

function shiftDays(date: string, days: number): string {
  const base = new Date(`${date}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export function ReportsView() {
  const today = todayBusinessDate();
  const [from, setFrom] = React.useState(today);
  const [to, setTo] = React.useState(today);
  const [query, setQuery] = React.useState(`from=${today}&to=${today}`);
  const reports = useApi<Reports>(`/api/staff/reports?${query}`);

  const apply = (nextFrom: string, nextTo: string) => {
    setFrom(nextFrom);
    setTo(nextTo);
    setQuery(`from=${nextFrom}&to=${nextTo}`);
  };

  const presets = [
    { label: "Bugun", from: today, to: today },
    { label: "Kecha", from: shiftDays(today, -1), to: shiftDays(today, -1) },
    { label: "7 kun", from: shiftDays(today, -6), to: today },
    { label: "30 kun", from: shiftDays(today, -29), to: today },
  ];

  const data = reports.data;

  return (
    <div className="px-4 py-5 sm:px-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-coffee-900">Hisobotlar</h1>
          <p className="text-sm text-coffee-500">
            {formatBusinessDate(from)} — {formatBusinessDate(to)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => apply(preset.from, preset.to)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                from === preset.from && to === preset.to
                  ? "bg-coffee-800 text-cream-50"
                  : "bg-cream-200 text-coffee-600 hover:bg-cream-300"
              }`}
            >
              {preset.label}
            </button>
          ))}
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            Chop etish
          </Button>
        </div>
      </div>

      <form
        className="surface mb-4 flex flex-wrap items-end gap-3 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          apply(from, to);
        }}
      >
        <div>
          <label className="label-base" htmlFor="from">
            Boshlanish
          </label>
          <Input id="from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </div>
        <div>
          <label className="label-base" htmlFor="to">
            Tugash
          </label>
          <Input id="to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
        <Button type="submit" size="md">
          Ko&apos;rsatish
        </Button>
      </form>

      {reports.error ? <ErrorState message={reports.error} onRetry={() => void reports.refresh()} /> : null}

      {!data ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Qayd etilgan to'lovlar"
              value={formatUzs(data.summary.paymentsRecordedTiyin)}
              hint="Kassada tasdiqlangan tushum"
              tone="moss"
            />
            <SummaryCard
              label="Buyurtmalar summasi"
              value={formatUzs(data.summary.netSalesTiyin)}
              hint={`${data.summary.ordersSubmitted} ta buyurtma (bekor qilinganlarsiz)`}
            />
            <SummaryCard
              label="Qarzdorlik"
              value={formatUzs(data.summary.outstandingTiyin)}
              hint="Hali to'lanmagan summa"
              tone="terracotta"
            />
            <SummaryCard
              label="Qaytarishlar"
              value={formatUzs(data.summary.refundsTiyin)}
              hint={`O'rtacha chek: ${formatUzs(data.summary.averageOrderTiyin)}`}
            />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <section className="surface p-5">
              <h2 className="font-display text-lg font-semibold text-coffee-900">To&apos;lov usullari</h2>
              <table className="mt-3 w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-coffee-400">
                  <tr>
                    <th className="pb-2">Usul</th>
                    <th className="pb-2 text-right">Soni</th>
                    <th className="pb-2 text-right">Summa</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byMethod.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-3 text-coffee-400">
                        Bu davrda to&apos;lov qayd etilmagan.
                      </td>
                    </tr>
                  ) : (
                    data.byMethod.map((row) => (
                      <tr key={row.method} className="border-t border-coffee-100">
                        <td className="py-2">{PAYMENT_METHOD_LABELS[row.method]}</td>
                        <td className="py-2 text-right">{row.count}</td>
                        <td className="py-2 text-right font-semibold">{formatUzs(row.amountTiyin)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>

            <section className="surface p-5">
              <h2 className="font-display text-lg font-semibold text-coffee-900">Kategoriyalar bo&apos;yicha</h2>
              <table className="mt-3 w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-coffee-400">
                  <tr>
                    <th className="pb-2">Kategoriya</th>
                    <th className="pb-2 text-right">Soni</th>
                    <th className="pb-2 text-right">Sotuv</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byCategory.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-3 text-coffee-400">
                        Ma&apos;lumot yo&apos;q.
                      </td>
                    </tr>
                  ) : (
                    data.byCategory.map((row) => (
                      <tr key={row.categoryName} className="border-t border-coffee-100">
                        <td className="py-2">{row.categoryName}</td>
                        <td className="py-2 text-right">{row.quantity}</td>
                        <td className="py-2 text-right font-semibold">{formatUzs(row.revenueTiyin)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>
          </div>

          <section className="surface mt-4 p-5">
            <h2 className="font-display text-lg font-semibold text-coffee-900">Eng ko&apos;p sotilgan taomlar</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-coffee-400">
                  <tr>
                    <th className="pb-2">Taom</th>
                    <th className="pb-2 text-right">Soni</th>
                    <th className="pb-2 text-right">Sotuv</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byProduct.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-3 text-coffee-400">
                        Ma&apos;lumot yo&apos;q.
                      </td>
                    </tr>
                  ) : (
                    data.byProduct.map((row) => (
                      <tr key={`${row.productId}-${row.productName}`} className="border-t border-coffee-100">
                        <td className="py-2">{row.productName}</td>
                        <td className="py-2 text-right">{row.quantity}</td>
                        <td className="py-2 text-right font-semibold">{formatUzs(row.revenueTiyin)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="surface mt-4 p-5">
            <h2 className="font-display text-lg font-semibold text-coffee-900">Kunlar bo&apos;yicha</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-coffee-400">
                  <tr>
                    <th className="pb-2">Sana</th>
                    <th className="pb-2 text-right">To&apos;lovlar</th>
                    <th className="pb-2 text-right">Buyurtmalar</th>
                  </tr>
                </thead>
                <tbody>
                  {data.daily.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-3 text-coffee-400">
                        To&apos;lovlar yo&apos;q.
                      </td>
                    </tr>
                  ) : (
                    data.daily.map((row) => (
                      <tr key={row.businessDate} className="border-t border-coffee-100">
                        <td className="py-2">{formatBusinessDate(row.businessDate)}</td>
                        <td className="py-2 text-right font-semibold">{formatUzs(row.paymentsTiyin)}</td>
                        <td className="py-2 text-right">{row.orders}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <p className="mt-4 text-[11px] leading-relaxed text-coffee-400">
            Hisobotlar faqat serverdagi yozuvlar asosida hisoblanadi. «Qayd etilgan to&apos;lovlar» — kassir
            tasdiqlagan pul tushumi; «Buyurtmalar summasi» — mijoz buyurtmalari (bekor qilinganlarsiz);
            «Qarzdorlik» — hali to&apos;lanmagan summa. Sanalar Asia/Tashkent vaqti bo&apos;yicha.
          </p>
        </>
      )}
    </div>
  );
}

function SummaryCard({
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
        className={`mt-1.5 font-display text-xl font-semibold ${
          tone === "moss" ? "text-moss-700" : tone === "terracotta" ? "text-terracotta-600" : "text-coffee-900"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-[11px] text-coffee-400">{hint}</p>
    </div>
  );
}
