import { getDb } from "@/server/db/client";
import { listProducts } from "@/server/services/menu";
import { listTables } from "@/server/services/tables";
import type { AuditActor } from "@/server/audit";

export const testActor: AuditActor = { userId: 1, label: "Test actor", role: "admin" };

export function productByName(name: string) {
  const product = listProducts().find((candidate) => candidate.nameUz === name);
  if (!product) throw new Error(`Seed product missing: ${name}`);
  return product;
}

export function firstTable() {
  const table = listTables()[0];
  if (!table) throw new Error("Seed table missing");
  return table;
}

export function uniqueKey(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
}

export function adminUserId(): number {
  const row = getDb().prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1").get() as {
    id: number;
  };
  return row.id;
}
