import { getDb } from "@/server/db/client";
import { nowIso } from "@/shared/lib/datetime";
import { RESTAURANT_TIME_ZONE } from "@/shared/lib/timezone";
import type { AppSettings } from "@/shared/types/domain";
import type { SettingsInput } from "@/shared/validation/schemas";

export const DEFAULT_SETTINGS: AppSettings = {
  restaurantName: "LOLA CAFE",
  address: "Toshkent sh., Amir Temur ko'chasi 1",
  phone: "+998 71 000 00 00",
  receiptFooter: "LOLA CAFE'ga tashrifingiz uchun rahmat!",
  serviceChargePercent: 0,
  currency: "UZS",
  timezone: RESTAURANT_TIME_ZONE,
};

const EDITABLE_KEYS = [
  "restaurantName",
  "address",
  "phone",
  "receiptFooter",
  "serviceChargePercent",
] as const;

export function getSettings(): AppSettings {
  const rows = getDb().prepare("SELECT key, value FROM app_settings").all() as Array<{
    key: string;
    value: string;
  }>;
  const stored = new Map(rows.map((row) => [row.key, row.value]));
  const result: AppSettings = { ...DEFAULT_SETTINGS };
  for (const key of EDITABLE_KEYS) {
    const raw = stored.get(key);
    if (raw !== undefined) {
      if (key === "serviceChargePercent") {
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) result.serviceChargePercent = parsed;
      } else {
        result[key] = raw;
      }
    }
  }
  return result;
}

export function updateSettings(input: SettingsInput, actorUserId: number): AppSettings {
  const db = getDb();
  const now = nowIso();
  const upsert = db.prepare(
    `INSERT INTO app_settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
  );
  const run = db.transaction(() => {
    for (const key of EDITABLE_KEYS) {
      upsert.run(key, String(input[key]), now, actorUserId);
    }
  });
  run();
  return getSettings();
}
