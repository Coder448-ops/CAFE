import { NextResponse, type NextRequest } from "next/server";
import { latestEventId, pruneEvents, readEventsSince } from "@/server/realtime/bus";

/**
 * Server-Sent Events stream over the database event log.
 *
 * Reliability properties:
 *  - the cursor is the monotonic event id, replayed on reconnect,
 *  - clients always re-fetch authoritative state after any event,
 *  - the stream self-closes after 10 minutes so proxies can recycle it; the
 *    browser's EventSource reconnects automatically and resumes from the id.
 */
export function createEventStream(
  request: NextRequest,
  scopes: readonly string[],
): Response {
  const encoder = new TextEncoder();
  const requestedCursor = Number(
    request.nextUrl.searchParams.get("after") ?? request.headers.get("last-event-id") ?? 0,
  );
  let cursor = Number.isFinite(requestedCursor) && requestedCursor >= 0 ? requestedCursor : 0;
  if (cursor === 0) cursor = latestEventId();

  let closed = false;
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        if (closed) return;
        controller.enqueue(encoder.encode(chunk));
      };

      send(`retry: 3000\n\n`);
      send(`data: ${JSON.stringify({ id: 0, type: "ready", payload: { cursor, scopes } })}\n\n`);

      const flush = () => {
        if (closed) return;
        try {
          const events = readEventsSince(scopes, cursor, 100);
          for (const event of events) {
            cursor = event.id;
            send(`id: ${event.id}\ndata: ${JSON.stringify({
              id: event.id,
              type: event.type,
              scope: event.scope,
              payload: event.payload,
              createdAt: event.createdAt,
            })}\n\n`);
          }
        } catch (error) {
          console.error("[sse] flush failed", error);
        }
      };

      flush();
      pollTimer = setInterval(flush, 1500);
      heartbeatTimer = setInterval(() => send(`: heartbeat\n\n`), 15_000);
      pruneEvents();

      const close = () => {
        if (closed) return;
        closed = true;
        if (pollTimer) clearInterval(pollTimer);
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        try {
          controller.close();
        } catch {
          // already closed by the client
        }
      };

      request.signal.addEventListener("abort", close);
      setTimeout(close, 10 * 60_000);
    },
    cancel() {
      closed = true;
      if (pollTimer) clearInterval(pollTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
