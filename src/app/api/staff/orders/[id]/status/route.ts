import { NextResponse } from "next/server";
import { POS_ROLES, requireStaff } from "@/server/auth/session";
import { actorFromStaff } from "@/server/http/actor";
import { numericParam, parseBody, route } from "@/server/http/handler";
import { orderStatusUpdateSchema } from "@/shared/validation/schemas";
import { changeOrderStatus } from "@/server/services/orders";
import { badRequest } from "@/server/http/errors";

export const POST = route<{ params: Promise<{ id: string }> }>(async (request, context) => {
  const staff = await requireStaff(POS_ROLES);
  const { id } = await context.params;
  const input = await parseBody(request, orderStatusUpdateSchema);
  if (input.status === "cancelled" && !input.reason) {
    throw badRequest("Bekor qilish sababini yozing");
  }
  const order = changeOrderStatus({
    orderId: numericParam(id),
    status: input.status,
    reason: input.reason ?? null,
    actorUserId: staff.user.id,
    actor: actorFromStaff(staff),
  });
  return NextResponse.json({ order });
});
