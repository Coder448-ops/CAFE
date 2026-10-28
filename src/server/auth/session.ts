import { cookies } from "next/headers";
import { getDb } from "@/server/db/client";
import { config } from "@/server/config";
import { randomToken, sha256 } from "@/server/lib/ids";
import { nowIso } from "@/shared/lib/datetime";
import { ApiError, forbidden, unauthorized } from "@/server/http/errors";
import type { Role, StaffUser } from "@/shared/types/domain";

export const SESSION_COOKIE = "lola_session";
export const TABLE_DEVICE_COOKIE = "lola_table";

type SessionRow = {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  user_email: string;
  user_name: string;
  user_role: Role;
  user_active: number;
  user_created_at: string;
  user_last_login_at: string | null;
};

export type AuthenticatedStaff = {
  sessionId: number;
  user: StaffUser;
};

function mapUser(row: SessionRow): StaffUser {
  return {
    id: row.user_id,
    email: row.user_email,
    fullName: row.user_name,
    role: row.user_role,
    isActive: row.user_active === 1,
    createdAt: row.user_created_at,
    lastLoginAt: row.user_last_login_at,
  };
}

export function createSession(
  userId: number,
  meta: { userAgent?: string | null; ip?: string | null } = {},
): { token: string; expiresAt: string } {
  const db = getDb();
  const token = randomToken(32);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.sessionTtlDays * 86_400_000).toISOString();
  db.prepare(
    `INSERT INTO user_sessions (user_id, token_hash, created_at, expires_at, last_seen_at, user_agent, ip)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(userId, sha256(token), now.toISOString(), expiresAt, now.toISOString(), meta.userAgent ?? null, meta.ip ?? null);
  return { token, expiresAt };
}

export function resolveSessionToken(token: string | undefined | null): AuthenticatedStaff | null {
  if (!token) return null;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT s.id, s.user_id, s.token_hash, s.expires_at, s.revoked_at,
              u.email AS user_email, u.full_name AS user_name, u.role AS user_role,
              u.is_active AS user_active, u.created_at AS user_created_at,
              u.last_login_at AS user_last_login_at
         FROM user_sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ?`,
    )
    .get(sha256(token)) as SessionRow | undefined;
  if (!row) return null;
  if (row.revoked_at) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;
  if (row.user_active !== 1) return null;
  return { sessionId: row.id, user: mapUser(row) };
}

export function revokeSessionByToken(token: string | undefined | null): void {
  if (!token) return;
  getDb()
    .prepare("UPDATE user_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL")
    .run(nowIso(), sha256(token));
}

/** Reads the current staff session from the request cookies. */
export async function getCurrentStaff(): Promise<AuthenticatedStaff | null> {
  const store = await cookies();
  return resolveSessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function requireStaff(allowed?: readonly Role[]): Promise<AuthenticatedStaff> {
  const staff = await getCurrentStaff();
  if (!staff) throw unauthorized();
  if (allowed && !allowed.includes(staff.user.role)) throw forbidden();
  return staff;
}

/** Only admins may manage staff, settings and destructive operations. */
export const ADMIN_ROLES: readonly Role[] = ["admin"];
/** Cashiers and admins share POS capabilities. */
export const POS_ROLES: readonly Role[] = ["admin", "cashier"];
/** Kitchen displays plus admins can move tickets. */
export const KITCHEN_ROLES: readonly Role[] = ["admin", "kitchen"];

export function touchSession(sessionId: number): void {
  getDb().prepare("UPDATE user_sessions SET last_seen_at = ? WHERE id = ?").run(nowIso(), sessionId);
}

export function assertPasswordStrength(password: string): void {
  if (password.length < 8) {
    throw new ApiError(400, "WEAK_PASSWORD", "Parol kamida 8 belgidan iborat bo'lishi kerak");
  }
}
