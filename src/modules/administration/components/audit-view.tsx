"use client";

import * as React from "react";
import { useApi } from "@/shared/hooks/useApi";
import { Badge } from "@/shared/components/ui/badge";
import { EmptyState, ErrorState, Skeleton } from "@/shared/components/ui/empty-state";
import { formatDateTime } from "@/shared/lib/datetime";
import { ROLE_LABELS } from "@/shared/constants/orders";
import type { AuditLogEntry, Role } from "@/shared/types/domain";

export function AuditView() {
  const [limit, setLimit] = React.useState(100);
  const audit = useApi<{ entries: AuditLogEntry[] }>(`/api/staff/audit?limit=${limit}`);

  return (
    <div className="px-4 py-5 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-coffee-900">Audit jurnali</h1>
          <p className="text-sm text-coffee-500">Tizimdagi muhim harakatlar tarixi (o&apos;chirilmaydi)</p>
        </div>
        <select
          value={limit}
          onChange={(event) => setLimit(Number(event.target.value))}
          className="input-base h-10 w-auto"
          aria-label="Yozuvlar soni"
        >
          <option value={50}>50 yozuv</option>
          <option value={100}>100 yozuv</option>
          <option value={250}>250 yozuv</option>
          <option value={500}>500 yozuv</option>
        </select>
      </div>

      {audit.error ? <ErrorState message={audit.error} onRetry={() => void audit.refresh()} /> : null}

      {audit.loading && !audit.data ? <Skeleton className="h-64" /> : null}

      {audit.data && audit.data.entries.length === 0 ? (
        <EmptyState title="Jurnal bo'sh" description="Harakatlar bajarilganda bu yerda ko'rinadi." icon="🗂" />
      ) : null}

      {audit.data && audit.data.entries.length > 0 ? (
        <div className="surface overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-cream-100 text-left text-xs uppercase tracking-wide text-coffee-500">
              <tr>
                <th className="px-4 py-3">Vaqt</th>
                <th className="px-4 py-3">Kim</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Amal</th>
                <th className="px-4 py-3">Obyekt</th>
                <th className="px-4 py-3">Tafsilot</th>
              </tr>
            </thead>
            <tbody>
              {audit.data.entries.map((entry) => (
                <tr key={entry.id} className="border-t border-coffee-100 align-top">
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-coffee-500">
                    {formatDateTime(entry.createdAt)}
                  </td>
                  <td className="px-4 py-2.5">{entry.actorLabel}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone="muted">
                      {entry.actorRole in ROLE_LABELS
                        ? ROLE_LABELS[entry.actorRole as Role]
                        : entry.actorRole === "customer"
                          ? "Mijoz"
                          : entry.actorRole}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 font-semibold">{entry.action}</td>
                  <td className="px-4 py-2.5 text-xs text-coffee-500">
                    {entry.entityType}
                    {entry.entityId ? ` #${entry.entityId}` : ""}
                  </td>
                  <td className="max-w-[260px] truncate px-4 py-2.5 text-xs text-coffee-400">
                    {entry.details ? JSON.stringify(entry.details) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
