/**
 * Pure cart logic for the customer ordering screen.
 * Kept free of React so it can be unit-tested directly.
 */
export type CartLine = {
  key: string;
  productId: number;
  nameUz: string;
  /** Base price + selected option deltas, from the server-provided menu. */
  unitPriceTiyin: number;
  quantity: number;
  optionIds: number[];
  optionNames: string[];
  note: string | null;
};

export const MAX_QUANTITY_PER_LINE = 20;

export function lineKey(productId: number, optionIds: readonly number[], note: string | null): string {
  const options = [...optionIds].sort((a, b) => a - b).join(",");
  return `${productId}|${options}|${(note ?? "").trim()}`;
}

/** Adds a line, merging with an identical product+options+note line. */
export function addLine(cart: readonly CartLine[], line: CartLine): CartLine[] {
  if (line.quantity <= 0) return [...cart];
  const index = cart.findIndex((existing) => existing.key === line.key);
  if (index === -1) {
    return [...cart, { ...line, quantity: Math.min(line.quantity, MAX_QUANTITY_PER_LINE) }];
  }
  return cart.map((existing, existingIndex) =>
    existingIndex === index
      ? { ...existing, quantity: Math.min(existing.quantity + line.quantity, MAX_QUANTITY_PER_LINE) }
      : existing,
  );
}

/** Clamped to [0, MAX]; a line at zero is removed. Never negative. */
export function changeQuantity(cart: readonly CartLine[], key: string, delta: number): CartLine[] {
  return cart
    .map((line) => (line.key === key ? { ...line, quantity: clamp(line.quantity + delta) } : line))
    .filter((line) => line.quantity > 0);
}

export function setQuantity(cart: readonly CartLine[], key: string, quantity: number): CartLine[] {
  return cart
    .map((line) => (line.key === key ? { ...line, quantity: clamp(quantity) } : line))
    .filter((line) => line.quantity > 0);
}

export function removeLine(cart: readonly CartLine[], key: string): CartLine[] {
  return cart.filter((line) => line.key !== key);
}

export function clamp(quantity: number): number {
  if (!Number.isFinite(quantity)) return 0;
  return Math.max(0, Math.min(Math.trunc(quantity), MAX_QUANTITY_PER_LINE));
}

export function cartSubtotal(cart: readonly CartLine[]): number {
  return cart.reduce((total, line) => total + line.unitPriceTiyin * line.quantity, 0);
}

export function cartCount(cart: readonly CartLine[]): number {
  return cart.reduce((total, line) => total + line.quantity, 0);
}

export function toOrderItems(cart: readonly CartLine[]) {
  return cart.map((line) => ({
    productId: line.productId,
    quantity: line.quantity,
    optionIds: line.optionIds,
    note: line.note ?? undefined,
  }));
}

export function isEmpty(cart: readonly CartLine[]): boolean {
  return cartCount(cart) === 0;
}
