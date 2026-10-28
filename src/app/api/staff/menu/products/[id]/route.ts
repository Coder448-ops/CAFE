import { NextResponse } from "next/server";
import { ADMIN_ROLES, requireStaff } from "@/server/auth/session";
import { actorFromStaff } from "@/server/http/actor";
import { numericParam, parseBody, route } from "@/server/http/handler";
import { archiveProduct, updateProduct } from "@/server/services/menu";
import { productSchema } from "@/shared/validation/schemas";
import { logAudit } from "@/server/audit";

export const PATCH = route<{ params: Promise<{ id: string }> }>(async (request, context) => {
  const staff = await requireStaff(ADMIN_ROLES);
  const { id } = await context.params;
  const productId = numericParam(id);
  const input = await parseBody(request, productSchema);
  updateProduct(productId, input);
  logAudit({
    actor: actorFromStaff(staff),
    action: "product.updated",
    entityType: "product",
    entityId: productId,
    details: { name: input.nameUz, priceTiyin: input.priceTiyin },
  });
  return NextResponse.json({ ok: true });
});

export const DELETE = route<{ params: Promise<{ id: string }> }>(async (_request, context) => {
  const staff = await requireStaff(ADMIN_ROLES);
  const { id } = await context.params;
  const productId = numericParam(id);
  archiveProduct(productId);
  logAudit({
    actor: actorFromStaff(staff),
    action: "product.archived",
    entityType: "product",
    entityId: productId,
  });
  return NextResponse.json({ ok: true });
});
