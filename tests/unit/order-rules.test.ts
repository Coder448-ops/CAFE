import { describe, expect, it } from "vitest";
import { ORDER_TRANSITIONS, OPEN_ORDER_STATUSES } from "@/shared/constants/orders";
import { createOrderSchema, recordPaymentSchema, cartItemInputSchema } from "@/shared/validation/schemas";

describe("order state machine", () => {
  it("allows only the documented forward transitions", () => {
    expect(ORDER_TRANSITIONS.new).toContain("accepted");
    expect(ORDER_TRANSITIONS.new).not.toContain("completed");
    expect(ORDER_TRANSITIONS.preparing).toContain("ready");
    expect(ORDER_TRANSITIONS.completed).toHaveLength(0);
    expect(ORDER_TRANSITIONS.cancelled).toHaveLength(0);
  });

  it("treats served orders as still open for reporting", () => {
    expect(OPEN_ORDER_STATUSES).toContain("served");
    expect(OPEN_ORDER_STATUSES).not.toContain("completed");
  });
});

describe("request validation", () => {
  it("rejects an empty cart", () => {
    expect(createOrderSchema.safeParse({ items: [], clientRequestId: "abc-123456" }).success).toBe(false);
  });

  it("rejects zero and negative quantities", () => {
    expect(cartItemInputSchema.safeParse({ productId: 1, quantity: 0 }).success).toBe(false);
    expect(cartItemInputSchema.safeParse({ productId: 1, quantity: -2 }).success).toBe(false);
    expect(cartItemInputSchema.safeParse({ productId: 1, quantity: 2 }).success).toBe(true);
  });

  it("requires an idempotency key", () => {
    expect(createOrderSchema.safeParse({ items: [{ productId: 1, quantity: 1 }] }).success).toBe(false);
  });

  it("requires a positive payment amount when provided", () => {
    expect(
      recordPaymentSchema.safeParse({ method: "cash", amountTiyin: 0, clientRequestId: "pay-123456" }).success,
    ).toBe(false);
    expect(recordPaymentSchema.safeParse({ method: "cash", clientRequestId: "pay-123456" }).success).toBe(true);
  });
});
