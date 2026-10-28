import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { config } from "@/server/config";

export type Db = Database.Database;

type GlobalWithDb = typeof globalThis & { __lolaDb?: Db };

/**
 * One connection per Node process. SQLite is accessed synchronously which
 * keeps every business transaction atomic and simple to reason about.
 */
function createConnection(): Db {
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  const db = new Database(config.dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.pragma("synchronous = NORMAL");
  return db;
}

export function getDb(): Db {
  const globalRef = globalThis as GlobalWithDb;
  if (!globalRef.__lolaDb) {
    globalRef.__lolaDb = createConnection();
  }
  return globalRef.__lolaDb;
}

/** Used by tests/migrations to swap in a fresh database file. */
export function closeDb(): void {
  const globalRef = globalThis as GlobalWithDb;
  if (globalRef.__lolaDb) {
    globalRef.__lolaDb.close();
    globalRef.__lolaDb = undefined;
  }
}

/** Run a function inside a write transaction. Rolls back on any throw. */
export function transaction<T>(fn: (db: Db) => T): T {
  const db = getDb();
  const wrapped = db.transaction(fn);
  return wrapped(db);
}
