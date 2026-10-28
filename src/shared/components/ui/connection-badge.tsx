"use client";

import type { ConnectionState } from "@/shared/hooks/useRealtime";

const LABELS: Record<ConnectionState, { text: string; className: string }> = {
  live: { text: "Jonli", className: "bg-moss-100 text-moss-700" },
  connecting: { text: "Ulanmoqda…", className: "bg-cream-200 text-coffee-600" },
  reconnecting: { text: "Qayta ulanmoqda…", className: "bg-amber-100 text-amber-800" },
  offline: { text: "Oflayn", className: "bg-red-50 text-red-700" },
};

export function ConnectionBadge({ state }: { state: ConnectionState }) {
  const label = LABELS[state];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${label.className}`}
      title="Real vaqt ulanishi holati"
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          state === "live" ? "bg-moss-600" : state === "offline" ? "bg-red-500" : "bg-amber-500 animate-pulse-soft"
        }`}
        aria-hidden
      />
      {label.text}
    </span>
  );
}
