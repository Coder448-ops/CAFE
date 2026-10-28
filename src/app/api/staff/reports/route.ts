import { NextResponse } from "next/server";
import { ADMIN_ROLES, POS_ROLES, requireStaff } from "@/server/auth/session";
import { NO_STORE, route } from "@/server/http/handler";
import { getReports, todayRange } from "@/server/services/reports";
import { assertValidDate } from "@/shared/lib/datetime";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  await requireStaff([...ADMIN_ROLES, ...POS_ROLES]);
  const params = request.nextUrl.searchParams;
  const fallback = todayRange();
  const from = params.get("from") ?? fallback.fromDate;
  const to = params.get("to") ?? fallback.toDate;
  assertValidDate(from);
  assertValidDate(to);
  return NextResponse.json(getReports(from, to), NO_STORE);
});
