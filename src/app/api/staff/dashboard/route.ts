import { NextResponse } from "next/server";
import { ADMIN_ROLES, POS_ROLES, requireStaff } from "@/server/auth/session";
import { NO_STORE, route } from "@/server/http/handler";
import { dashboardSnapshot } from "@/server/services/reports";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireStaff([...ADMIN_ROLES, ...POS_ROLES]);
  return NextResponse.json(dashboardSnapshot(), NO_STORE);
});
