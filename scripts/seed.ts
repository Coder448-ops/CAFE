import { runMigrations } from "../src/server/db/migrate";
import { seedDemoData, DEMO_PASSWORDS } from "../database/seeds/demo";
import { config } from "../src/server/config";

runMigrations();
const result = seedDemoData({ force: process.argv.includes("--force") });
console.log(`Database: ${config.dbPath}`);
console.log(
  `Seeded: ${result.categories} kategoriya, ${result.products} mahsulot, ${result.tables} stol, ${result.users} foydalanuvchi`,
);
if (result.users > 0) {
  console.log("\nDEMO hisoblar (faqat lokal rivojlantirish uchun!):");
  console.log(`  admin@lolacafe.uz   / ${DEMO_PASSWORDS.admin}`);
  console.log(`  kassir@lolacafe.uz  / ${DEMO_PASSWORDS.cashier}`);
  console.log(`  oshxona@lolacafe.uz / ${DEMO_PASSWORDS.kitchen}`);
}
