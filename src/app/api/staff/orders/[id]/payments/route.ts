import { NextResponse } from "next/server";
import { POS_ROLES, requireStaff } from "@/server/auth/session";
import { actorFromStaff } from "@/server/http/actor";
import { numericParam, parseBody, route } from "@/server/http/handler";
import { recordPaymentSchema, refundSchema } from "@/shared/validation/schemas";
import { recordPayment, refundPayment } from "@/server/services/payments";

export const POST = route<{ params: Promise<{ id: string }> }>(async (request, context) => {
  const staff = await requireStaff(POS_ROLES);
  const { id } = await context.params;
  const input = await parseBody(request, recordPaymentSchema);
  const result = recordPayment({
    orderId: numericParam(id),
    input,
    actorUserId: staff.user.id,
    actor: actorFromStaff(staff),
  });
  return NextResponse.json(
    { order: result.order, payment: result.payment, duplicate: result.duplicate },
    { status: result.duplicate ? 200 : 201 },
  );
});

export const PATCH = route<{ params: Promise<{ id: string }> }>(async (request, context) => {
  const staff = await requireStaff(POS_ROLES);
  const { id } = await context.params;
  const orderId = numericParam(id);
  const input = await parseBody(request, refundSchema);
  const order = refundPayment({
    paymentId: input.paymentId,
    amountTiyin: input.amountTiyin,
    reason: input.reason,
    actorUserId: staff.user.id,
    actor: actorFromStaff(staff),
  });
  if (order.id !== orderId) {
    return NextResponse.json({ error: { message: "To'lov boshqa buyurtmaga tegishli" } }, { status: 400 });
  }
  return NextResponse.json({ order });
});
