import { NextResponse } from "next/server";
import { ADMIN_ROLES, requireStaff } from "@/server/auth/session";
import { actorFromStaff } from "@/server/http/actor";
import { numericParam, parseBody, route } from "@/server/http/handler";
import { archiveCategory, updateCategory } from "@/server/services/menu";
import { categorySchema } from "@/shared/validation/schemas";
import { logAudit } from "@/server/audit";

export const PATCH = route<{ params: Promise<{ id: string }> }>(async (request, context) => {
  const staff = await requireStaff(ADMIN_ROLES);
  const { id } = await context.params;
  const categoryId = numericParam(id);
  const input = await parseBody(request, categorySchema);
  updateCategory(categoryId, input);
  logAudit({
    actor: actorFromStaff(staff),
    action: "category.updated",
    entityType: "menu_category",
    entityId: categoryId,
    details: input,
  });
  return NextResponse.json({ ok: true });
});

export const DELETE = route<{ params: Promise<{ id: string }> }>(async (_request, context) => {
  const staff = await requireStaff(ADMIN_ROLES);
  const { id } = await context.params;
  const categoryId = numericParam(id);
  archiveCategory(categoryId);
  logAudit({
    actor: actorFromStaff(staff),
    action: "category.archived",
    entityType: "menu_category",
    entityId: categoryId,
  });
  return NextResponse.json({ ok: true });
});
