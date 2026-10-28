import { NextResponse } from "next/server";
import { POS_ROLES, requireStaff } from "@/server/auth/session";
import { actorFromStaff } from "@/server/http/actor";
import { numericParam, parseBody, route } from "@/server/http/handler";
import { closeSession, openSession } from "@/server/services/tables";
import { tableSessionSchema } from "@/shared/validation/schemas";
import { logAudit } from "@/server/audit";
import { badRequest } from "@/server/http/errors";
import { publishEvent } from "@/server/realtime/bus";

export const POST = route<{ params: Promise<{ id: string }> }>(async (request, context) => {
  const staff = await requireStaff(POS_ROLES);
  const { id } = await context.params;
  const tableId = numericParam(id);
  const input = await parseBody(request, tableSessionSchema);
  const session = openSession(tableId, staff.user.id, input.guests, input.notes);
  publishEvent("pos", "session.updated", { tableId, sessionId: session.id });
  logAudit({
    actor: actorFromStaff(staff),
    action: "session.opened",
    entityType: "table_session",
    entityId: session.id,
    details: { tableId },
  });
  return NextResponse.json({ session }, { status: 201 });
});

export const DELETE = route<{ params: Promise<{ id: string }> }>(async (request, context) => {
  const staff = await requireStaff(POS_ROLES);
  const { id } = await context.params;
  const tableId = numericParam(id);
  const sessionId = Number(request.nextUrl.searchParams.get("sessionId"));
  if (!Number.isInteger(sessionId) || sessionId <= 0) throw badRequest("sessionId kerak");
  closeSession(sessionId, staff.user.id);
  publishEvent("pos", "session.updated", { tableId, sessionId });
  logAudit({
    actor: actorFromStaff(staff),
    action: "session.closed",
    entityType: "table_session",
    entityId: sessionId,
    details: { tableId },
  });
  return NextResponse.json({ ok: true });
});
