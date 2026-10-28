import { NextResponse } from "next/server";
import { ADMIN_ROLES, requireStaff } from "@/server/auth/session";
import { actorFromStaff } from "@/server/http/actor";
import { numericParam, route } from "@/server/http/handler";
import { revokeDevice } from "@/server/services/tables";
import { logAudit } from "@/server/audit";

export const DELETE = route<{ params: Promise<{ id: string }> }>(async (_request, context) => {
  const staff = await requireStaff(ADMIN_ROLES);
  const { id } = await context.params;
  const deviceId = numericParam(id);
  revokeDevice(deviceId);
  logAudit({
    actor: actorFromStaff(staff),
    action: "table.device_revoked",
    entityType: "table_device",
    entityId: deviceId,
  });
  return NextResponse.json({ ok: true });
});
