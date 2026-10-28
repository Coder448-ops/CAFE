import { createEventStream } from "@/server/realtime/sse";
import { requireTableDevice, route } from "@/server/http/handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** A table only ever subscribes to its own scope — never another table's data. */
export const GET = route(async (request) => {
  const device = await requireTableDevice();
  return createEventStream(request, [`table:${device.tableId}`]);
});
