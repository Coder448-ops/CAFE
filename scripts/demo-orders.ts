/**
 * Optional demo helper: creates a few realistic orders so the cashier and
 * kitchen screens are not empty when showing the system to someone.
 *
 *   npm run demo:orders
 *
 * Uses the same service layer as the HTTP API, so all business rules
 * (server pricing, kitchen tickets, audit, realtime events) still apply.
 * DEVELOPMENT USE ONLY.
 */
import { listProducts } from "../src/server/services/menu";
import { listTables } from "../src/server/services/tables";
import { changeOrderStatus, createOrder } from "../src/server/services/orders";
import { recordPayment } from "../src/server/services/payments";
import { updateTicketStatus, listTickets } from "../src/server/services/kitchen";
import { businessDateOf } from "../src/shared/lib/datetime";

const actor = { userId: null, label: "Demo generator", role: "admin" };

function product(name: string) {
  const found = listProducts().find((candidate) => candidate.nameUz === name);
  if (!found) throw new Error(`Mahsulot topilmadi: ${name}. Avval "npm run db:setup" ishlating.`);
  return found;
}

function requestId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const tables = listTables();
if (tables.length < 3) throw new Error("Kamida 3 ta stol kerak (npm run db:setup)");

// 1) Yangi buyurtma — kassir qabul qilishi kutiladi.
const first = createOrder({
  tableId: tables[0]!.id,
  items: [
    { productId: product("Kapuchino").id, quantity: 2, optionIds: [] },
    { productId: product("Tiramisu").id, quantity: 1, optionIds: [], note: "Sovuq bo'lsin" },
  ],
  note: "Deraza yonidagi stol",
  clientRequestId: requestId("demo"),
  actor,
  actorUserId: null,
});
changeOrderStatus({ orderId: first.order.id, status: "accepted", actor, actorUserId: null });

// 2) Oshxonada tayyorlanayotgan buyurtma.
const second = createOrder({
  tableId: tables[1]!.id,
  items: [
    { productId: product("Lola burger").id, quantity: 1, optionIds: [] },
    { productId: product("Uy limonadi").id, quantity: 2, optionIds: [] },
    { productId: product("Sezar salat").id, quantity: 1, optionIds: [] },
  ],
  clientRequestId: requestId("demo"),
  actor,
  actorUserId: null,
});
changeOrderStatus({ orderId: second.order.id, status: "accepted", actor, actorUserId: null });
const tickets = listTickets().filter((ticket) => ticket.orderId === second.order.id);
for (const ticket of tickets) {
  updateTicketStatus({ ticketId: ticket.id, status: "preparing", actor, actorUserId: null });
}

// 3) To'langan va yakunlangan buyurtma — hisobot uchun.
const third = createOrder({
  tableId: tables[2]!.id,
  items: [
    { productId: product("Amerikano").id, quantity: 1, optionIds: [] },
    { productId: product("Kruassan").id, quantity: 2, optionIds: [] },
  ],
  clientRequestId: requestId("demo"),
  actor,
  actorUserId: null,
});
for (const status of ["accepted", "preparing", "ready", "served", "completed"] as const) {
  changeOrderStatus({ orderId: third.order.id, status, actor, actorUserId: null });
}
recordPayment({
  orderId: third.order.id,
  input: { method: "cash", clientRequestId: requestId("demo-pay") },
  actorUserId: 1,
  actor,
});

console.log(`Demo buyurtmalar yaratildi (${businessDateOf()}):`);
console.log(`  #${first.order.orderNumber} — yangi (${first.order.tableLabel})`);
console.log(`  #${second.order.orderNumber} — oshxonada (${second.order.tableLabel})`);
console.log(`  #${third.order.orderNumber} — to'langan va yakunlangan (${third.order.tableLabel})`);
