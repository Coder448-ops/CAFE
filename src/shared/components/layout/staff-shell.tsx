"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/shared/lib/cn";
import { apiFetch } from "@/modules/shared/api";
import { ROLE_LABELS } from "@/shared/constants/orders";
import type { Role } from "@/shared/types/domain";

export type NavItem = { href: string; label: string; icon: string };

const ROLE_NAV: Record<Role, NavItem[]> = {
  cashier: [
    { href: "/cashier", label: "Buyurtmalar", icon: "🧾" },
    { href: "/cashier/tables", label: "Stollar", icon: "🪑" },
  ],
  kitchen: [
    { href: "/kitchen", label: "Biletlar", icon: "🍳" },
    { href: "/kitchen/history", label: "Tarix", icon: "🕘" },
  ],
  admin: [
    { href: "/admin", label: "Boshqaruv paneli", icon: "◧" },
    { href: "/admin/menu", label: "Menyu", icon: "☰" },
    { href: "/admin/tables", label: "Stollar", icon: "🪑" },
    { href: "/admin/staff", label: "Xodimlar", icon: "👥" },
    { href: "/admin/reports", label: "Hisobotlar", icon: "📈" },
    { href: "/admin/audit", label: "Audit jurnali", icon: "🗂" },
    { href: "/admin/settings", label: "Sozlamalar", icon: "⚙" },
  ],
};

export function StaffShell({
  user,
  children,
  headerActions,
  contentClassName,
}: {
  user: { fullName: string; role: Role };
  children: React.ReactNode;
  headerActions?: React.ReactNode;
  contentClassName?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const nav = ROLE_NAV[user.role];

  async function signOut() {
    setSigningOut(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-cream-100 lg:flex-row">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-coffee-100 bg-cream-50 lg:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-coffee-800 font-display text-sm font-bold text-cream-50">
            LC
          </span>
          <div>
            <p className="font-display text-base font-semibold leading-tight text-coffee-900">LOLA CAFE</p>
            <p className="text-[11px] uppercase tracking-wider text-coffee-400">{ROLE_LABELS[user.role]}</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3" aria-label="Asosiy navigatsiya">
          {nav.map((item) => {
            const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-coffee-800 text-cream-50"
                    : "text-coffee-600 hover:bg-cream-200 hover:text-coffee-900",
                )}
              >
                <span aria-hidden className="w-5 text-center">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-coffee-100 p-3">
          <div className="rounded-xl bg-cream-100 px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-coffee-800">{user.fullName}</p>
            <p className="text-[11px] text-coffee-400">{ROLE_LABELS[user.role]}</p>
          </div>
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="mt-2 w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-coffee-500 hover:bg-cream-200 hover:text-coffee-800"
          >
            Chiqish
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-coffee-100 bg-cream-50/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              aria-expanded={menuOpen}
              aria-label="Menyu"
              className="rounded-lg border border-coffee-200 px-3 py-2 text-sm font-semibold text-coffee-700"
            >
              ☰
            </button>
            <span className="font-display text-base font-semibold text-coffee-900">LOLA CAFE</span>
          </div>
          <div className="flex items-center gap-2">
            {headerActions}
            <button
              type="button"
              onClick={signOut}
              className="rounded-lg px-2 py-1.5 text-xs font-semibold text-coffee-500 hover:text-coffee-800"
            >
              Chiqish
            </button>
          </div>
        </header>

        {menuOpen ? (
          <nav className="border-b border-coffee-100 bg-cream-50 p-3 lg:hidden" aria-label="Mobil navigatsiya">
            <div className="grid grid-cols-2 gap-2">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl bg-cream-100 px-3 py-2.5 text-sm font-medium text-coffee-700"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        ) : null}

        <main className={cn("min-w-0 flex-1", contentClassName)}>{children}</main>
      </div>
    </div>
  );
}
