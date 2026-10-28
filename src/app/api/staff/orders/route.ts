import { NextResponse } from "next/server";
import { POS_ROLES, requireStaff } from "@/server/auth/session";
import { listOrders } from "@/server/services/orders";
import { NO_STORE, route } from "@/server/http/handler";
import type { OrderStatus } from "@/shared/types/domain";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  await requireStaff(POS_ROLES);
  const params = request.nextUrl.searchParams;
  const rawStatus = params.get("status") ?? "active";
  // "active" is a pseudo-status understood by the service; anything else must be
  // a real order status or it will simply return no rows.
  const status = rawStatus as OrderStatus | "active" | "all";
  const orders = listOrders({
    status,
    tableId: params.get("tableId") ? Number(params.get("tableId")) : undefined,
    businessDate: params.get("date") ?? undefined,
    paymentStatus: (params.get("paymentStatus") as never) ?? undefined,
    search: params.get("q") ?? undefined,
    limit: params.get("limit") ? Number(params.get("limit")) : undefined,
  });
  return NextResponse.json({ orders }, NO_STORE);
});
