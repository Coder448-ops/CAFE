"use client";

import * as React from "react";
import type { RealtimeEvent } from "@/shared/types/domain";

export type ConnectionState = "connecting" | "live" | "reconnecting" | "offline";

/**
 * SSE subscription with automatic reconnect (browser EventSource) plus a
 * cursor so missed events replay after a dropped connection. Handlers are
 * expected to re-fetch authoritative state; query polling acts as a safety net.
 */
export function useRealtime(
  onEvent: (event: RealtimeEvent) => void,
  options: { path?: string; enabled?: boolean } = {},
): { state: ConnectionState; lastEventAt: number | null } {
  const { path = "/api/events", enabled = true } = options;
  const handlerRef = React.useRef(onEvent);
  handlerRef.current = onEvent;
  const [state, setState] = React.useState<ConnectionState>(enabled ? "connecting" : "offline");
  const [lastEventAt, setLastEventAt] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof EventSource === "undefined") return;
    let source: EventSource | null = null;
    let cancelled = false;
    let cursor = 0;

    const connect = () => {
      if (cancelled) return;
      source = new EventSource(`${path}?after=${cursor}`);
      source.onopen = () => setState("live");
      source.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data) as RealtimeEvent;
          if (typeof event.id === "number" && event.id > cursor) cursor = event.id;
          if (event.type === "ready") {
            setState("live");
            return;
          }
          setLastEventAt(Date.now());
          handlerRef.current(event);
        } catch {
          // Ignore malformed frames; the next event or poll re-syncs state.
        }
      };
      source.onerror = () => {
        setState((current) => (current === "live" ? "reconnecting" : "offline"));
      };
    };

    connect();
    const onOnline = () => {
      source?.close();
      setState("reconnecting");
      connect();
    };
    window.addEventListener("online", onOnline);
    const watchdog = setInterval(() => {
      if (source && source.readyState === EventSource.CLOSED) {
        setState("reconnecting");
        connect();
      }
    }, 20_000);

    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      clearInterval(watchdog);
      source?.close();
    };
  }, [path, enabled]);

  return { state, lastEventAt };
}
