import { getDb } from "@/server/db/client";
import { nowIso } from "@/shared/lib/datetime";

export type AuditActor = {
  userId: number | null;
  label: string;
  role: string;
};

export function logAudit(input: {
  actor: AuditActor;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  details?: unknown;
  ip?: string | null;
}): void {
  getDb()
    .prepare(
      `INSERT INTO audit_logs (actor_user_id, actor_label, actor_role, action, entity_type, entity_id, details, ip, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.actor.userId,
      input.actor.label,
      input.actor.role,
      input.action,
      input.entityType,
      input.entityId != null ? String(input.entityId) : null,
      input.details ? JSON.stringify(input.details) : null,
      input.ip ?? null,
      nowIso(),
    );
}
