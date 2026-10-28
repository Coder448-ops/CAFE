import { NextResponse } from "next/server";
import { ADMIN_ROLES, requireStaff } from "@/server/auth/session";
import { actorFromStaff } from "@/server/http/actor";
import { NO_STORE, parseBody, route } from "@/server/http/handler";
import { createStaff, listStaff } from "@/server/services/staff";
import { staffSchema } from "@/shared/validation/schemas";
import { logAudit } from "@/server/audit";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireStaff(ADMIN_ROLES);
  return NextResponse.json({ users: listStaff() }, NO_STORE);
});

export const POST = route(async (request) => {
  const staff = await requireStaff(ADMIN_ROLES);
  const input = await parseBody(request, staffSchema);
  const user = createStaff(input);
  logAudit({
    actor: actorFromStaff(staff),
    action: "user.created",
    entityType: "user",
    entityId: user.id,
    details: { email: user.email, role: user.role },
  });
  return NextResponse.json({ user }, { status: 201 });
});
