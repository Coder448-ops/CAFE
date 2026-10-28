import { NextResponse } from "next/server";
import { POS_ROLES, requireStaff } from "@/server/auth/session";
import { NO_STORE, numericParam, route } from "@/server/http/handler";
import { listDevices } from "@/server/services/tables";

export const dynamic = "force-dynamic";

export const GET = route<{ params: Promise<{ id: string }> }>(async (_request, context) => {
  await requireStaff(POS_ROLES);
  const { id } = await context.params;
  return NextResponse.json({ devices: listDevices(numericParam(id)) }, NO_STORE);
});
