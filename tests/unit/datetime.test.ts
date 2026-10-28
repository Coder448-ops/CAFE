import { describe, expect, it } from "vitest";
import {
  businessDateOf,
  businessDateRangeUtc,
  addDaysToBusinessDate,
  formatDuration,
  minutesSince,
} from "@/shared/lib/datetime";

describe("Asia/Tashkent business dates", () => {
  it("rolls the business date at local midnight (UTC+5)", () => {
    expect(businessDateOf("2026-10-28T18:59:00Z")).toBe("2026-10-28");
    expect(businessDateOf("2026-10-28T19:00:01Z")).toBe("2026-10-29");
  });

  it("produces a UTC window that matches the local day", () => {
    const { startIso, endIso } = businessDateRangeUtc("2026-10-29");
    expect(startIso).toBe("2026-10-28T19:00:00.000Z");
    expect(endIso).toBe("2026-10-29T18:59:59.999Z");
  });

  it("shifts business dates safely", () => {
    expect(addDaysToBusinessDate("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysToBusinessDate("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("formats durations and never returns negative minutes", () => {
    expect(minutesSince(new Date(Date.now() + 60_000).toISOString())).toBe(0);
    expect(formatDuration(0)).toBe("hozir");
    expect(formatDuration(12)).toBe("12 daq");
    expect(formatDuration(72)).toBe("1 soat 12 daq");
  });
});
