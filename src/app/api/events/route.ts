import { createEventStream } from "@/server/realtime/sse";
import { requireStaff } from "@/server/auth/session";
import { route } from "@/server/http/handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Role-scoped staff stream. Kitchen staff never receive cashier/admin events. */
export const GET = route(async (request) => {
  const staff = await requireStaff();
  const scopes =
    staff.user.role === "admin"
      ? ["pos", "kitchen", "admin"]
      : staff.user.role === "cashier"
        ? ["pos"]
        : ["kitchen"];
  return createEventStream(request, scopes);
});
