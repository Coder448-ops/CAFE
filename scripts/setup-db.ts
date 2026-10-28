import { runMigrations } from "../src/server/db/migrate";
import { seedDemoData, DEMO_PASSWORDS } from "../database/seeds/demo";
import { config } from "../src/server/config";

const applied = runMigrations({ log: (message) => console.log(message) });
const result = seedDemoData();
console.log(`Database ready at ${config.dbPath}`);
console.log(`Migrations applied: ${applied.length}; products: ${result.products}`);
console.log(`Demo staff passwords: ${DEMO_PASSWORDS.admin} / ${DEMO_PASSWORDS.cashier} / ${DEMO_PASSWORDS.kitchen}`);
