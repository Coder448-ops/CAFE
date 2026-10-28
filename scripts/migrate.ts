import { runMigrations } from "../src/server/db/migrate";
import { config } from "../src/server/config";

const applied = runMigrations({ log: (message) => console.log(message) });
console.log(
  applied.length > 0
    ? `Migrations complete (${applied.length} new) on ${config.dbPath}`
    : `Database already up to date (${config.dbPath})`,
);
