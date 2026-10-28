import { NextResponse } from "next/server";
import { loginSchema } from "@/shared/validation/schemas";
import { authenticateStaff } from "@/server/services/staff";
import { createSession, SESSION_COOKIE } from "@/server/auth/session";
import { clientIp, parseBody, rateLimit, route } from "@/server/http/handler";
import { logAudit } from "@/server/audit";
import { config } from "@/server/config";
import { unauthorized } from "@/server/http/errors";
import { ROLE_HOME } from "@/shared/constants/orders";

export const POST = route(async (request) => {
  const ip = clientIp(request) ?? "unknown";
  rateLimit(`login:${ip}`, 10, 5 * 60_000);

  const input = await parseBody(request, loginSchema);
  const user = authenticateStaff(input.email, input.password);
  if (!user) throw unauthorized("Email yoki parol noto'g'ri");

  const { token, expiresAt } = createSession(user.id, {
    userAgent: request.headers.get("user-agent"),
    ip,
  });

  const response = NextResponse.json({
    user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
    redirectTo: ROLE_HOME[user.role],
  });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProduction,
    path: "/",
    expires: new Date(expiresAt),
  });

  logAudit({
    actor: { userId: user.id, label: user.fullName, role: user.role },
    action: "auth.login",
    entityType: "user",
    entityId: user.id,
    ip,
  });

  return response;
});
