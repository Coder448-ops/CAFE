import { RESTAURANT_TIME_ZONE, RESTAURANT_UTC_OFFSET } from "@/shared/lib/timezone";

/** ISO-8601 UTC timestamp, the single timestamp format used across the system. */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Business date (YYYY-MM-DD) in the restaurant timezone. */
export function businessDateOf(date: Date | string = new Date()): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: RESTAURANT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export function todayBusinessDate(): string {
  return businessDateOf(new Date());
}

/**
 * Asia/Tashkent has a fixed UTC+05:00 offset (no DST), so a business date maps
 * to a stable UTC instant range. Used for report filtering.
 */
export function businessDateRangeUtc(date: string): { startIso: string; endIso: string } {
  assertValidDate(date);
  return {
    startIso: new Date(`${date}T00:00:00${RESTAURANT_UTC_OFFSET}`).toISOString(),
    endIso: new Date(`${date}T23:59:59.999${RESTAURANT_UTC_OFFSET}`).toISOString(),
  };
}

export function assertValidDate(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())) {
    throw new Error(`Noto'g'ri sana: ${date}`);
  }
}

export function addDaysToBusinessDate(date: string, days: number): string {
  assertValidDate(date);
  const base = new Date(`${date}T12:00:00${RESTAURANT_UTC_OFFSET}`);
  base.setUTCDate(base.getUTCDate() + days);
  return businessDateOf(base);
}

const timeFormatter = new Intl.DateTimeFormat("uz-Latn-UZ", {
  timeZone: RESTAURANT_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateTimeFormatter = new Intl.DateTimeFormat("uz-Latn-UZ", {
  timeZone: RESTAURANT_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateFormatter = new Intl.DateTimeFormat("uz-Latn-UZ", {
  timeZone: RESTAURANT_TIME_ZONE,
  day: "2-digit",
  month: "long",
  year: "numeric",
});

export function formatTime(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

export function formatBusinessDate(date: string): string {
  return dateFormatter.format(new Date(`${date}T12:00:00${RESTAURANT_UTC_OFFSET}`));
}

/** Whole minutes elapsed since a timestamp (never negative). */
export function minutesSince(iso: string, reference: Date = new Date()): number {
  const diff = reference.getTime() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diff / 60_000));
}

/** "3 daq" / "1 soat 12 daq" / "45 son" */
export function formatDuration(minutes: number): string {
  if (minutes < 1) return "hozir";
  if (minutes < 60) return `${minutes} daq`;
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest === 0 ? `${hours} soat` : `${hours} soat ${rest} daq`;
  }
  return `${Math.floor(minutes / 1440)} kun`;
}
