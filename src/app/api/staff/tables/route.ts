import { NextResponse } from "next/server";
import { ADMIN_ROLES, POS_ROLES, requireStaff } from "@/server/auth/session";
import { actorFromStaff } from "@/server/http/actor";
import { NO_STORE, parseBody, route } from "@/server/http/handler";
import { listTables, createTable } from "@/server/services/tables";
import { tableSchema } from "@/shared/validation/schemas";
import { logAudit } from "@/server/audit";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireStaff(POS_ROLES);
  return NextResponse.json({ tables: listTables({ includeInactive: true }) }, NO_STORE);
});

export const POST = route(async (request) => {
  const staff = await requireStaff(ADMIN_ROLES);
  const input = await parseBody(request, tableSchema);
  const id = createTable(input);
  logAudit({
    actor: actorFromStaff(staff),
    action: "table.created",
    entityType: "restaurant_table",
    entityId: id,
    details: input,
  });
  return NextResponse.json({ id }, { status: 201 });
});
