import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/server/auth/session";
import { route, NO_STORE } from "@/server/http/handler";
import { getSettings } from "@/server/services/settings";
import { ROLE_HOME } from "@/shared/constants/orders";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const staff = await getCurrentStaff();
  if (!staff) return NextResponse.json({ user: null, settings: null, redirectTo: "/login" }, NO_STORE);
  return NextResponse.json(
    {
      user: staff.user,
      settings: getSettings(),
      redirectTo: ROLE_HOME[staff.user.role],
    },
    NO_STORE,
  );
});
