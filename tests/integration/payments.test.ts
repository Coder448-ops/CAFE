import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/server/db/client";
import { createOrder, getOrder, changeOrderStatus } from "@/server/services/orders";
import { recordPayment, refundPayment } from "@/server/services/payments";
import { getReports } from "@/server/services/reports";
import { firstTable, productByName, testActor, uniqueKey, adminUserId } from "../helpers";
import { ApiError } from "@/server/http/errors";

function newOrder(quantity = 1) {
  const coffee = productByName("Kapuchino");
  return createOrder({
    tableId: firstTable().id,
    items: [{ productId: coffee.id, quantity, optionIds: [] }],
    clientRequestId: uniqueKey("pay-order"),
    actor: testActor,
    actorUserId: adminUserId(),
  }).order;
}

describe("payments", () => {
  let orderId: number;
  beforeEach(() => {
    orderId = newOrder().id;
  });

  it("keeps an order unpaid until a payment is recorded", () => {
    const order = getOrder(orderId);
    expect(order.paymentStatus).toBe("unpaid");
    expect(order.paidTiyin).toBe(0);
    expect(order.dueTiyin).toBe(order.totalTiyin);
  });

  it("records a cash payment and settles the balance", () => {
    const result = recordPayment({
      orderId,
      input: { method: "cash", clientRequestId: uniqueKey("pay") },
      actorUserId: adminUserId(),
      actor: testActor,
    });
    expect(result.payment.amountTiyin).toBe(result.order.totalTiyin);
    expect(result.order.paymentStatus).toBe("paid");
    expect(result.order.dueTiyin).toBe(0);
  });

  it("supports partial (split) payments", () => {
    const order = getOrder(orderId);
    const half = Math.floor(order.totalTiyin / 2);
    const first = recordPayment({
      orderId,
      input: { method: "cash", amountTiyin: half, clientRequestId: uniqueKey("pay") },
      actorUserId: adminUserId(),
      actor: testActor,
    });
    expect(first.order.paymentStatus).toBe("partial");
    expect(first.order.dueTiyin).toBe(order.totalTiyin - half);

    const second = recordPayment({
      orderId,
      input: { method: "card_manual", clientRequestId: uniqueKey("pay") },
      actorUserId: adminUserId(),
      actor: testActor,
    });
    expect(second.order.paymentStatus).toBe("paid");
    expect(second.order.payments).toHaveLength(2);
  });

  it("does not double-charge on a repeated idempotency key", () => {
    const clientRequestId = uniqueKey("pay-dup");
    const first = recordPayment({
      orderId,
      input: { method: "cash", clientRequestId },
      actorUserId: adminUserId(),
      actor: testActor,
    });
    const second = recordPayment({
      orderId,
      input: { method: "cash", clientRequestId },
      actorUserId: adminUserId(),
      actor: testActor,
    });
    expect(second.duplicate).toBe(true);

    const payments = getDb()
      .prepare("SELECT COUNT(*) AS count FROM payments WHERE order_id = ?")
      .get(orderId) as { count: number };
    expect(payments.count).toBe(1);
    expect(second.order.paidTiyin).toBe(first.order.paidTiyin);
  });

  it("refuses to overpay or to pay a cancelled order", () => {
    const order = getOrder(orderId);
    expect(() =>
      recordPayment({
        orderId,
        input: { method: "cash", amountTiyin: order.totalTiyin + 100, clientRequestId: uniqueKey("pay") },
        actorUserId: adminUserId(),
        actor: testActor,
      }),
    ).toThrow(ApiError);

    const other = newOrder();
    changeOrderStatus({
      orderId: other.id,
      status: "cancelled",
      reason: "test",
      actorUserId: adminUserId(),
      actor: testActor,
    });
    expect(() =>
      recordPayment({
        orderId: other.id,
        input: { method: "cash", clientRequestId: uniqueKey("pay") },
        actorUserId: adminUserId(),
        actor: testActor,
      }),
    ).toThrow(/Bekor qilingan/);
  });

  it("refuses a second payment once fully paid", () => {
    recordPayment({
      orderId,
      input: { method: "cash", clientRequestId: uniqueKey("pay") },
      actorUserId: adminUserId(),
      actor: testActor,
    });
    expect(() =>
      recordPayment({
        orderId,
        input: { method: "cash", clientRequestId: uniqueKey("pay") },
        actorUserId: adminUserId(),
        actor: testActor,
      }),
    ).toThrow(/allaqachon to'langan/);
  });

  it("records refunds without deleting the original payment", () => {
    const paid = recordPayment({
      orderId,
      input: { method: "cash", clientRequestId: uniqueKey("pay") },
      actorUserId: adminUserId(),
      actor: testActor,
    });
    const refunded = refundPayment({
      paymentId: paid.payment.id,
      amountTiyin: paid.payment.amountTiyin,
      reason: "Mijoz shikoyati",
      actorUserId: adminUserId(),
      actor: testActor,
    });
    expect(refunded.paymentStatus).toBe("refunded");
    expect(refunded.paidTiyin).toBe(0);
    expect(refunded.payments).toHaveLength(1);

    const refundRows = getDb()
      .prepare("SELECT COUNT(*) AS count FROM refunds WHERE order_id = ?")
      .get(orderId) as { count: number };
    const paymentRows = getDb()
      .prepare("SELECT COUNT(*) AS count FROM payments WHERE order_id = ?")
      .get(orderId) as { count: number };
    expect(refundRows.count).toBe(1);
    expect(paymentRows.count).toBe(1);
  });

  it("guards against refunding more than was paid", () => {
    const paid = recordPayment({
      orderId,
      input: { method: "cash", clientRequestId: uniqueKey("pay") },
      actorUserId: adminUserId(),
      actor: testActor,
    });
    expect(() =>
      refundPayment({
        paymentId: paid.payment.id,
        amountTiyin: paid.payment.amountTiyin + 1,
        reason: "xato",
        actorUserId: adminUserId(),
        actor: testActor,
      }),
    ).toThrow(ApiError);
  });
});

describe("reports", () => {
  it("separates recorded payments from submitted order totals", () => {
    const paidOrder = newOrder();
    recordPayment({
      orderId: paidOrder.id,
      input: { method: "cash", clientRequestId: uniqueKey("rep") },
      actorUserId: adminUserId(),
      actor: testActor,
    });
    const unpaidOrder = newOrder();

    const businessDate = getOrder(paidOrder.id).businessDate;
    const reports = getReports(businessDate, businessDate);
    const paidPaymentTotal = getDb()
      .prepare("SELECT COALESCE(SUM(amount_tiyin),0) AS total FROM payments WHERE business_date = ?")
      .get(businessDate) as { total: number };

    expect(reports.summary.paymentsRecordedTiyin).toBe(paidPaymentTotal.total);
    expect(reports.summary.netSalesTiyin).toBeGreaterThan(reports.summary.paymentsRecordedTiyin);
    expect(reports.summary.outstandingTiyin).toBeGreaterThanOrEqual(getOrder(unpaidOrder.id).totalTiyin);
    expect(reports.byMethod.find((row) => row.method === "cash")!.amountTiyin).toBeGreaterThan(0);
    expect(reports.byProduct.length).toBeGreaterThan(0);
  });
});
