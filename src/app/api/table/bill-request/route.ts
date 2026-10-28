import { NextResponse } from "next/server";
import { requireTableDevice, route } from "@/server/http/handler";
import { publishEvent } from "@/server/realtime/bus";
import { logAudit } from "@/server/audit";
import { findOpenSession } from "@/server/services/tables";

export const POST = route(async () => {
  const device = await requireTableDevice();
  const session = findOpenSession(device.tableId);
  publishEvent("pos", "table.bill_requested", {
    tableId: device.tableId,
    tableLabel: device.tableLabel,
    sessionId: session?.id ?? null,
  });
  logAudit({
    actor: { userId: null, label: `Mijoz (${device.tableLabel})`, role: "customer" },
    action: "table.bill_requested",
    entityType: "restaurant_table",
    entityId: device.tableId,
  });
  return NextResponse.json({ ok: true, message: "Ofitsiantga xabar berildi" });
});
