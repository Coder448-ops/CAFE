import { runMigrations } from "../src/server/db/migrate";
import { bootstrapAdmin } from "../src/server/services/staff";

/**
 * Secure administrator initialisation.
 * Usage:
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='strong-password' ADMIN_NAME='Name' npm run admin:create
 * The password is never printed back and never stored in the repository.
 */
async function main() {
  runMigrations();
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;
  const fullName = process.env.ADMIN_NAME?.trim() || "Administrator";

  if (!email || !password) {
    console.error(
      "ADMIN_EMAIL va ADMIN_PASSWORD muhit o'zgaruvchilari kerak.\n" +
        "Namuna: ADMIN_EMAIL=admin@lolacafe.uz ADMIN_PASSWORD='kuchli-parol' npm run admin:create",
    );
    process.exitCode = 1;
    return;
  }

  try {
    const user = bootstrapAdmin({ email, password, fullName });
    console.log(`Administrator yaratildi: ${user.email} (id: ${user.id})`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

void main();
