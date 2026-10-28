import { NextResponse } from "next/server";
import { ADMIN_ROLES, requireStaff } from "@/server/auth/session";
import { NO_STORE, route } from "@/server/http/handler";
import { getDb } from "@/server/db/client";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  await requireStaff(ADMIN_ROLES);
  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit") ?? 100), 1), 500);
  const rows = getDb()
    .prepare(
      `SELECT id, actor_label, actor_role, action, entity_type, entity_id, details, created_at
         FROM audit_logs ORDER BY id DESC LIMIT ?`,
    )
    .all(limit) as Array<{
    id: number;
    actor_label: string;
    actor_role: string;
    action: string;
    entity_type: string;
    entity_id: string | null;
    details: string | null;
    created_at: string;
  }>;
  return NextResponse.json(
    {
      entries: rows.map((row) => ({
        id: row.id,
        actorLabel: row.actor_label,
        actorRole: row.actor_role,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        details: row.details ? safeParse(row.details) : null,
        createdAt: row.created_at,
      })),
    },
    NO_STORE,
  );
});

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
