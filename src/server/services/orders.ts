import { getDb, transaction } from "@/server/db/client";
import { badRequest, conflict, notFound, unprocessable } from "@/server/http/errors";
import { publishEvent } from "@/server/realtime/bus";
import { logAudit, type AuditActor } from "@/server/audit";
import { ensureOpenSession, findOpenSession } from "@/server/services/tables";
import { getSettings } from "@/server/services/settings";
import { businessDateOf, nowIso } from "@/shared/lib/datetime";
import {
  ORDER_TRANSITIONS,
  OPEN_ORDER_STATUSES,
} from "@/shared/constants/orders";
import type {
  Order,
  OrderItem,
  OrderItemOption,
  OrderStatus,
  PaymentRecord,
} from "@/shared/types/domain";
import type { CartItemInput } from "@/shared/validation/schemas";

// --------------------------------------------------------------- mapping ---
type OrderRow = {
  id: number;
  order_number: number;
  business_date: string;
  table_id: number;
  table_session_id: number;
  status: OrderStatus;
  payment_status: Order["paymentStatus"];
  subtotal_tiyin: number;
  service_charge_tiyin: number;
  total_tiyin: number;
  paid_tiyin: number;
  note: string | null;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
  ready_at: string | null;
  served_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  table_label: string;
  table_code: string;
};

type ItemRow = {
  id: number;
  order_id: number;
  product_id: number | null;
  product_name_snapshot: string;
  unit_price_tiyin: number;
  quantity: number;
  line_total_tiyin: number;
  station: "kitchen" | "bar" | "none";
  note: string | null;
  status: OrderItem["status"];
};

type OptionRow = {
  order_item_id: number;
  group_name_snapshot: string;
  option_name_snapshot: string;
  price_delta_tiyin: number;
};

type PaymentRow = {
  id: number;
  order_id: number;
  method: PaymentRecord["method"];
  amount_tiyin: number;
  note: string | null;
  created_at: string;
  created_by_name: string | null;
};

const ORDER_SELECT = `
  SELECT o.id, o.order_number, o.business_date, o.table_id, o.table_session_id, o.status,
         o.payment_status, o.subtotal_tiyin, o.service_charge_tiyin, o.total_tiyin, o.paid_tiyin,
         o.note, o.created_at, o.updated_at, o.accepted_at, o.ready_at, o.served_at,
         o.completed_at, o.cancelled_at, o.cancel_reason,
         t.label AS table_label, t.code AS table_code
    FROM orders o
    JOIN restaurant_tables t ON t.id = o.table_id
`;

function hydrateOrders(rows: OrderRow[]): Order[] {
  if (rows.length === 0) return [];
  const db = getDb();
  const ids = rows.map((row) => row.id);
  const placeholders = ids.map(() => "?").join(",");

  const items = db
    .prepare(
      `SELECT id, order_id, product_id, product_name_snapshot, unit_price_tiyin, quantity,
              line_total_tiyin, station, note, status
         FROM order_items
        WHERE order_id IN (${placeholders})
        ORDER BY id ASC`,
    )
    .all(...ids) as ItemRow[];

  const options = db
    .prepare(
      `SELECT oio.order_item_id, oio.group_name_snapshot, oio.option_name_snapshot, oio.price_delta_tiyin
         FROM order_item_options oio
         JOIN order_items oi ON oi.id = oio.order_item_id
        WHERE oi.order_id IN (${placeholders})
        ORDER BY oio.id ASC`,
    )
    .all(...ids) as OptionRow[];

  const payments = db
    .prepare(
      `SELECT p.id, p.order_id, p.method, p.amount_tiyin, p.note, p.created_at,
              u.full_name AS created_by_name
         FROM payments p
         LEFT JOIN users u ON u.id = p.created_by
        WHERE p.order_id IN (${placeholders})
        ORDER BY p.id ASC`,
    )
    .all(...ids) as PaymentRow[];

  const itemsByOrder = new Map<number, OrderItem[]>();
  const optionsByItem = new Map<number, OrderItemOption[]>();
  for (const option of options) {
    const list = optionsByItem.get(option.order_item_id) ?? [];
    list.push({
      groupName: option.group_name_snapshot,
      optionName: option.option_name_snapshot,
      priceDeltaTiyin: option.price_delta_tiyin,
    });
    optionsByItem.set(option.order_item_id, list);
  }
  for (const item of items) {
    const list = itemsByOrder.get(item.order_id) ?? [];
    list.push({
      id: item.id,
      productId: item.product_id,
      productName: item.product_name_snapshot,
      unitPriceTiyin: item.unit_price_tiyin,
      quantity: item.quantity,
      lineTotalTiyin: item.line_total_tiyin,
      station: item.station,
      note: item.note,
      status: item.status,
      options: optionsByItem.get(item.id) ?? [],
    });
    itemsByOrder.set(item.order_id, list);
  }

  const paymentsByOrder = new Map<number, PaymentRecord[]>();
  for (const payment of payments) {
    const list = paymentsByOrder.get(payment.order_id) ?? [];
    list.push({
      id: payment.id,
      orderId: payment.order_id,
      method: payment.method,
      amountTiyin: payment.amount_tiyin,
      note: payment.note,
      createdByName: payment.created_by_name,
      createdAt: payment.created_at,
    });
    paymentsByOrder.set(payment.order_id, list);
  }

  return rows.map((row) => ({
    id: row.id,
    orderNumber: row.order_number,
    businessDate: row.business_date,
    tableId: row.table_id,
    tableLabel: row.table_label,
    tableCode: row.table_code,
    tableSessionId: row.table_session_id,
    status: row.status,
    paymentStatus: row.payment_status,
    subtotalTiyin: row.subtotal_tiyin,
    totalTiyin: row.total_tiyin,
    paidTiyin: row.paid_tiyin,
    dueTiyin: Math.max(0, row.total_tiyin - row.paid_tiyin),
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    acceptedAt: row.accepted_at,
    readyAt: row.ready_at,
    servedAt: row.served_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    cancelReason: row.cancel_reason,
    items: itemsByOrder.get(row.id) ?? [],
    payments: paymentsByOrder.get(row.id) ?? [],
  }));
}

// ------------------------------------------------------------- querying ---
export type OrderFilters = {
  status?: OrderStatus | "active" | "all";
  paymentStatus?: Order["paymentStatus"];
  tableId?: number;
  businessDate?: string;
  search?: string;
  limit?: number;
};

export function listOrders(filters: OrderFilters = {}): Order[] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filters.status && filters.status !== "all") {
    if (filters.status === "active") {
      clauses.push(`o.status IN (${OPEN_ORDER_STATUSES.map(() => "?").join(",")})`);
      params.push(...OPEN_ORDER_STATUSES);
    } else {
      clauses.push("o.status = ?");
      params.push(filters.status);
    }
  }
  if (filters.paymentStatus) {
    clauses.push("o.payment_status = ?");
    params.push(filters.paymentStatus);
  }
  if (filters.tableId) {
    clauses.push("o.table_id = ?");
    params.push(filters.tableId);
  }
  if (filters.businessDate) {
    clauses.push("o.business_date = ?");
    params.push(filters.businessDate);
  }
  if (filters.search) {
    const term = filters.search.trim();
    if (/^\d+$/.test(term)) {
      clauses.push("(o.order_number = ? OR t.code LIKE ?)");
      params.push(Number(term), `%${term}%`);
    } else {
      clauses.push("(t.label LIKE ? OR t.code LIKE ? OR o.note LIKE ?)");
      params.push(`%${term}%`, `%${term}%`, `%${term}%`);
    }
  }
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 300);
  const rows = getDb()
    .prepare(
      `${ORDER_SELECT}
       ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
       ORDER BY o.id DESC
       LIMIT ${limit}`,
    )
    .all(...params) as OrderRow[];
  return hydrateOrders(rows);
}

export function getOrder(orderId: number): Order {
  const rows = getDb().prepare(`${ORDER_SELECT} WHERE o.id = ?`).all(orderId) as OrderRow[];
  const [order] = hydrateOrders(rows);
  if (!order) throw notFound("Buyurtma topilmadi");
  return order;
}

export function findOrder(orderId: number): Order | null {
  const rows = getDb().prepare(`${ORDER_SELECT} WHERE o.id = ?`).all(orderId) as OrderRow[];
  return hydrateOrders(rows)[0] ?? null;
}

export function listOrdersForSession(sessionId: number): Order[] {
  const rows = getDb()
    .prepare(`${ORDER_SELECT} WHERE o.table_session_id = ? ORDER BY o.id ASC`)
    .all(sessionId) as OrderRow[];
  return hydrateOrders(rows);
}

// ------------------------------------------------------------ creation ----
type PricedOption = { groupName: string; optionId: number; optionName: string; priceDeltaTiyin: number };
type PricedLine = {
  productId: number;
  productName: string;
  unitPriceTiyin: number;
  quantity: number;
  lineTotalTiyin: number;
  station: "kitchen" | "bar" | "none";
  note: string | null;
  options: PricedOption[];
};

/**
 * Prices EVERY line from authoritative database rows. Client-supplied prices
 * are never trusted — the request only carries product ids, quantities and
 * option ids.
 */
function priceCart(items: CartItemInput[]): { lines: PricedLine[]; subtotalTiyin: number } {
  const db = getDb();
  const lines: PricedLine[] = [];
  let subtotal = 0;

  for (const item of items) {
    const product = db
      .prepare(
        `SELECT p.id, p.name_uz, p.price_tiyin, p.station, p.is_active, p.is_available,
                c.is_active AS category_active
           FROM products p
           JOIN menu_categories c ON c.id = p.category_id
          WHERE p.id = ?`,
      )
      .get(item.productId) as
      | {
          id: number;
          name_uz: string;
          price_tiyin: number;
          station: "kitchen" | "bar" | "none";
          is_active: number;
          is_available: number;
          category_active: number;
        }
      | undefined;

    if (!product || product.is_active !== 1 || product.category_active !== 1) {
      throw unprocessable("Mahsulot mavjud emas", { productId: item.productId });
    }
    if (product.is_available !== 1) {
      throw unprocessable(`"${product.name_uz}" hozircha mavjud emas`, { productId: item.productId });
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw badRequest("Miqdor noto'g'ri");
    }

    const optionIds = Array.from(new Set(item.optionIds ?? []));
    const options: PricedOption[] = [];
    let deltaTotal = 0;
    if (optionIds.length > 0) {
      const placeholders = optionIds.map(() => "?").join(",");
      const rows = db
        .prepare(
          `SELECT o.id, o.name_uz, o.price_delta_tiyin, o.is_active, g.name_uz AS group_name,
                  g.id AS group_id, g.max_select, g.product_id
             FROM product_options o
             JOIN product_option_groups g ON g.id = o.group_id
            WHERE o.id IN (${placeholders})`,
        )
        .all(...optionIds) as Array<{
        id: number;
        name_uz: string;
        price_delta_tiyin: number;
        is_active: number;
        group_name: string;
        group_id: number;
        max_select: number;
        product_id: number;
      }>;
      if (rows.length !== optionIds.length) throw badRequest("Tanlangan qo'shimcha topilmadi");
      const perGroup = new Map<number, number>();
      for (const row of rows) {
        if (row.product_id !== product.id) throw badRequest("Qo'shimcha boshqa mahsulotga tegishli");
        if (row.is_active !== 1) throw unprocessable("Tanlangan qo'shimcha mavjud emas");
        const count = (perGroup.get(row.group_id) ?? 0) + 1;
        if (count > row.max_select) throw badRequest("Qo'shimcha tanlov chegarasidan oshib ketdi");
        perGroup.set(row.group_id, count);
        deltaTotal += row.price_delta_tiyin;
        options.push({
          groupName: row.group_name,
          optionId: row.id,
          optionName: row.name_uz,
          priceDeltaTiyin: row.price_delta_tiyin,
        });
      }
    }

    const unitPrice = product.price_tiyin + deltaTotal;
    const lineTotal = unitPrice * item.quantity;
    subtotal += lineTotal;
    lines.push({
      productId: product.id,
      productName: product.name_uz,
      unitPriceTiyin: unitPrice,
      quantity: item.quantity,
      lineTotalTiyin: lineTotal,
      station: product.station,
      note: item.note ?? null,
      options,
    });
  }

  return { lines, subtotalTiyin: subtotal };
}

function nextOrderNumber(businessDate: string): number {
  const row = getDb()
    .prepare("SELECT COALESCE(MAX(order_number), 0) AS maxNumber FROM orders WHERE business_date = ?")
    .get(businessDate) as { maxNumber: number };
  return row.maxNumber + 1;
}

function createTicketsForOrder(
  orderId: number,
  orderNumber: number,
  tableId: number,
  lineIds: Array<{ id: number; station: string }>,
): void {
  const db = getDb();
  const now = nowIso();
  const byStation = new Map<"kitchen" | "bar", number[]>();
  for (const line of lineIds) {
    if (line.station !== "kitchen" && line.station !== "bar") continue;
    const list = byStation.get(line.station) ?? [];
    list.push(line.id);
    byStation.set(line.station, list);
  }
  for (const [station, itemIds] of byStation) {
    const result = db
      .prepare(
        `INSERT INTO kitchen_tickets (order_id, order_number, table_id, station, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'queued', ?, ?)`,
      )
      .run(orderId, orderNumber, tableId, station, now, now);
    const ticketId = Number(result.lastInsertRowid);
    const insertItem = db.prepare(
      "INSERT INTO kitchen_ticket_items (ticket_id, order_item_id) VALUES (?, ?)",
    );
    for (const itemId of itemIds) insertItem.run(ticketId, itemId);
    publishEvent("kitchen", "ticket.created", { ticketId, orderId, orderNumber, tableId, station });
  }
}

type CreateOrderArgs = {
  tableId: number;
  items: CartItemInput[];
  note?: string | null;
  clientRequestId: string;
  deviceId?: number | null;
  actorUserId: number | null;
  actor: AuditActor;
};

/**
 * The single write path for new orders. Runs as one transaction:
 * validation -> pricing snapshot -> order + items -> kitchen tickets -> events.
 * Idempotency is guaranteed by (table_session_id, client_request_id).
 */
export function createOrder(args: CreateOrderArgs): { order: Order; duplicate: boolean } {
  const businessDate = businessDateOf();
  const db = getDb();

  const result = db.transaction((): { orderId: number; duplicate: boolean } => {
    if (args.items.length === 0) throw badRequest("Savat bo'sh");

    const session = ensureOpenSession(args.tableId, args.actorUserId);

    const existing = db
      .prepare(
        `SELECT id FROM orders WHERE table_session_id = ? AND client_request_id = ?`,
      )
      .get(session.id, args.clientRequestId) as { id: number } | undefined;
    if (existing) return { orderId: existing.id, duplicate: true };

    const { lines, subtotalTiyin } = priceCart(args.items);
    if (lines.length === 0) throw badRequest("Savat bo'sh");

    const serviceChargePercent = getSettings().serviceChargePercent;
    const serviceCharge = Math.round((subtotalTiyin * serviceChargePercent) / 100);
    const total = subtotalTiyin + serviceCharge;
    const orderNumber = nextOrderNumber(businessDate);
    const now = nowIso();

    const insertOrder = db
      .prepare(
        `INSERT INTO orders (order_number, business_date, table_id, table_session_id, customer_device_id,
                             status, payment_status, subtotal_tiyin, service_charge_tiyin, total_tiyin,
                             paid_tiyin, note, client_request_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'new', 'unpaid', ?, ?, ?, 0, ?, ?, ?, ?)`,
      )
      .run(
        orderNumber,
        businessDate,
        args.tableId,
        session.id,
        args.deviceId ?? null,
        subtotalTiyin,
        serviceCharge,
        total,
        args.note ?? null,
        args.clientRequestId,
        now,
        now,
      );
    const orderId = Number(insertOrder.lastInsertRowid);

    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, product_id, product_name_snapshot, unit_price_tiyin,
                                quantity, line_total_tiyin, station, note, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    );
    const insertOption = db.prepare(
      `INSERT INTO order_item_options (order_item_id, option_id, group_name_snapshot,
                                       option_name_snapshot, price_delta_tiyin)
       VALUES (?, ?, ?, ?, ?)`,
    );

    const lineIds: Array<{ id: number; station: string }> = [];
    for (const line of lines) {
      const inserted = insertItem.run(
        orderId,
        line.productId,
        line.productName,
        line.unitPriceTiyin,
        line.quantity,
        line.lineTotalTiyin,
        line.station,
        line.note,
      );
      const itemId = Number(inserted.lastInsertRowid);
      lineIds.push({ id: itemId, station: line.station });
      for (const option of line.options) {
        insertOption.run(itemId, option.optionId, option.groupName, option.optionName, option.priceDeltaTiyin);
      }
    }

    createTicketsForOrder(orderId, orderNumber, args.tableId, lineIds);

    publishEvent("pos", "order.created", { orderId, orderNumber, tableId: args.tableId });
    publishEvent(`table:${args.tableId}`, "order.created", { orderId, orderNumber });

    logAudit({
      actor: args.actor,
      action: "order.created",
      entityType: "order",
      entityId: orderId,
      details: { orderNumber, totalTiyin: total, itemCount: lines.length },
    });

    return { orderId, duplicate: false };
  })();

  return { order: getOrder(result.orderId), duplicate: result.duplicate };
}

// ----------------------------------------------------- status transition ---
type StatusChange = {
  orderId: number;
  status: OrderStatus;
  reason?: string | null;
  actorUserId: number | null;
  actor: AuditActor;
};

/**
 * Central status transition with an explicit graph. Every write also syncs
 * kitchen tickets and order/item timestamps inside the same transaction.
 */
export function changeOrderStatus(change: StatusChange): Order {
  const db = getDb();
  db.transaction(() => {
    const current = db
      .prepare("SELECT id, status, table_id, order_number, payment_status, paid_tiyin FROM orders WHERE id = ?")
      .get(change.orderId) as
      | {
          id: number;
          status: OrderStatus;
          table_id: number;
          order_number: number;
          payment_status: string;
          paid_tiyin: number;
        }
      | undefined;
    if (!current) throw notFound("Buyurtma topilmadi");
    if (current.status === change.status) return;

    const allowed = ORDER_TRANSITIONS[current.status];
    if (!allowed.includes(change.status)) {
      throw conflict(`"${current.status}" holatidan "${change.status}" holatiga o'tib bo'lmaydi`);
    }
    if (change.status === "cancelled" && current.payment_status === "paid") {
      throw unprocessable("To'langan buyurtmani bekor qilish uchun avval qaytarish (refund) qiling");
    }

    const now = nowIso();
    const stamps: Record<string, string | null> = {
      accepted_at: change.status === "accepted" ? now : null,
      ready_at: change.status === "ready" ? now : null,
      served_at: change.status === "served" ? now : null,
      completed_at: change.status === "completed" ? now : null,
      cancelled_at: change.status === "cancelled" ? now : null,
    };
    const assignments = ["status = ?", "updated_at = ?"];
    const params: unknown[] = [change.status, now];
    for (const [column, value] of Object.entries(stamps)) {
      if (value) {
        assignments.push(`${column} = ?`);
        params.push(value);
      }
    }
    if (change.status === "cancelled") {
      assignments.push("cancel_reason = ?");
      params.push(change.reason ?? "Sababsiz");
    }
    params.push(change.orderId);
    db.prepare(`UPDATE orders SET ${assignments.join(", ")} WHERE id = ?`).run(...params);

    // Keep order items in sync with the order-level status.
    const itemStatus: Record<string, string | null> = {
      accepted: null,
      preparing: "preparing",
      ready: "ready",
      served: "served",
      completed: "served",
      cancelled: "cancelled",
    };
    const nextItemStatus = itemStatus[change.status];
    if (nextItemStatus) {
      db.prepare(
        "UPDATE order_items SET status = ? WHERE order_id = ? AND status <> 'cancelled'",
      ).run(nextItemStatus, change.orderId);
    }

    const ticketStatus: Record<string, string | null> = {
      accepted: null,
      preparing: "preparing",
      ready: "ready",
      served: "served",
      completed: "served",
      cancelled: "cancelled",
    };
    const nextTicketStatus = ticketStatus[change.status];
    if (nextTicketStatus) {
      const started = change.status === "preparing" ? now : null;
      const ready = change.status === "ready" ? now : null;
      const served = change.status === "served" ? now : null;
      db.prepare(
        `UPDATE kitchen_tickets
            SET status = ?, updated_at = ?,
                started_at = COALESCE(started_at, ?),
                ready_at = COALESCE(ready_at, ?),
                served_at = COALESCE(served_at, ?)
          WHERE order_id = ?`,
      ).run(nextTicketStatus, now, started, ready, served, change.orderId);
    }

    publishEvent("pos", "order.updated", {
      orderId: change.orderId,
      tableId: current.table_id,
      status: change.status,
    });
    publishEvent("kitchen", "order.updated", {
      orderId: change.orderId,
      status: change.status,
    });
    publishEvent(`table:${current.table_id}`, "order.updated", {
      orderId: change.orderId,
      status: change.status,
    });

    logAudit({
      actor: change.actor,
      action: `order.${change.status}`,
      entityType: "order",
      entityId: change.orderId,
      details: { from: current.status, to: change.status, reason: change.reason ?? null },
    });
  })();

  return getOrder(change.orderId);
}

/** Recomputes payment_status and paid_tiyin from the append-only payment ledger. */
export function recomputePaymentState(orderId: number): void {
  const db = getDb();
  const order = db
    .prepare("SELECT id, total_tiyin FROM orders WHERE id = ?")
    .get(orderId) as { id: number; total_tiyin: number } | undefined;
  if (!order) throw notFound("Buyurtma topilmadi");

  const paid = db
    .prepare("SELECT COALESCE(SUM(amount_tiyin), 0) AS paid FROM payments WHERE order_id = ?")
    .get(orderId) as { paid: number };
  const refunded = db
    .prepare("SELECT COALESCE(SUM(amount_tiyin), 0) AS refunded FROM refunds WHERE order_id = ?")
    .get(orderId) as { refunded: number };

  const net = paid.paid - refunded.refunded;
  if (refunded.refunded > 0 && net <= 0) {
    db.prepare("UPDATE orders SET paid_tiyin = 0, payment_status = 'refunded', updated_at = ? WHERE id = ?").run(
      nowIso(),
      orderId,
    );
  } else if (net >= order.total_tiyin) {
    db.prepare("UPDATE orders SET paid_tiyin = ?, payment_status = 'paid', updated_at = ? WHERE id = ?").run(
      Math.max(net, 0),
      nowIso(),
      orderId,
    );
  } else if (net > 0) {
    db.prepare("UPDATE orders SET paid_tiyin = ?, payment_status = 'partial', updated_at = ? WHERE id = ?").run(
      net,
      nowIso(),
      orderId,
    );
  } else {
    db.prepare("UPDATE orders SET paid_tiyin = 0, payment_status = 'unpaid', updated_at = ? WHERE id = ?").run(
      nowIso(),
      orderId,
    );
  }
}

export function sessionSummary(sessionId: number): { totalTiyin: number; paidTiyin: number; dueTiyin: number } {
  const row = getDb()
    .prepare(
      `SELECT COALESCE(SUM(total_tiyin), 0) AS total, COALESCE(SUM(paid_tiyin), 0) AS paid
         FROM orders WHERE table_session_id = ? AND status <> 'cancelled'`,
    )
    .get(sessionId) as { total: number; paid: number };
  return { totalTiyin: row.total, paidTiyin: row.paid, dueTiyin: Math.max(0, row.total - row.paid) };
}

export function activeSessionIdForTable(tableId: number): number | null {
  return findOpenSession(tableId)?.id ?? null;
}

export { transaction };
