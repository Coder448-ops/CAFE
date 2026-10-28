import { getDb } from "@/server/db/client";
import { nowIso } from "@/shared/lib/datetime";

/**
 * Realtime bus backed by the database.
 *
 * Every domain change that other devices must see is appended to
 * `realtime_events`. SSE endpoints tail this table using the autoincrement id as
 * a cursor (`Last-Event-ID`), which gives ordered delivery plus replay after a
 * reconnect without needing an external broker.
 */
export type RealtimeScope = "pos" | "kitchen" | "admin" | `table:${number}`;

/**
 * Event payloads intentionally carry only identifiers and status hints —
 * never money or personal data. Subscribers re-fetch authoritative state from
 * the API on every event, which is what keeps the kitchen from ever seeing
 * payment information.
 */
export function publishEvent(scope: RealtimeScope, type: string, payload: Record<string, unknown>): void {
  getDb()
    .prepare("INSERT INTO realtime_events (type, scope, payload, created_at) VALUES (?, ?, ?, ?)")
    .run(type, scope, JSON.stringify(payload), nowIso());
}

export function readEventsSince(scopes: readonly string[], afterId: number, limit = 100) {
  const placeholders = scopes.map(() => "?").join(", ");
  return getDb()
    .prepare(
      `SELECT id, type, scope, payload, created_at AS createdAt
         FROM realtime_events
        WHERE id > ? AND scope IN (${placeholders})
        ORDER BY id ASC
        LIMIT ?`,
    )
    .all(afterId, ...scopes, limit) as Array<{
    id: number;
    type: string;
    scope: string;
    payload: string;
    createdAt: string;
  }>;
}

export function latestEventId(): number {
  const row = getDb().prepare("SELECT COALESCE(MAX(id), 0) AS id FROM realtime_events").get() as { id: number };
  return row.id;
}

/** Keeps the event log bounded; called opportunistically by the SSE route. */
export function pruneEvents(keep = 5000): void {
  const db = getDb();
  const row = db.prepare("SELECT COALESCE(MAX(id), 0) AS id FROM realtime_events").get() as { id: number };
  if (row.id <= keep) return;
  db.prepare("DELETE FROM realtime_events WHERE id <= ?").run(row.id - keep);
}
