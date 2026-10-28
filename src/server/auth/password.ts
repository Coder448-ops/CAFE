import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_COST = 16384;
const KEY_LENGTH = 64;

/** scrypt hash: `scrypt$<N>$<saltHex>$<hashHex>` */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password.normalize("NFKC"), salt, KEY_LENGTH, { N: SCRYPT_COST });
  return `scrypt$${SCRYPT_COST}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const cost = Number(parts[1]);
  const salt = Buffer.from(parts[2] ?? "", "hex");
  const expected = Buffer.from(parts[3] ?? "", "hex");
  if (!Number.isInteger(cost) || salt.length === 0 || expected.length === 0) return false;
  const actual = scryptSync(password.normalize("NFKC"), salt, expected.length, { N: cost });
  return timingSafeEqual(actual, expected);
}
