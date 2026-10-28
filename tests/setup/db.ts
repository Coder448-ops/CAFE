import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Each test file gets an isolated SQLite database in a temp directory so tests
 * never touch development data and can run independently.
 */
const dir = mkdtempSync(path.join(tmpdir(), `lola-test-${process.env.VITEST_WORKER_ID ?? "0"}-`));
process.env.LOLA_DB_PATH = path.join(dir, "test.db");
process.env.LOLA_SECRET = "test-secret-key-at-least-16-characters";

const { runMigrations } = await import("@/server/db/migrate");
const { seedDemoData } = await import("../../database/seeds/demo");

runMigrations();
seedDemoData();
