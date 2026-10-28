import { describe, expect, it } from "vitest";
import {
  addLine,
  cartCount,
  cartSubtotal,
  changeQuantity,
  clamp,
  isEmpty,
  lineKey,
  MAX_QUANTITY_PER_LINE,
  removeLine,
  setQuantity,
  toOrderItems,
  type CartLine,
} from "@/modules/customer/lib/cart";

const coffee = (quantity = 1): CartLine => ({
  key: lineKey(1, [], null),
  productId: 1,
  nameUz: "Kapuchino",
  unitPriceTiyin: 3_200_000,
  quantity,
  optionIds: [],
  optionNames: [],
  note: null,
});

const burger = (): CartLine => ({
  key: lineKey(2, [7], "sous bilan"),
  productId: 2,
  nameUz: "Lola burger",
  unitPriceTiyin: 6_800_000,
  quantity: 2,
  optionIds: [7],
  optionNames: ["Chedar"],
  note: "sous bilan",
});

describe("customer cart", () => {
  it("increments quantity for the same product and options", () => {
    const cart = addLine(addLine([], coffee()), coffee());
    expect(cart).toHaveLength(1);
    expect(cartCount(cart)).toBe(2);
  });

  it("keeps different options as separate lines", () => {
    const cart = addLine(addLine([], coffee()), { ...burger() });
    expect(cart).toHaveLength(2);
    expect(cartSubtotal(cart)).toBe(3_200_000 + 13_600_000);
  });

  it("decrements quantity and removes the line at zero", () => {
    const start = addLine([], coffee(2));
    const afterOne = changeQuantity(start, start[0]!.key, -1);
    expect(afterOne[0]!.quantity).toBe(1);
    const afterZero = changeQuantity(afterOne, afterOne[0]!.key, -1);
    expect(afterZero).toHaveLength(0);
  });

  it("never allows a negative quantity", () => {
    const start = addLine([], coffee(1));
    const result = changeQuantity(start, start[0]!.key, -5);
    expect(result).toHaveLength(0);
    expect(clamp(-3)).toBe(0);
    expect(setQuantity(start, start[0]!.key, -1)).toHaveLength(0);
  });

  it("caps quantity at the maximum per line", () => {
    const start = addLine([], coffee(MAX_QUANTITY_PER_LINE));
    const result = changeQuantity(start, start[0]!.key, +10);
    expect(result[0]!.quantity).toBe(MAX_QUANTITY_PER_LINE);
  });

  it("detects an empty cart and maps to API payload", () => {
    expect(isEmpty([])).toBe(true);
    const cart = addLine([], burger());
    expect(isEmpty(cart)).toBe(false);
    expect(toOrderItems(cart)).toEqual([
      { productId: 2, quantity: 2, optionIds: [7], note: "sous bilan" },
    ]);
  });

  it("removes a line explicitly", () => {
    const cart = addLine(addLine([], coffee()), burger());
    expect(removeLine(cart, cart[0]!.key)).toHaveLength(1);
  });
});
