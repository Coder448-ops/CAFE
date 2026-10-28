import { NextResponse } from "next/server";
import { requireTableDevice, parseBody, rateLimit, route } from "@/server/http/handler";
import { actorForDevice } from "@/server/http/actor";
import { createOrderSchema } from "@/shared/validation/schemas";
import { createOrder } from "@/server/services/orders";

export const POST = route(async (request) => {
  const device = await requireTableDevice();
  rateLimit(`order:${device.deviceId}`, 20, 60_000);

  const input = await parseBody(request, createOrderSchema);
  const result = createOrder({
    tableId: device.tableId,
    items: input.items,
    note: input.note ?? null,
    clientRequestId: input.clientRequestId,
    deviceId: device.deviceId,
    actorUserId: null,
    actor: actorForDevice(device.tableCode),
  });

  return NextResponse.json(
    {
      order: result.order,
      duplicate: result.duplicate,
      message: result.duplicate
        ? "Bu buyurtma allaqachon qabul qilingan"
        : "Buyurtmangiz oshxonaga yuborildi",
    },
    { status: result.duplicate ? 200 : 201 },
  );
});
