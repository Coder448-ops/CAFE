import { getDb } from "@/server/db/client";
import { conflict, notFound, unprocessable } from "@/server/http/errors";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { nowIso } from "@/shared/lib/datetime";
import type { StaffUser } from "@/shared/types/domain";
import type { StaffInput, StaffUpdateInput } from "@/shared/validation/schemas";

type UserRow = {
  id: number;
  email: string;
  full_name: string;
  role: StaffUser["role"];
  is_active: number;
  created_at: string;
  last_login_at: string | null;
};

const mapUser = (row: UserRow): StaffUser => ({
  id: row.id,
  email: row.email,
  fullName: row.full_name,
  role: row.role,
  isActive: row.is_active === 1,
  createdAt: row.created_at,
  lastLoginAt: row.last_login_at,
});

export function listStaff(): StaffUser[] {
  const rows = getDb()
    .prepare(
      `SELECT id, email, full_name, role, is_active, created_at, last_login_at
         FROM users ORDER BY role ASC, full_name ASC`,
    )
    .all() as UserRow[];
  return rows.map(mapUser);
}

export function createStaff(input: StaffInput): StaffUser {
  const db = getDb();
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(input.email)) {
    throw conflict("Bu email bilan foydalanuvchi mavjud");
  }
  const now = nowIso();
  const result = db
    .prepare(
      `INSERT INTO users (email, password_hash, full_name, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
    )
    .run(input.email.toLowerCase(), hashPassword(input.password), input.fullName, input.role, now, now);
  const id = Number(result.lastInsertRowid);
  return listStaff().find((user) => user.id === id)!;
}

export function updateStaff(id: number, input: StaffUpdateInput): StaffUser {
  const db = getDb();
  const existing = db.prepare("SELECT id, role, is_active FROM users WHERE id = ?").get(id) as
    | { id: number; role: StaffUser["role"]; is_active: number }
    | undefined;
  if (!existing) throw notFound("Foydalanuvchi topilmadi");

  if (input.isActive === false && existing.role === "admin") {
    const admins = db
      .prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND is_active = 1")
      .get() as { count: number };
    if (admins.count <= 1) throw unprocessable("Oxirgi administratorni o'chirib bo'lmaydi");
  }

  const assignments: string[] = ["updated_at = ?"];
  const params: unknown[] = [nowIso()];
  if (input.fullName !== undefined) {
    assignments.push("full_name = ?");
    params.push(input.fullName);
  }
  if (input.role !== undefined) {
    assignments.push("role = ?");
    params.push(input.role);
  }
  if (input.isActive !== undefined) {
    assignments.push("is_active = ?");
    params.push(input.isActive ? 1 : 0);
  }
  if (input.password !== undefined) {
    assignments.push("password_hash = ?");
    params.push(hashPassword(input.password));
  }
  params.push(id);
  db.prepare(`UPDATE users SET ${assignments.join(", ")} WHERE id = ?`).run(...params);

  if (input.isActive === false || input.password !== undefined) {
    // Force re-authentication after deactivation or password change.
    db.prepare("UPDATE user_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL").run(
      nowIso(),
      id,
    );
  }
  return listStaff().find((user) => user.id === id)!;
}

export function authenticateStaff(email: string, password: string): StaffUser | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, email, password_hash, full_name, role, is_active, created_at, last_login_at
         FROM users WHERE email = ?`,
    )
    .get(email.toLowerCase()) as
    | (UserRow & { password_hash: string })
    | undefined;
  if (!row || row.is_active !== 1) return null;
  if (!verifyPassword(password, row.password_hash)) return null;
  db.prepare("UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?").run(
    nowIso(),
    nowIso(),
    row.id,
  );
  return mapUser(row);
}

export function countAdmins(): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND is_active = 1")
    .get() as { count: number };
  return row.count;
}

/** Used by scripts/create-admin.ts — refuses to silently overwrite a user. */
export function bootstrapAdmin(input: { email: string; password: string; fullName: string }): StaffUser {
  if (input.password.length < 10) {
    throw new Error("Administrator paroli kamida 10 belgidan iborat bo'lishi kerak.");
  }
  if (getDb().prepare("SELECT id FROM users WHERE email = ?").get(input.email.toLowerCase())) {
    throw new Error(`"${input.email}" allaqachon mavjud.`);
  }
  return createStaff({ ...input, role: "admin" });
}
