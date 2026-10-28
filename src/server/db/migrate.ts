import fs from "node:fs";
import path from "node:path";
import { getDb } from "@/server/db/client";

const MIGRATIONS_DIR = path.join(process.cwd(), "database", "migrations");

/**
 * Applies every *.sql migration in lexical order inside its own transaction.
 * Applied files are recorded in schema_migrations so this is safe to re-run.
 */
export function runMigrations(options: { log?: (message: string) => void } = {}): string[] {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    db.prepare("SELECT filename FROM schema_migrations").all().map((r) => (r as { filename: string }).filename),
  );

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const newlyApplied: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    const apply = db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT INTO schema_migrations (filename, applied_at) VALUES (?, ?)").run(
        file,
        new Date().toISOString(),
      );
    });
    apply();
    newlyApplied.push(file);
    options.log?.(`applied migration ${file}`);
  }
  return newlyApplied;
}
