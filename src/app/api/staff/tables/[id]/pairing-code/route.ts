import { NextResponse } from "next/server";
import { POS_ROLES, requireStaff } from "@/server/auth/session";
import { actorFromStaff } from "@/server/http/actor";
import { numericParam, route } from "@/server/http/handler";
import { createPairingCode } from "@/server/services/tables";
import { logAudit } from "@/server/audit";

export const POST = route<{ params: Promise<{ id: string }> }>(async (_request, context) => {
  const staff = await requireStaff(POS_ROLES);
  const { id } = await context.params;
  const tableId = numericParam(id);
  const pairing = createPairingCode(tableId, staff.user.id);
  logAudit({
    actor: actorFromStaff(staff),
    action: "table.pairing_code_created",
    entityType: "restaurant_table",
    entityId: tableId,
  });
  return NextResponse.json({ pairing }, { status: 201 });
});
