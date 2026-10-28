"use client";

import * as React from "react";
import { useApi } from "@/shared/hooks/useApi";
import { apiFetch, errorMessage } from "@/modules/shared/api";
import { useToast } from "@/shared/components/ui/toast";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Field, Input, Select, Switch } from "@/shared/components/ui/field";
import { Modal } from "@/shared/components/ui/modal";
import { ErrorState, Skeleton } from "@/shared/components/ui/empty-state";
import { ROLE_LABELS } from "@/shared/constants/orders";
import { formatDateTime } from "@/shared/lib/datetime";
import type { Role, StaffUser } from "@/shared/types/domain";

type StaffDraft = {
  id: number | null;
  email: string;
  fullName: string;
  role: Role;
  password: string;
  isActive: boolean;
};

export function StaffAdmin({ currentUserId }: { currentUserId: number }) {
  const toast = useToast();
  const usersApi = useApi<{ users: StaffUser[] }>("/api/staff/users");
  const [draft, setDraft] = React.useState<StaffDraft | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const users = usersApi.data?.users ?? [];

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setFormError(null);
    setSaving(true);
    try {
      if (draft.id) {
        await apiFetch(`/api/staff/users/${draft.id}`, {
          method: "PATCH",
          body: {
            fullName: draft.fullName,
            role: draft.role,
            isActive: draft.isActive,
            ...(draft.password ? { password: draft.password } : {}),
          },
        });
        toast.success("Xodim saqlandi");
      } else {
        await apiFetch("/api/staff/users", {
          method: "POST",
          body: {
            email: draft.email,
            fullName: draft.fullName,
            role: draft.role,
            password: draft.password,
          },
        });
        toast.success("Xodim qo'shildi");
      }
      setDraft(null);
      await usersApi.refresh({ silent: true });
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user: StaffUser) {
    try {
      await apiFetch(`/api/staff/users/${user.id}`, {
        method: "PATCH",
        body: { isActive: !user.isActive },
      });
      await usersApi.refresh({ silent: true });
      toast.success(user.isActive ? "Xodim bloklandi" : "Xodim faollashtirildi");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <div className="px-4 py-5 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-coffee-900">Xodimlar</h1>
          <p className="text-sm text-coffee-500">
            Rollar serverda tekshiriladi. Parol o&apos;zgarishi barcha sessiyalarni bekor qiladi.
          </p>
        </div>
        <Button
          onClick={() =>
            setDraft({ id: null, email: "", fullName: "", role: "cashier", password: "", isActive: true })
          }
        >
          Xodim qo&apos;shish
        </Button>
      </div>

      {usersApi.error ? <ErrorState message={usersApi.error} onRetry={() => void usersApi.refresh()} /> : null}
      {usersApi.loading && !usersApi.data ? <Skeleton className="h-56" /> : null}

      {usersApi.data ? (
        <div className="surface overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-cream-100 text-left text-xs uppercase tracking-wide text-coffee-500">
              <tr>
                <th className="px-4 py-3">Xodim</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Holat</th>
                <th className="px-4 py-3">Oxirgi kirish</th>
                <th className="px-4 py-3 text-right">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-coffee-100">
                  <td className="px-4 py-2.5">
                    <p className="font-semibold text-coffee-900">
                      {user.fullName}
                      {user.id === currentUserId ? <span className="ml-2 text-xs text-coffee-400">(siz)</span> : null}
                    </p>
                    <p className="text-xs text-coffee-400">{user.email}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone="muted">{ROLE_LABELS[user.role]}</Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    {user.isActive ? <Badge tone="success">Faol</Badge> : <Badge tone="danger">Bloklangan</Badge>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-coffee-500">
                    {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setDraft({
                            id: user.id,
                            email: user.email,
                            fullName: user.fullName,
                            role: user.role,
                            password: "",
                            isActive: user.isActive,
                          })
                        }
                      >
                        Tahrir
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void toggleActive(user)}>
                        {user.isActive ? "Bloklash" : "Faollashtirish"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <Modal
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Xodimni tahrirlash" : "Yangi xodim"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraft(null)} disabled={saving}>
              Bekor qilish
            </Button>
            <Button type="submit" form="staff-form" loading={saving}>
              Saqlash
            </Button>
          </>
        }
      >
        {draft ? (
          <form id="staff-form" onSubmit={save} className="space-y-3">
            {!draft.id ? (
              <Field label="Email" htmlFor="s-email">
                <Input
                  id="s-email"
                  type="email"
                  required
                  value={draft.email}
                  onChange={(event) => setDraft({ ...draft, email: event.target.value })}
                />
              </Field>
            ) : (
              <p className="rounded-lg bg-cream-100 px-3 py-2 text-xs text-coffee-500">
                Email: {draft.email} (o&apos;zgartirilmaydi)
              </p>
            )}
            <Field label="F.I.Sh." htmlFor="s-name">
              <Input
                id="s-name"
                required
                value={draft.fullName}
                onChange={(event) => setDraft({ ...draft, fullName: event.target.value })}
              />
            </Field>
            <Field label="Rol" htmlFor="s-role">
              <Select
                id="s-role"
                value={draft.role}
                onChange={(event) => setDraft({ ...draft, role: event.target.value as Role })}
              >
                {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={draft.id ? "Yangi parol (ixtiyoriy)" : "Parol"}
              htmlFor="s-password"
              hint="Kamida 8 belgi. Parol hech qachon qaytarib ko'rsatilmaydi."
            >
              <Input
                id="s-password"
                type="password"
                autoComplete="new-password"
                required={!draft.id}
                minLength={draft.id ? undefined : 8}
                value={draft.password}
                onChange={(event) => setDraft({ ...draft, password: event.target.value })}
              />
            </Field>
            {draft.id ? (
              <div className="flex items-center gap-3">
                <Switch
                  checked={draft.isActive}
                  onChange={(value) => setDraft({ ...draft, isActive: value })}
                  label="Faol xodim"
                />
                <span className="text-sm text-coffee-700">Faol</span>
              </div>
            ) : null}
            {formError ? (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </p>
            ) : null}
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
