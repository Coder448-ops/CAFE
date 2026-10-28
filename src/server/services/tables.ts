import { getDb, transaction } from "@/server/db/client";
import { config } from "@/server/config";
import { conflict, notFound, unprocessable } from "@/server/http/errors";
import { randomToken, sha256 } from "@/server/lib/ids";
import { formatTime, nowIso } from "@/shared/lib/datetime";
import type { RestaurantTable, TableDevice } from "@/shared/types/domain";
import type { TableInput } from "@/shared/validation/schemas";

type TableRow = {
  id: number;
  code: string;
  label: string;
  zone: string;
  seats: number;
  is_active: number;
  open_session_id: number | null;
  session_opened_at: string | null;
  active_orders: number;
  unpaid_tiyin: number;
};

export function listTables(options: { includeInactive?: boolean } = {}): RestaurantTable[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT t.id, t.code, t.label, t.zone, t.seats, t.is_active,
              s.id AS open_session_id, s.opened_at AS session_opened_at,
              (SELECT COUNT(*) FROM orders o
                WHERE o.table_session_id = s.id
                  AND o.status NOT IN ('completed', 'cancelled')) AS active_orders,
              (SELECT COALESCE(SUM(o.total_tiyin - o.paid_tiyin), 0) FROM orders o
                WHERE o.table_session_id = s.id
                  AND o.payment_status <> 'paid'
                  AND o.status <> 'cancelled') AS unpaid_tiyin
         FROM restaurant_tables t
         LEFT JOIN table_sessions s ON s.table_id = t.id AND s.status = 'open'
        ${options.includeInactive ? "" : "WHERE t.is_active = 1"}
        ORDER BY t.code ASC`,
    )
    .all() as TableRow[];
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    label: row.label,
    zone: row.zone,
    seats: row.seats,
    isActive: row.is_active === 1,
    openSessionId: row.open_session_id,
    sessionOpenedAt: row.session_opened_at,
    activeOrders: row.active_orders ?? 0,
    unpaidTiyin: row.unpaid_tiyin ?? 0,
  }));
}

export function getTable(id: number): RestaurantTable {
  const table = listTables({ includeInactive: true }).find((candidate) => candidate.id === id);
  if (!table) throw notFound("Stol topilmadi");
  return table;
}

export function createTable(input: TableInput): number {
  const db = getDb();
  if (db.prepare("SELECT id FROM restaurant_tables WHERE code = ?").get(input.code)) {
    throw conflict("Bu kodli stol allaqachon mavjud");
  }
  const now = nowIso();
  const result = db
    .prepare(
      `INSERT INTO restaurant_tables (code, label, zone, seats, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(input.code, input.label, input.zone, input.seats, input.isActive ? 1 : 0, now, now);
  return Number(result.lastInsertRowid);
}

export function updateTable(id: number, input: TableInput): void {
  const db = getDb();
  getTable(id);
  const duplicate = db
    .prepare("SELECT id FROM restaurant_tables WHERE code = ? AND id <> ?")
    .get(input.code, id);
  if (duplicate) throw conflict("Bu kodli stol allaqachon mavjud");
  db.prepare(
    `UPDATE restaurant_tables SET code = ?, label = ?, zone = ?, seats = ?, is_active = ?, updated_at = ?
      WHERE id = ?`,
  ).run(input.code, input.label, input.zone, input.seats, input.isActive ? 1 : 0, nowIso(), id);
}

// ------------------------------------------------------------- sessions ---
export type OpenSession = {
  id: number;
  tableId: number;
  openedAt: string;
  guests: number | null;
  notes: string | null;
};

export function findOpenSession(tableId: number): OpenSession | null {
  const row = getDb()
    .prepare(
      `SELECT id, table_id, opened_at, guests, notes FROM table_sessions
        WHERE table_id = ? AND status = 'open' LIMIT 1`,
    )
    .get(tableId) as
    | { id: number; table_id: number; opened_at: string; guests: number | null; notes: string | null }
    | undefined;
  if (!row) return null;
  return { id: row.id, tableId: row.table_id, openedAt: row.opened_at, guests: row.guests, notes: row.notes };
}

/** Called internally inside a transaction when the first order of a visit arrives. */
export function ensureOpenSession(tableId: number, actorUserId: number | null): OpenSession {
  const existing = findOpenSession(tableId);
  if (existing) return existing;
  const db = getDb();
  const now = nowIso();
  const result = db
    .prepare(
      `INSERT INTO table_sessions (table_id, status, opened_at, opened_by) VALUES (?, 'open', ?, ?)`,
    )
    .run(tableId, now, actorUserId);
  return { id: Number(result.lastInsertRowid), tableId, openedAt: now, guests: null, notes: null };
}

export function openSession(tableId: number, actorUserId: number, guests?: number, notes?: string): OpenSession {
  getTable(tableId);
  return transaction(() => {
    const existing = findOpenSession(tableId);
    if (existing) throw conflict("Bu stolda allaqachon ochiq sessiya bor");
    const db = getDb();
    const now = nowIso();
    const result = db
      .prepare(
        `INSERT INTO table_sessions (table_id, status, opened_at, opened_by, guests, notes)
         VALUES (?, 'open', ?, ?, ?, ?)`,
      )
      .run(tableId, now, actorUserId, guests ?? null, notes ?? null);
    return { id: Number(result.lastInsertRowid), tableId, openedAt: now, guests: guests ?? null, notes: notes ?? null };
  });
}

export function closeSession(sessionId: number, actorUserId: number): void {
  transaction(() => {
    const db = getDb();
    const session = db
      .prepare("SELECT id, table_id, status FROM table_sessions WHERE id = ?")
      .get(sessionId) as { id: number; table_id: number; status: string } | undefined;
    if (!session) throw notFound("Sessiya topilmadi");
    if (session.status !== "open") throw conflict("Sessiya allaqachon yopilgan");

    const outstanding = db
      .prepare(
        `SELECT COUNT(*) AS count, COALESCE(SUM(total_tiyin - paid_tiyin), 0) AS due
           FROM orders
          WHERE table_session_id = ? AND status <> 'cancelled' AND payment_status <> 'paid'`,
      )
      .get(sessionId) as { count: number; due: number };
    if (outstanding.count > 0 || outstanding.due > 0) {
      throw unprocessable("Sessiyani yopishdan oldin barcha buyurtmalar to'lanishi kerak");
    }
    const openOrders = db
      .prepare(
        `SELECT COUNT(*) AS count FROM orders
          WHERE table_session_id = ? AND status NOT IN ('completed', 'cancelled')`,
      )
      .get(sessionId) as { count: number };
    if (openOrders.count > 0) {
      db.prepare(
        `UPDATE orders SET status = 'completed', completed_at = COALESCE(completed_at, ?), updated_at = ?
          WHERE table_session_id = ? AND status NOT IN ('completed', 'cancelled')`,
      ).run(nowIso(), nowIso(), sessionId);
    }
    db.prepare(
      `UPDATE table_sessions SET status = 'closed', closed_at = ?, closed_by = ? WHERE id = ?`,
    ).run(nowIso(), actorUserId, sessionId);
  });
}

// ------------------------------------------------------- device pairing ---
const PAIRING_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I

function generatePairingCode(): string {
  const bytes = Buffer.from(randomToken(16), "base64url");
  let code = "";
  for (let index = 0; index < 8; index += 1) {
    code += PAIRING_ALPHABET[(bytes[index] ?? 0) % PAIRING_ALPHABET.length];
  }
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export type PairingCode = { code: string; expiresAt: string; tableId: number; tableLabel: string };

/**
 * Creates a single-use pairing code valid for 10 minutes. Only the hash is
 * stored, so a database leak does not expose usable pairing codes.
 */
export function createPairingCode(tableId: number, actorUserId: number): PairingCode {
  const table = getTable(tableId);
  const db = getDb();
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generatePairingCode();
    try {
      db.prepare(
        `INSERT INTO table_pairing_codes (table_id, code_hash, created_at, expires_at, created_by)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(tableId, sha256(code), nowIso(), expiresAt, actorUserId);
      return { code, expiresAt, tableId, tableLabel: table.label };
    } catch {
      // collision on code_hash — retry with a fresh code
    }
  }
  throw conflict("Kod yaratib bo'lmadi, qayta urinib ko'ring");
}

export type PairedDevice = { deviceToken: string; tableId: number; tableLabel: string; expiresAt: string };

/**
 * Redeems a pairing code for a long-lived device token. The raw token is
 * returned to the caller exactly once (stored in an HttpOnly cookie); the
 * database keeps only its SHA-256 hash.
 */
export function redeemPairingCode(rawCode: string): PairedDevice {
  const code = rawCode.trim().toUpperCase().replace(/\s/g, "");
  const normalized = /^[A-Z0-9]{8}$/.test(code) ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
  return transaction(() => {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT c.id, c.table_id, c.expires_at, c.used_at, t.label, t.is_active
           FROM table_pairing_codes c
           JOIN restaurant_tables t ON t.id = c.table_id
          WHERE c.code_hash = ?`,
      )
      .get(sha256(normalized)) as
      | { id: number; table_id: number; expires_at: string; used_at: string | null; label: string; is_active: number }
      | undefined;
    if (!row) throw unprocessable("Kod topilmadi yoki noto'g'ri");
    if (row.used_at) throw unprocessable("Bu kod allaqachon ishlatilgan");
    if (!row.is_active) throw unprocessable("Stol faol emas");
    if (new Date(row.expires_at).getTime() <= Date.now()) throw unprocessable("Kod muddati tugagan");

    const deviceToken = randomToken(32);
    const expiresAt = new Date(Date.now() + config.tableDeviceTtlDays * 86_400_000).toISOString();
    db.prepare(
      `INSERT INTO table_devices (table_id, token_hash, label, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(row.table_id, sha256(deviceToken), "Mijoz qurilmasi", nowIso(), expiresAt);
    db.prepare("UPDATE table_pairing_codes SET used_at = ? WHERE id = ?").run(nowIso(), row.id);
    return { deviceToken, tableId: row.table_id, tableLabel: row.label, expiresAt };
  });
}

export type ResolvedDevice = {
  deviceId: number;
  tableId: number;
  tableCode: string;
  tableLabel: string;
  zone: string;
  tableIsActive: boolean;
};

export function resolveDeviceToken(token: string | undefined | null): ResolvedDevice | null {
  if (!token) return null;
  const row = getDb()
    .prepare(
      `SELECT d.id, d.table_id, d.expires_at, d.revoked_at, t.code, t.label, t.zone, t.is_active
         FROM table_devices d
         JOIN restaurant_tables t ON t.id = d.table_id
        WHERE d.token_hash = ?`,
    )
    .get(sha256(token)) as
    | {
        id: number;
        table_id: number;
        expires_at: string;
        revoked_at: string | null;
        code: string;
        label: string;
        zone: string;
        is_active: number;
      }
    | undefined;
  if (!row || row.revoked_at) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;
  return {
    deviceId: row.id,
    tableId: row.table_id,
    tableCode: row.code,
    tableLabel: row.label,
    zone: row.zone,
    tableIsActive: row.is_active === 1,
  };
}

export function touchDevice(deviceId: number): void {
  getDb().prepare("UPDATE table_devices SET last_seen_at = ? WHERE id = ?").run(nowIso(), deviceId);
}

export function listDevices(tableId?: number): TableDevice[] {
  const rows = getDb()
    .prepare(
      `SELECT id, table_id, label, created_at, last_seen_at, expires_at, revoked_at
         FROM table_devices
        ${tableId ? "WHERE table_id = ?" : ""}
        ORDER BY created_at DESC`,
    )
    .all(...(tableId ? [tableId] : [])) as Array<{
    id: number;
    table_id: number;
    label: string | null;
    created_at: string;
    last_seen_at: string | null;
    expires_at: string;
    revoked_at: string | null;
  }>;
  return rows.map((row) => ({
    id: row.id,
    tableId: row.table_id,
    label: row.label,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  }));
}

export function revokeDevice(deviceId: number): void {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM table_devices WHERE id = ?").get(deviceId);
  if (!existing) throw notFound("Qurilma topilmadi");
  db.prepare("UPDATE table_devices SET revoked_at = ? WHERE id = ?").run(nowIso(), deviceId);
}

export function openTablesForOverview(): Array<RestaurantTable & { sessionDuration: string | null }> {
  return listTables().map((table) => ({
    ...table,
    sessionDuration: table.sessionOpenedAt ? formatTime(table.sessionOpenedAt) : null,
  }));
}
