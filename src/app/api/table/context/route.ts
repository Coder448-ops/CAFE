import { NextResponse } from "next/server";
import { NO_STORE, requireTableDevice, route } from "@/server/http/handler";
import { findOpenSession } from "@/server/services/tables";
import { listOrdersForSession } from "@/server/services/orders";
import { getSettings } from "@/server/services/settings";
import type { TableDeviceContext } from "@/shared/types/domain";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const device = await requireTableDevice();
  const session = findOpenSession(device.tableId);
  const orders = session ? listOrdersForSession(session.id) : [];
  const totalTiyin = orders
    .filter((order) => order.status !== "cancelled")
    .reduce((sum, order) => sum + order.totalTiyin, 0);
  const paidTiyin = orders
    .filter((order) => order.status !== "cancelled")
    .reduce((sum, order) => sum + order.paidTiyin, 0);

  const context: TableDeviceContext = {
    tableId: device.tableId,
    tableCode: device.tableCode,
    tableLabel: device.tableLabel,
    zone: device.zone,
    sessionId: session?.id ?? 0,
    sessionOpenedAt: session?.openedAt ?? "",
    orders,
    totalTiyin,
    paidTiyin,
    dueTiyin: Math.max(0, totalTiyin - paidTiyin),
  };

  return NextResponse.json(
    {
      context,
      settings: {
        restaurantName: getSettings().restaurantName,
        currency: getSettings().currency,
      },
    },
    NO_STORE,
  );
});
