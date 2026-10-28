import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/server/db/client";
import { createOrder, changeOrderStatus, getOrder, listOrders } from "@/server/services/orders";
import { updateProduct, listProducts } from "@/server/services/menu";
import { firstTable, productByName, testActor, uniqueKey, adminUserId } from "../helpers";
import { ApiError } from "@/server/http/errors";
import { ORDER_TRANSITIONS } from "@/shared/constants/orders";

describe("order creation", () => {
  let tableId: number;
  beforeEach(() => {
    tableId = firstTable().id;
  });

  it("persists the order with its items and the correct table", () => {
    const coffee = productByName("Kapuchino");
    const { order, duplicate } = createOrder({
      tableId,
      items: [{ productId: coffee.id, quantity: 2, optionIds: [] }],
      clientRequestId: uniqueKey("order"),
      actor: testActor,
      actorUserId: adminUserId(),
    });

    expect(duplicate).toBe(false);
    expect(order.tableId).toBe(tableId);
    expect(order.status).toBe("new");
    expect(order.paymentStatus).toBe("unpaid");
    expect(order.paidTiyin).toBe(0);
    expect(order.items).toHaveLength(1);
    expect(order.items[0]!.quantity).toBe(2);

    const stored = getDb().prepare("SELECT COUNT(*) AS count FROM orders WHERE id = ?").get(order.id) as {
      count: number;
    };
    expect(stored.count).toBe(1);
  });

  it("prices from the database, ignoring any client-supplied price", () => {
    const burger = productByName("Lola burger");
    const { order } = createOrder({
      tableId,
      items: [
        // Extra keys simulate a manipulated client payload.
        { productId: burger.id, quantity: 1, optionIds: [], ...{ priceTiyin: 1, unitPriceTiyin: 1 } } as never,
      ],
      clientRequestId: uniqueKey("order"),
      actor: testActor,
      actorUserId: null,
    });
    expect(order.totalTiyin).toBe(burger.priceTiyin);
  });

  it("rejects an empty order", () => {
    expect(() =>
      createOrder({
        tableId,
        items: [],
        clientRequestId: uniqueKey("order"),
        actor: testActor,
        actorUserId: null,
      }),
    ).toThrow(ApiError);
  });

  it("rejects unknown or unavailable products", () => {
    expect(() =>
      createOrder({
        tableId,
        items: [{ productId: 999_999, quantity: 1, optionIds: [] }],
        clientRequestId: uniqueKey("order"),
        actor: testActor,
        actorUserId: null,
      }),
    ).toThrow(/mavjud emas/);

    const tiramisu = productByName("Tiramisu");
    getDb().prepare("UPDATE products SET is_available = 0 WHERE id = ?").run(tiramisu.id);
    expect(() =>
      createOrder({
        tableId,
        items: [{ productId: tiramisu.id, quantity: 1, optionIds: [] }],
        clientRequestId: uniqueKey("order"),
        actor: testActor,
        actorUserId: null,
      }),
    ).toThrow(/mavjud emas/);
    getDb().prepare("UPDATE products SET is_available = 1 WHERE id = ?").run(tiramisu.id);
  });

  it("does not create duplicate orders for the same idempotency key", () => {
    const coffee = productByName("Espresso");
    const clientRequestId = uniqueKey("dup");
    const first = createOrder({
      tableId,
      items: [{ productId: coffee.id, quantity: 1, optionIds: [] }],
      clientRequestId,
      actor: testActor,
      actorUserId: null,
    });
    const second = createOrder({
      tableId,
      items: [{ productId: coffee.id, quantity: 1, optionIds: [] }],
      clientRequestId,
      actor: testActor,
      actorUserId: null,
    });
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.order.id).toBe(first.order.id);
    const count = getDb()
      .prepare("SELECT COUNT(*) AS count FROM orders WHERE id = ?")
      .get(first.order.id) as { count: number };
    expect(count.count).toBe(1);
  });

  it("keeps historical prices unchanged after a menu price update", () => {
    const latte = productByName("Latte");
    const { order } = createOrder({
      tableId,
      items: [{ productId: latte.id, quantity: 1, optionIds: [] }],
      clientRequestId: uniqueKey("hist"),
      actor: testActor,
      actorUserId: null,
    });

    updateProduct(latte.id, {
      categoryId: latte.categoryId,
      nameUz: latte.nameUz,
      descriptionUz: latte.descriptionUz,
      priceTiyin: latte.priceTiyin + 5_000_00,
      imageUrl: latte.imageUrl,
      station: latte.station,
      prepMinutes: latte.prepMinutes,
      isActive: true,
      isAvailable: true,
      sortOrder: latte.sortOrder,
    });

    const reloaded = getOrder(order.id);
    expect(reloaded.items[0]!.unitPriceTiyin).toBe(latte.priceTiyin);
    expect(reloaded.totalTiyin).toBe(latte.priceTiyin);
    expect(listProducts().find((product) => product.id === latte.id)!.priceTiyin).toBe(
      latte.priceTiyin + 5_000_00,
    );
  });

  it("increments the order number per business date", () => {
    const coffee = productByName("Espresso");
    const first = createOrder({
      tableId,
      items: [{ productId: coffee.id, quantity: 1, optionIds: [] }],
      clientRequestId: uniqueKey("num"),
      actor: testActor,
      actorUserId: null,
    });
    const second = createOrder({
      tableId,
      items: [{ productId: coffee.id, quantity: 1, optionIds: [] }],
      clientRequestId: uniqueKey("num"),
      actor: testActor,
      actorUserId: null,
    });
    expect(second.order.orderNumber).toBe(first.order.orderNumber + 1);
    expect(second.order.businessDate).toBe(first.order.businessDate);
  });

  it("reuses the open table session for subsequent orders", () => {
    const coffee = productByName("Espresso");
    const a = createOrder({
      tableId,
      items: [{ productId: coffee.id, quantity: 1, optionIds: [] }],
      clientRequestId: uniqueKey("sess"),
      actor: testActor,
      actorUserId: null,
    });
    const b = createOrder({
      tableId,
      items: [{ productId: coffee.id, quantity: 3, optionIds: [] }],
      clientRequestId: uniqueKey("sess"),
      actor: testActor,
      actorUserId: null,
    });
    expect(b.order.tableSessionId).toBe(a.order.tableSessionId);
  });

  it("applies option price deltas from the database", () => {
    const cappuccino = productByName("Kapuchino");
    const group = cappuccino.optionGroups.find((candidate) => candidate.nameUz === "Sut")!;
    const almond = group.options.find((option) => option.nameUz === "Bodom suti")!;
    const sizeGroup = cappuccino.optionGroups.find((candidate) => candidate.nameUz === "Hajm")!;
    const large = sizeGroup.options.find((option) => option.nameUz === "350 ml")!;

    const { order } = createOrder({
      tableId,
      items: [{ productId: cappuccino.id, quantity: 2, optionIds: [almond.id, large.id] }],
      clientRequestId: uniqueKey("opt"),
      actor: testActor,
      actorUserId: null,
    });
    const expectedUnit = cappuccino.priceTiyin + almond.priceDeltaTiyin + large.priceDeltaTiyin;
    expect(order.items[0]!.unitPriceTiyin).toBe(expectedUnit);
    expect(order.items[0]!.options).toHaveLength(2);
    expect(order.totalTiyin).toBe(expectedUnit * 2);

    // An option belonging to another product is refused.
    const burger = productByName("Lola burger");
    const burgerOption = burger.optionGroups[0]!.options[0]!;
    expect(() =>
      createOrder({
        tableId,
        items: [{ productId: cappuccino.id, quantity: 1, optionIds: [burgerOption.id] }],
        clientRequestId: uniqueKey("opt"),
        actor: testActor,
        actorUserId: null,
      }),
    ).toThrow(/boshqa mahsulotga/);
  });
});

describe("order status transitions", () => {
  it("follows the state machine and records timestamps", () => {
    const coffee = productByName("Amerikano");
    const { order } = createOrder({
      tableId: firstTable().id,
      items: [{ productId: coffee.id, quantity: 1, optionIds: [] }],
      clientRequestId: uniqueKey("flow"),
      actor: testActor,
      actorUserId: null,
    });

    expect(() =>
      changeOrderStatus({ orderId: order.id, status: "completed", actor: testActor, actorUserId: null }),
    ).toThrow(/o'tib bo'lmaydi/);

    const accepted = changeOrderStatus({
      orderId: order.id,
      status: "accepted",
      actor: testActor,
      actorUserId: null,
    });
    expect(accepted.acceptedAt).not.toBeNull();

    const preparing = changeOrderStatus({
      orderId: order.id,
      status: "preparing",
      actor: testActor,
      actorUserId: null,
    });
    expect(preparing.items[0]!.status).toBe("preparing");

    const ready = changeOrderStatus({ orderId: order.id, status: "ready", actor: testActor, actorUserId: null });
    expect(ready.readyAt).not.toBeNull();
    expect(ready.items[0]!.status).toBe("ready");
  });

  it("requires a reason to cancel and keeps cancellations out of reports", () => {
    const coffee = productByName("Amerikano");
    const { order } = createOrder({
      tableId: firstTable().id,
      items: [{ productId: coffee.id, quantity: 1, optionIds: [] }],
      clientRequestId: uniqueKey("cancel"),
      actor: testActor,
      actorUserId: null,
    });
    const cancelled = changeOrderStatus({
      orderId: order.id,
      status: "cancelled",
      reason: "Mijoz voz kechdi",
      actor: testActor,
      actorUserId: null,
    });
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancelReason).toBe("Mijoz voz kechdi");
    expect(cancelled.items[0]!.status).toBe("cancelled");
  });

  it("exposes every transition target as a valid order status", () => {
    const all = new Set(Object.values(ORDER_TRANSITIONS).flat());
    for (const status of all) {
      expect(["accepted", "preparing", "ready", "served", "completed", "cancelled"]).toContain(status);
    }
    expect(listOrders({ status: "active" }).every((order) => order.status !== "cancelled")).toBe(true);
  });
});
