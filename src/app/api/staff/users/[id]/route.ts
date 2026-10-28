import { NextResponse } from "next/server";
import { ADMIN_ROLES, requireStaff } from "@/server/auth/session";
import { actorFromStaff } from "@/server/http/actor";
import { numericParam, parseBody, route } from "@/server/http/handler";
import { updateStaff } from "@/server/services/staff";
import { staffUpdateSchema } from "@/shared/validation/schemas";
import { logAudit } from "@/server/audit";

export const PATCH = route<{ params: Promise<{ id: string }> }>(async (request, context) => {
  const staff = await requireStaff(ADMIN_ROLES);
  const { id } = await context.params;
  const userId = numericParam(id);
  const input = await parseBody(request, staffUpdateSchema);
  const user = updateStaff(userId, input);
  logAudit({
    actor: actorFromStaff(staff),
    action: "user.updated",
    entityType: "user",
    entityId: userId,
    details: { role: input.role, isActive: input.isActive, passwordChanged: Boolean(input.password) },
  });
  return NextResponse.json({ user });
});
