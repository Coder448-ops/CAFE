import { describe, expect, it } from "vitest";
import {
  formatUzs,
  formatUzsCompact,
  parseSomInput,
  somToTiyin,
  sumTiyin,
  tiyinToSom,
  assertSafeTiyin,
} from "@/shared/lib/money";

describe("money utilities", () => {
  it("converts so'm to integer tiyin without float drift", () => {
    expect(somToTiyin(32000)).toBe(3_200_000);
    expect(somToTiyin(0.1)).toBe(10);
    expect(somToTiyin(19.99)).toBe(1999);
    expect(tiyinToSom(3_200_000)).toBe(32000);
  });

  it("formats tiyin as UZS so'm with a space separator", () => {
    expect(formatUzs(3_200_000)).toBe("32 000 so'm");
    expect(formatUzs(150_000_000)).toBe("1 500 000 so'm");
    expect(formatUzs(3_200_000, { withCurrency: false })).toBe("32 000");
  });

  it("formats compact values for dashboards", () => {
    expect(formatUzsCompact(150_000_000)).toBe("1,5 mln so'm");
    expect(formatUzsCompact(2_000_000_000)).toBe("20 mln so'm");
  });

  it("parses admin input into tiyin and rejects garbage", () => {
    expect(parseSomInput("32 000")).toBe(3_200_000);
    expect(parseSomInput("32000,50")).toBe(3_200_050);
    expect(parseSomInput("32 000 so'm")).toBe(3_200_000);
    expect(parseSomInput("-500")).toBeNull();
    expect(parseSomInput("abc")).toBeNull();
    expect(parseSomInput("12.345")).toBeNull();
  });

  it("never allows negative or non-integer amounts", () => {
    expect(() => assertSafeTiyin(-1)).toThrow();
    expect(() => assertSafeTiyin(1.5)).toThrow();
    expect(assertSafeTiyin(0)).toBe(0);
    expect(sumTiyin([100, 250, 3])).toBe(353);
  });
});
