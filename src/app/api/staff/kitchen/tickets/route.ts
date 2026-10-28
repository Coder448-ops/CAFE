import { NextResponse } from "next/server";
import { KITCHEN_ROLES, POS_ROLES, requireStaff } from "@/server/auth/session";
import { NO_STORE, route } from "@/server/http/handler";
import { listTickets } from "@/server/services/kitchen";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  await requireStaff([...KITCHEN_ROLES, ...POS_ROLES]);
  const stationParam = request.nextUrl.searchParams.get("station");
  const station = stationParam === "bar" || stationParam === "kitchen" ? stationParam : undefined;
  const includeHistory = request.nextUrl.searchParams.get("history") === "1";
  return NextResponse.json({ tickets: listTickets({ station, includeHistory }) }, NO_STORE);
});
