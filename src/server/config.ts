import path from "node:path";
import { RESTAURANT_TIME_ZONE } from "@/shared/lib/timezone";

/**
 * Central environment configuration. Server-only.
 * Fails loudly in production when critical secrets are missing instead of
 * silently falling back to a development default.
 */
function readSecret(): string {
  const value = process.env.LOLA_SECRET;
  const isProd = process.env.NODE_ENV === "production";
  if (value && value.length >= 16) return value;
  if (isProd) {
    throw new Error(
      "LOLA_SECRET must be set to a random string of at least 16 characters in production.",
    );
  }
  return "lola-cafe-development-secret-do-not-use-in-production";
}

export const config = {
  dbPath: path.resolve(process.cwd(), process.env.LOLA_DB_PATH ?? "./data/lola.db"),
  secret: readSecret(),
  isProduction: process.env.NODE_ENV === "production",
  /** Restaurant operating timezone — all business days/reports use this. */
  timeZone: RESTAURANT_TIME_ZONE,
  currency: "UZS",
  sessionTtlDays: 7,
  tableDeviceTtlDays: 30,
  brand: {
    name: "LOLA CAFE",
  },
} as const;
