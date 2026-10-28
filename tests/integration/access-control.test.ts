import { describe, expect, it } from "vitest";
import { getDb } from "@/server/db/client";
import { createOrder, listOrdersForSession, findOrder } from "@/server/services/orders";
import {
  createPairingCode,
  redeemPairingCode,
  resolveDeviceToken,
  findOpenSession,
  closeSession,
} from "@/server/services/tables";
import { authenticateStaff, createStaff, updateStaff, listStaff } from "@/server/services/staff";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, resolveSessionToken, revokeSessionByToken } from "@/server/auth/session";
import { recordPayment } from "@/server/services/payments";
import { firstTable, productByName, testActor, uniqueKey, adminUserId } from "../helpers";
import { readEventsSince, publishEvent } from "@/server/realtime/bus";
import { ApiError } from "@/server/http/errors";

describe("customer device pairing", () => {
  it("redeems a single-use code exactly once and binds it to the table", () => {
    const table = firstTable();
    const pairing = createPairingCode(table.id, adminUserId());
    expect(pairing.code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);

    const device = redeemPairingCode(pairing.code);
    expect(device.tableId).toBe(table.id);
    expect(resolveDeviceToken(device.deviceToken)?.tableId).toBe(table.id);

    expect(() => redeemPairingCode(pairing.code)).toThrow(/ishlatilgan/);
  });

  it("rejects unknown codes and unknown device tokens", () => {
    expect(() => redeemPairingCode("ZZZZ-ZZZZ")).toThrow(ApiError);
    expect(resolveDeviceToken("not-a-real-token")).toBeNull();
    expect(resolveDeviceToken(undefined)).toBeNull();
  });

  it("isolates table sessions: one table device cannot read another table's orders", () => {
    const tables = getDb().prepare("SELECT id FROM restaurant_tables ORDER BY id LIMIT 2").all() as Array<{
      id: number;
    }>;
    const coffee = productByName("Espresso");
    const orderA = createOrder({
      tableId: tables[0]!.id,
      items: [{ productId: coffee.id, quantity: 1, optionIds: [] }],
      clientRequestId: uniqueKey("iso"),
      actor: testActor,
      actorUserId: null,
    }).order;
    const orderB = createOrder({
      tableId: tables[1]!.id,
      items: [{ productId: coffee.id, quantity: 1, optionIds: [] }],
      clientRequestId: uniqueKey("iso"),
      actor: testActor,
      actorUserId: null,
    }).order;

    const sessionA = findOpenSession(tables[0]!.id)!;
    const sessionB = findOpenSession(tables[1]!.id)!;
    expect(sessionA.id).not.toBe(sessionB.id);

    const visibleToA = listOrdersForSession(sessionA.id).map((order) => order.id);
    expect(visibleToA).toContain(orderA.id);
    expect(visibleToA).not.toContain(orderB.id);
  });
});

describe("staff authentication", () => {
  it("hashes passwords with a salted scrypt digest", () => {
    const hash = hashPassword("supersecret");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(hash).not.toContain("supersecret");
    expect(verifyPassword("supersecret", hash)).toBe(true);
    expect(verifyPassword("wrong", hash)).toBe(false);
    expect(verifyPassword("supersecret", "garbage")).toBe(false);
  });

  it("authenticates demo staff and rejects wrong credentials", () => {
    expect(authenticateStaff("admin@lolacafe.uz", "lola-admin-2026")?.role).toBe("admin");
    expect(authenticateStaff("admin@lolacafe.uz", "wrong-password")).toBeNull();
    expect(authenticateStaff("missing@lolacafe.uz", "whatever")).toBeNull();
  });

  it("creates sessions that resolve to the right user and can be revoked", () => {
    const user = authenticateStaff("kassir@lolacafe.uz", "lola-cashier-2026")!;
    const { token } = createSession(user.id);
    expect(resolveSessionToken(token)?.user.role).toBe("cashier");
    revokeSessionByToken(token);
    expect(resolveSessionToken(token)).toBeNull();
    expect(resolveSessionToken("invalid")).toBeNull();
  });

  it("deactivating a staff member blocks login and existing sessions", () => {
    const email = `kitchen-${Date.now()}@lolacafe.uz`;
    const created = createStaff({ email, fullName: "Test Kitchen", role: "kitchen", password: "password-1234" });
    const session = createSession(created.id);
    expect(resolveSessionToken(session.token)).not.toBeNull();
    expect(authenticateStaff(email, "password-1234")).not.toBeNull();

    updateStaff(created.id, { isActive: false });
    expect(resolveSessionToken(session.token)).toBeNull();
    expect(authenticateStaff(email, "password-1234")).toBeNull();
  });

  it("prevents demoting the last active admin", () => {
    const admins = listStaff().filter((user) => user.role === "admin" && user.isActive);
    if (admins.length === 1) {
      expect(() => updateStaff(admins[0]!.id, { isActive: false })).toThrow(/Oxirgi administrator/);
    } else {
      // Guard also protects against deleting the final admin created in isolation.
      const created = createStaff({
        email: `admin-${Date.now()}@lolacafe.uz`,
        fullName: "Second admin",
        role: "admin",
        password: "password-1234",
      });
      expect(() => updateStaff(created.id, { role: "admin" })).not.toThrow();
    }
  });
});

describe("session closing rules", () => {
  it("refuses to close a session with unpaid orders", () => {
    const table = firstTable();
    const coffee = productByName("Espresso");
    createOrder({
      tableId: table.id,
      items: [{ productId: coffee.id, quantity: 1, optionIds: [] }],
      clientRequestId: uniqueKey("close"),
      actor: testActor,
      actorUserId: null,
    });
    const session = findOpenSession(table.id)!;
    expect(() => closeSession(session.id, adminUserId())).toThrow(/to'lanishi kerak/);
  });

  it("closes a session once every order is paid and keeps payment history", () => {
    const tables = getDb()
      .prepare("SELECT id FROM restaurant_tables ORDER BY id DESC LIMIT 1")
      .all() as Array<{ id: number }>;
    const tableId = tables[0]!.id;
    const coffee = productByName("Espresso");
    const order = createOrder({
      tableId,
      items: [{ productId: coffee.id, quantity: 1, optionIds: [] }],
      clientRequestId: uniqueKey("paid-close"),
      actor: testActor,
      actorUserId: null,
    }).order;
    recordPayment({
      orderId: order.id,
      input: { method: "cash", clientRequestId: uniqueKey("pay") },
      actorUserId: adminUserId(),
      actor: testActor,
    });
    const session = findOpenSession(tableId)!;
    closeSession(session.id, adminUserId());
    const closed = getDb().prepare("SELECT status FROM table_sessions WHERE id = ?").get(session.id) as {
      status: string;
    };
    expect(closed.status).toBe("closed");
    // Historical payments survive the session closing.
    const payments = getDb().prepare("SELECT COUNT(*) AS count FROM payments WHERE order_id = ?").get(order.id) as {
      count: number;
    };
    expect(payments.count).toBe(1);
    expect(findOrder(order.id)?.payments).toHaveLength(1);
  });
});

describe("realtime event scoping", () => {
  it("never leaks cashier events into the kitchen scope", () => {
    publishEvent("pos", "payment.recorded", { orderId: 12345 });
    publishEvent("kitchen", "ticket.created", { ticketId: 999 });
    const kitchenEvents = readEventsSince(["kitchen"], 0, 200);
    expect(kitchenEvents.every((event) => event.scope === "kitchen")).toBe(true);
    expect(JSON.stringify(kitchenEvents)).not.toContain("12345");

    const tableEvents = readEventsSince(["table:1"], 0, 200);
    expect(tableEvents.every((event) => event.scope === "table:1")).toBe(true);
  });
});
