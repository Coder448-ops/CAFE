import { NextResponse } from "next/server";
import { ADMIN_ROLES, requireStaff } from "@/server/auth/session";
import { actorFromStaff } from "@/server/http/actor";
import { parseBody, route } from "@/server/http/handler";
import { createProduct } from "@/server/services/menu";
import { productSchema } from "@/shared/validation/schemas";
import { logAudit } from "@/server/audit";

export const POST = route(async (request) => {
  const staff = await requireStaff(ADMIN_ROLES);
  const input = await parseBody(request, productSchema);
  const id = createProduct(input);
  logAudit({
    actor: actorFromStaff(staff),
    action: "product.created",
    entityType: "product",
    entityId: id,
    details: { name: input.nameUz, priceTiyin: input.priceTiyin },
  });
  return NextResponse.json({ id }, { status: 201 });
});
