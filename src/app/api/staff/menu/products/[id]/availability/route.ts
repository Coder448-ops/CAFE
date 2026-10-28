import { NextResponse } from "next/server";
import { ADMIN_ROLES, POS_ROLES, requireStaff } from "@/server/auth/session";
import { actorFromStaff } from "@/server/http/actor";
import { numericParam, parseBody, route } from "@/server/http/handler";
import { productAvailabilitySchema } from "@/shared/validation/schemas";
import { setProductAvailability } from "@/server/services/menu";
import { logAudit } from "@/server/audit";
import { publishEvent } from "@/server/realtime/bus";

/** Cashiers can stop selling a product immediately when it runs out. */
export const POST = route<{ params: Promise<{ id: string }> }>(async (request, context) => {
  const staff = await requireStaff([...ADMIN_ROLES, ...POS_ROLES]);
  const { id } = await context.params;
  const productId = numericParam(id);
  const input = await parseBody(request, productAvailabilitySchema);
  setProductAvailability(productId, input.isAvailable);
  publishEvent("pos", "menu.updated", { productId });
  logAudit({
    actor: actorFromStaff(staff),
    action: "product.availability_changed",
    entityType: "product",
    entityId: productId,
    details: { isAvailable: input.isAvailable },
  });
  return NextResponse.json({ ok: true });
});
