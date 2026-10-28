import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, parseBody, rateLimit, route } from "@/server/http/handler";
import { redeemPairingCode } from "@/server/services/tables";
import { TABLE_DEVICE_COOKIE } from "@/server/auth/session";
import { config } from "@/server/config";
import { logAudit } from "@/server/audit";

export const dynamic = "force-dynamic";

const pairSchema = z.object({
  code: z.string().trim().min(4).max(20),
});

/**
 * Redeems a single-use pairing code. The long-lived device token is delivered
 * only as an HttpOnly cookie: the browser never sees or stores it in JS, and
 * the table association is always resolved server-side from the token.
 */
export const POST = route(async (request) => {
  const ip = clientIp(request) ?? "unknown";
  rateLimit(`pair:${ip}`, 12, 5 * 60_000);

  const { code } = await parseBody(request, pairSchema);
  const device = redeemPairingCode(code);

  const response = NextResponse.json({
    ok: true,
    table: { id: device.tableId, label: device.tableLabel },
    redirectTo: "/order",
  });
  response.cookies.set({
    name: TABLE_DEVICE_COOKIE,
    value: device.deviceToken,
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProduction,
    path: "/",
    expires: new Date(device.expiresAt),
  });

  logAudit({
    actor: { userId: null, label: `Stol qurilmasi (${device.tableLabel})`, role: "customer" },
    action: "table.device_paired",
    entityType: "restaurant_table",
    entityId: device.tableId,
    ip,
  });

  return response;
});
