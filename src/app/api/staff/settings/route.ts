import { NextResponse } from "next/server";
import { ADMIN_ROLES, POS_ROLES, requireStaff } from "@/server/auth/session";
import { actorFromStaff } from "@/server/http/actor";
import { NO_STORE, parseBody, route } from "@/server/http/handler";
import { getSettings, updateSettings } from "@/server/services/settings";
import { settingsSchema } from "@/shared/validation/schemas";
import { logAudit } from "@/server/audit";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireStaff([...ADMIN_ROLES, ...POS_ROLES]);
  return NextResponse.json({ settings: getSettings() }, NO_STORE);
});

export const PATCH = route(async (request) => {
  const staff = await requireStaff(ADMIN_ROLES);
  const input = await parseBody(request, settingsSchema);
  const settings = updateSettings(input, staff.user.id);
  logAudit({
    actor: actorFromStaff(staff),
    action: "settings.updated",
    entityType: "app_settings",
    details: input,
  });
  return NextResponse.json({ settings });
});
