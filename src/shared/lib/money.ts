/**
 * Money rules for LOLA CAFE.
 *
 * UZS is stored as INTEGER TIYIN (1 so'm = 100 tiyin) in the database and in
 * every API payload. Floating point never touches a financial total.
 */
export const TIYIN_PER_SOM = 100;

export function assertSafeTiyin(value: number): number {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`Pul qiymati butun son bo'lishi kerak (tiyin): ${value}`);
  }
  if (value < 0) {
    throw new Error("Pul qiymati manfiy bo'lishi mumkin emas");
  }
  return value;
}

/** Converts a so'm amount (integer, or with up to 2 decimals) into tiyin. */
export function somToTiyin(som: number): number {
  if (!Number.isFinite(som) || som < 0) {
    throw new Error("Noto'g'ri summa");
  }
  return Math.round(som * TIYIN_PER_SOM);
}

export function tiyinToSom(tiyin: number): number {
  return tiyin / TIYIN_PER_SOM;
}

const uzsFormatter = new Intl.NumberFormat("uz-Latn-UZ", {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

/** "1 500 000 so'm" — tiyin input, so'm output. */
export function formatUzs(tiyin: number, options: { withCurrency?: boolean } = {}): string {
  const { withCurrency = true } = options;
  const som = Math.round(tiyin / TIYIN_PER_SOM);
  const formatted = uzsFormatter.format(som).replace(/\u00A0/g, " ");
  return withCurrency ? `${formatted} so'm` : formatted;
}

/** Compact form for tight UI spots: "1,5 mln so'm". */
export function formatUzsCompact(tiyin: number): string {
  const som = Math.round(tiyin / TIYIN_PER_SOM);
  if (som >= 1_000_000) {
    const millions = (som / 1_000_000).toFixed(som % 1_000_000 === 0 ? 0 : 1).replace(".", ",");
    return `${millions} mln so'm`;
  }
  return formatUzs(tiyin);
}

/** Parses an admin-entered so'm string ("25 000", "25000,50") into tiyin. */
export function parseSomInput(input: string): number | null {
  const normalized = input
    .replace(/\u00A0/g, "")
    .replace(/\s/g, "")
    .replace(/so['`’]?m/gi, "")
    .replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const som = Number(normalized);
  if (!Number.isFinite(som)) return null;
  const tiyin = somToTiyin(som);
  return Number.isSafeInteger(tiyin) && tiyin >= 0 ? tiyin : null;
}

export function sumTiyin(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
