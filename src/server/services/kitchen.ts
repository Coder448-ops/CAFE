import { getDb } from "@/server/db/client";
import { conflict, notFound, unprocessable } from "@/server/http/errors";
import { publishEvent } from "@/server/realtime/bus";
import { logAudit, type AuditActor } from "@/server/audit";
import { nowIso } from "@/shared/lib/datetime";
import type { KitchenTicket, OrderItemStatus } from "@/shared/types/domain";

type TicketStatus = KitchenTicket["status"];

/**
 * Kitchen DTOs deliberately contain no prices or payment information:
 * preparation staff only need what to cook and where to send it.
 */
export function listTickets(options: { station?: "kitchen" | "bar"; includeHistory?: boolean } = {}): KitchenTicket[] {
  const db = getDb();
  const clauses = ["o.status <> 'cancelled'"];
  const params: unknown[] = [];
  if (options.station) {
    clauses.push("kt.station = ?");
    params.push(options.station);
  }
  if (!options.includeHistory) {
    clauses.push("kt.status IN ('queued', 'preparing', 'ready')");
  }
  const tickets = db
    .prepare(
      `SELECT kt.id, kt.order_id, kt.order_number, kt.table_id, kt.station, kt.status,
              kt.created_at, kt.started_at, kt.ready_at, kt.served_at,
              t.label AS table_label, t.code AS table_code, o.note AS order_note
         FROM kitchen_tickets kt
         JOIN orders o ON o.id = kt.order_id
         JOIN restaurant_tables t ON t.id = kt.table_id
        WHERE ${clauses.join(" AND ")}
        ORDER BY kt.created_at ASC, kt.id ASC
        LIMIT 200`,
    )
    .all(...params) as Array<{
    id: number;
    order_id: number;
    order_number: number;
    table_id: number;
    station: "kitchen" | "bar";
    status: TicketStatus;
    created_at: string;
    started_at: string | null;
    ready_at: string | null;
    served_at: string | null;
    table_label: string;
    table_code: string;
    order_note: string | null;
  }>;

  if (tickets.length === 0) return [];
  const ticketIds = tickets.map((ticket) => ticket.id);
  const placeholders = ticketIds.map(() => "?").join(",");
  const items = db
    .prepare(
      `SELECT kti.ticket_id, oi.id AS order_item_id, oi.product_name_snapshot, oi.quantity, oi.note, oi.status,
              (SELECT GROUP_CONCAT(oio.option_name_snapshot, ' · ')
                 FROM order_item_options oio WHERE oio.order_item_id = oi.id) AS options
         FROM kitchen_ticket_items kti
         JOIN order_items oi ON oi.id = kti.order_item_id
        WHERE kti.ticket_id IN (${placeholders})
        ORDER BY oi.id ASC`,
    )
    .all(...ticketIds) as Array<{
    ticket_id: number;
    order_item_id: number;
    product_name_snapshot: string;
    quantity: number;
    note: string | null;
    status: OrderItemStatus;
    options: string | null;
  }>;

  const itemsByTicket = new Map<number, KitchenTicket["items"]>();
  for (const item of items) {
    const list = itemsByTicket.get(item.ticket_id) ?? [];
    list.push({
      orderItemId: item.order_item_id,
      productName: item.product_name_snapshot,
      quantity: item.quantity,
      note: item.note,
      options: item.options ? item.options.split(" · ") : [],
      status: item.status,
    });
    itemsByTicket.set(item.ticket_id, list);
  }

  return tickets.map((ticket) => ({
    id: ticket.id,
    orderId: ticket.order_id,
    orderNumber: ticket.order_number,
    tableId: ticket.table_id,
    tableLabel: ticket.table_label,
    tableCode: ticket.table_code,
    station: ticket.station,
    status: ticket.status,
    createdAt: ticket.created_at,
    startedAt: ticket.started_at,
    readyAt: ticket.ready_at,
    servedAt: ticket.served_at,
    orderNote: ticket.order_note,
    items: itemsByTicket.get(ticket.id) ?? [],
  }));
}

const TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  queued: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["served"],
  served: [],
  cancelled: [],
};

/**
 * Kitchen-driven ticket update. Refuses conflicting transitions (for example
 * two screens trying to move the same ticket in different directions) and
 * keeps the parent order status consistent.
 */
export function updateTicketStatus(args: {
  ticketId: number;
  status: TicketStatus;
  actorUserId: number | null;
  actor: AuditActor;
  allowServe?: boolean;
  allowCancel?: boolean;
}): KitchenTicket {
  const db = getDb();

  db.transaction(() => {
    const ticket = db
      .prepare("SELECT id, order_id, status, station FROM kitchen_tickets WHERE id = ?")
      .get(args.ticketId) as
      | { id: number; order_id: number; status: TicketStatus; station: "kitchen" | "bar" }
      | undefined;
    if (!ticket) throw notFound("Bilet topilmadi");
    if (ticket.status === args.status) return;
    if (!TICKET_TRANSITIONS[ticket.status].includes(args.status)) {
      throw conflict(`Bilet holatini "${ticket.status}" dan "${args.status}" ga o'zgartirib bo'lmaydi`);
    }
    // Serving and cancelling are cashier-level decisions, enforced here as well
    // as in the route so the rule cannot be bypassed by another caller.
    if (args.status === "served" && !args.allowServe) {
      throw unprocessable("Taom berilganini kassir belgilaydi");
    }
    if (args.status === "cancelled" && !args.allowCancel) {
      throw unprocessable("Biletni faqat kassir bekor qiladi");
    }

    const now = nowIso();
    db.prepare(
      `UPDATE kitchen_tickets
          SET status = ?, updated_at = ?,
              started_at = COALESCE(started_at, ?),
              ready_at = COALESCE(ready_at, ?),
              served_at = COALESCE(served_at, ?)
        WHERE id = ?`,
    ).run(
      args.status,
      now,
      args.status === "preparing" ? now : null,
      args.status === "ready" ? now : null,
      args.status === "served" ? now : null,
      ticket.id,
    );

    const itemStatus = args.status === "preparing" ? "preparing" : args.status === "ready" ? "ready" : args.status === "served" ? "served" : "cancelled";
    db.prepare(
      `UPDATE order_items SET status = ?
        WHERE id IN (SELECT order_item_id FROM kitchen_ticket_items WHERE ticket_id = ?)`,
    ).run(itemStatus, ticket.id);

    syncOrderStatusFromTickets(ticket.order_id, args.actor, args.actorUserId);

    publishEvent("pos", "ticket.updated", { ticketId: ticket.id, orderId: ticket.order_id, status: args.status });
    publishEvent("kitchen", "ticket.updated", { ticketId: ticket.id, status: args.status });
    logAudit({
      actor: args.actor,
      action: `ticket.${args.status}`,
      entityType: "kitchen_ticket",
      entityId: ticket.id,
      details: { orderId: ticket.order_id, station: ticket.station },
    });
  })();

  const tickets = listTickets({ includeHistory: true });
  const updated = tickets.find((ticket) => ticket.id === args.ticketId);
  if (!updated) throw notFound("Bilet topilmadi");
  return updated;
}

function syncOrderStatusFromTickets(orderId: number, actor: AuditActor, actorUserId: number | null): void {
  const db = getDb();
  const order = db.prepare("SELECT id, status, table_id FROM orders WHERE id = ?").get(orderId) as
    | { id: number; status: string; table_id: number }
    | undefined;
  if (!order) return;
  if (order.status === "cancelled" || order.status === "completed") return;

  const tickets = db
    .prepare("SELECT status FROM kitchen_tickets WHERE order_id = ?")
    .all(orderId) as Array<{ status: TicketStatus }>;
  if (tickets.length === 0) return;

  let next: string | null = null;
  if (tickets.every((ticket) => ticket.status === "ready" || ticket.status === "served")) {
    next = tickets.every((ticket) => ticket.status === "served") ? "served" : "ready";
  } else if (tickets.some((ticket) => ticket.status === "preparing")) {
    next = "preparing";
  }

  if (!next || next === order.status) return;
  const now = nowIso();
  db.prepare(
    `UPDATE orders SET status = ?, updated_at = ?,
        ready_at = CASE WHEN ? = 'ready' THEN COALESCE(ready_at, ?) ELSE ready_at END,
        served_at = CASE WHEN ? = 'served' THEN COALESCE(served_at, ?) ELSE served_at END
      WHERE id = ?`,
  ).run(next, now, next, now, next, now, orderId);

  publishEvent("pos", "order.updated", { orderId, tableId: order.table_id, status: next });
  publishEvent("kitchen", "order.updated", { orderId, status: next });
  publishEvent(`table:${order.table_id}`, "order.updated", { orderId, status: next });
  logAudit({
    actor,
    action: `order.${next}`,
    entityType: "order",
    entityId: orderId,
    details: { source: "kitchen", actorUserId },
  });
}
