import { NextResponse } from "next/server";
import { ADMIN_ROLES, requireStaff } from "@/server/auth/session";
import { actorFromStaff } from "@/server/http/actor";
import { numericParam, parseBody, route } from "@/server/http/handler";
import { updateTable } from "@/server/services/tables";
import { tableSchema } from "@/shared/validation/schemas";
import { logAudit } from "@/server/audit";

export const PATCH = route<{ params: Promise<{ id: string }> }>(async (request, context) => {
  const staff = await requireStaff(ADMIN_ROLES);
  const { id } = await context.params;
  const tableId = numericParam(id);
  const input = await parseBody(request, tableSchema);
  updateTable(tableId, input);
  logAudit({
    actor: actorFromStaff(staff),
    action: "table.updated",
    entityType: "restaurant_table",
    entityId: tableId,
    details: input,
  });
  return NextResponse.json({ ok: true });
});
