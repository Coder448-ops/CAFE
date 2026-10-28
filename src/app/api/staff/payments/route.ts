import { NextResponse } from "next/server";
import { ADMIN_ROLES, POS_ROLES, requireStaff } from "@/server/auth/session";
import { NO_STORE, route } from "@/server/http/handler";
import { listPayments } from "@/server/services/payments";
import { todayRange } from "@/server/services/reports";
import { assertValidDate } from "@/shared/lib/datetime";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  await requireStaff([...ADMIN_ROLES, ...POS_ROLES]);
  const fallback = todayRange();
  const params = request.nextUrl.searchParams;
  const fromDate = params.get("from") ?? fallback.fromDate;
  const toDate = params.get("to") ?? fallback.toDate;
  assertValidDate(fromDate);
  assertValidDate(toDate);
  return NextResponse.json({ payments: listPayments({ fromDate, toDate }) }, NO_STORE);
});
