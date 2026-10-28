import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revokeSessionByToken, SESSION_COOKIE } from "@/server/auth/session";
import { route } from "@/server/http/handler";

export const POST = route(async () => {
  const store = await cookies();
  revokeSessionByToken(store.get(SESSION_COOKIE)?.value);
  const response = NextResponse.json({ ok: true });
  response.cookies.set({ name: SESSION_COOKIE, value: "", path: "/", maxAge: 0 });
  return response;
});
