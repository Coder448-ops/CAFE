import { describe, expect, it } from "vitest";
import { getDb } from "@/server/db/client";
import { createOrder, getOrder } from "@/server/services/orders";
import { listTickets, updateTicketStatus } from "@/server/services/kitchen";
import { firstTable, productByName, testActor, uniqueKey } from "../helpers";
import { ApiError } from "@/server/http/errors";

function orderWithKitchenAndBarItems() {
  const coffee = productByName("Espresso"); // bar station
  const burger = productByName("Lola burger"); // kitchen station
  return createOrder({
    tableId: firstTable().id,
    items: [
      { productId: coffee.id, quantity: 1, optionIds: [] },
      { productId: burger.id, quantity: 2, optionIds: [], note: "sous alohida" },
    ],
    clientRequestId: uniqueKey("kitchen"),
    actor: testActor,
    actorUserId: null,
  }).order;
}

describe("kitchen tickets", () => {
  it("creates one persistent ticket per station with the right items", () => {
    const order = orderWithKitchenAndBarItems();
    const tickets = listTickets().filter((ticket) => ticket.orderId === order.id);
    expect(tickets).toHaveLength(2);
    const kitchen = tickets.find((ticket) => ticket.station === "kitchen")!;
    const bar = tickets.find((ticket) => ticket.station === "bar")!;
    expect(kitchen.items.map((item) => item.productName)).toEqual(["Lola burger"]);
    expect(kitchen.items[0]!.note).toBe("sous alohida");
    expect(bar.items.map((item) => item.productName)).toEqual(["Espresso"]);
    expect(kitchen.tableCode).toBe(order.tableCode);

    const stored = getDb()
      .prepare("SELECT COUNT(*) AS count FROM kitchen_tickets WHERE order_id = ?")
      .get(order.id) as { count: number };
    expect(stored.count).toBe(2);
  });

  it("moves a ticket through queued -> preparing -> ready and syncs the order", () => {
    const order = orderWithKitchenAndBarItems();
    const [first] = listTickets().filter((ticket) => ticket.orderId === order.id);
    expect(first).toBeDefined();

    const preparing = updateTicketStatus({
      ticketId: first!.id,
      status: "preparing",
      actorUserId: null,
      actor: testActor,
    });
    expect(preparing.status).toBe("preparing");
    expect(preparing.startedAt).not.toBeNull();

    const ready = updateTicketStatus({
      ticketId: first!.id,
      status: "ready",
      actorUserId: null,
      actor: testActor,
    });
    expect(ready.readyAt).not.toBeNull();
    // The other station is not ready yet, so the order must not be "ready".
    expect(getOrder(order.id).status).toBe("preparing");
  });

  it("does not expose prices or payment data to the kitchen", () => {
    const order = orderWithKitchenAndBarItems();
    const ticket = listTickets().find((candidate) => candidate.orderId === order.id)!;
    const serialized = JSON.stringify(ticket);
    expect(serialized).not.toContain("Tiyin");
    expect(serialized).not.toContain("payment");
    expect(serialized).not.toContain("total_tiyin");
    expect(Object.keys(ticket)).not.toContain("totalTiyin");
  });

  it("rejects conflicting or backwards transitions", () => {
    const order = orderWithKitchenAndBarItems();
    const ticket = listTickets().find((candidate) => candidate.orderId === order.id)!;
    expect(() =>
      updateTicketStatus({ ticketId: ticket.id, status: "served", actorUserId: null, actor: testActor }),
    ).toThrow(ApiError);
    expect(() =>
      updateTicketStatus({ ticketId: ticket.id, status: "cancelled", actorUserId: null, actor: testActor }),
    ).toThrow(/faqat kassir/);
  });

  it("allows a cashier-side serve and keeps history", () => {
    const order = orderWithKitchenAndBarItems();
    const tickets = listTickets().filter((candidate) => candidate.orderId === order.id);
    for (const ticket of tickets) {
      updateTicketStatus({ ticketId: ticket.id, status: "preparing", actorUserId: null, actor: testActor });
      updateTicketStatus({ ticketId: ticket.id, status: "ready", actorUserId: null, actor: testActor });
    }
    expect(getOrder(order.id).status).toBe("ready");

    for (const ticket of tickets) {
      updateTicketStatus({
        ticketId: ticket.id,
        status: "served",
        actorUserId: null,
        actor: testActor,
        allowServe: true,
      });
    }
    expect(getOrder(order.id).status).toBe("served");
    expect(listTickets({ includeHistory: true }).length).toBeGreaterThan(0);
  });
});
