import { NextResponse } from "next/server";
import { ADMIN_ROLES, requireStaff } from "@/server/auth/session";
import { actorFromStaff } from "@/server/http/actor";
import { parseBody, route } from "@/server/http/handler";
import { createCategory } from "@/server/services/menu";
import { categorySchema } from "@/shared/validation/schemas";
import { logAudit } from "@/server/audit";

export const POST = route(async (request) => {
  const staff = await requireStaff(ADMIN_ROLES);
  const input = await parseBody(request, categorySchema);
  const id = createCategory(input);
  logAudit({
    actor: actorFromStaff(staff),
    action: "category.created",
    entityType: "menu_category",
    entityId: id,
    details: input,
  });
  return NextResponse.json({ id }, { status: 201 });
});
