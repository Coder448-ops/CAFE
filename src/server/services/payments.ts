import { getDb } from "@/server/db/client";
import { conflict, notFound, unprocessable } from "@/server/http/errors";
import { publishEvent } from "@/server/realtime/bus";
import { logAudit, type AuditActor } from "@/server/audit";
import { getOrder, recomputePaymentState } from "@/server/services/orders";
import { businessDateOf, nowIso } from "@/shared/lib/datetime";
import type { Order, PaymentRecord } from "@/shared/types/domain";
import type { RecordPaymentInput } from "@/shared/validation/schemas";

export type PaymentResult = { order: Order; payment: PaymentRecord; duplicate: boolean };

/**
 * Records a manually confirmed payment (cash, card terminal, other).
 * There is NO payment gateway integration in this build: a card payment here
 * means staff confirmed the amount on a physical terminal.
 */
export function recordPayment(args: {
  orderId: number;
  input: RecordPaymentInput;
  actorUserId: number;
  actor: AuditActor;
}): PaymentResult {
  const db = getDb();

  const outcome = db.transaction((): { paymentId: number; duplicate: boolean } => {
    const order = db
      .prepare("SELECT id, status, total_tiyin, paid_tiyin, payment_status, table_id FROM orders WHERE id = ?")
      .get(args.orderId) as
      | {
          id: number;
          status: string;
          total_tiyin: number;
          paid_tiyin: number;
          payment_status: string;
          table_id: number;
        }
      | undefined;
    if (!order) throw notFound("Buyurtma topilmadi");
    if (order.status === "cancelled") throw unprocessable("Bekor qilingan buyurtmaga to'lov qilib bo'lmaydi");

    // Idempotency is checked BEFORE business validation so that a retried
    // request after a successful payment returns the original record instead
    // of an "already paid" error.
    const duplicate = db
      .prepare("SELECT id, order_id FROM payments WHERE client_request_id = ?")
      .get(args.input.clientRequestId) as { id: number; order_id: number } | undefined;
    if (duplicate) {
      if (duplicate.order_id !== args.orderId) {
        throw conflict("So'rov identifikatori boshqa buyurtmaga tegishli");
      }
      return { paymentId: duplicate.id, duplicate: true };
    }

    if (order.payment_status === "paid") throw conflict("Bu buyurtma allaqachon to'langan");

    const due = Math.max(0, order.total_tiyin - order.paid_tiyin);
    if (due <= 0) throw conflict("To'lanadigan summa yo'q");
    const amount = args.input.amountTiyin ?? due;
    if (!Number.isSafeInteger(amount) || amount <= 0) throw unprocessable("To'lov summasi noto'g'ri");
    if (amount > due) throw unprocessable(`To'lov summasi qarzdan katta (${due} tiyin)`);

    const now = nowIso();
    const result = db
      .prepare(
        `INSERT INTO payments (order_id, method, amount_tiyin, note, client_request_id, created_by,
                               created_at, business_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        args.orderId,
        args.input.method,
        amount,
        args.input.note ?? null,
        args.input.clientRequestId,
        args.actorUserId,
        now,
        businessDateOf(),
      );
    const paymentId = Number(result.lastInsertRowid);

    recomputePaymentState(args.orderId);

    publishEvent("pos", "payment.recorded", {
      orderId: args.orderId,
      tableId: order.table_id,
      paymentId,
    });
    publishEvent(`table:${order.table_id}`, "order.updated", { orderId: args.orderId });

    logAudit({
      actor: args.actor,
      action: "payment.recorded",
      entityType: "payment",
      entityId: paymentId,
      details: { orderId: args.orderId, amountTiyin: amount, method: args.input.method },
    });

    return { paymentId, duplicate: false };
  })();

  const order = getOrder(args.orderId);
  const payment = order.payments.find((candidate) => candidate.id === outcome.paymentId);
  if (!payment) throw notFound("To'lov topilmadi");
  return { order, payment, duplicate: outcome.duplicate };
}

export function refundPayment(args: {
  paymentId: number;
  amountTiyin: number;
  reason: string;
  actorUserId: number;
  actor: AuditActor;
}): Order {
  const db = getDb();

  const orderId = db.transaction((): number => {
    const payment = db
      .prepare(
        `SELECT p.id, p.order_id, p.amount_tiyin,
                (SELECT COALESCE(SUM(r.amount_tiyin), 0) FROM refunds r WHERE r.payment_id = p.id) AS refunded
           FROM payments p WHERE p.id = ?`,
      )
      .get(args.paymentId) as
      | { id: number; order_id: number; amount_tiyin: number; refunded: number }
      | undefined;
    if (!payment) throw notFound("To'lov topilmadi");
    const refundable = payment.amount_tiyin - payment.refunded;
    if (args.amountTiyin <= 0 || args.amountTiyin > refundable) {
      throw unprocessable("Qaytarish summasi noto'g'ri");
    }

    db.prepare(
      `INSERT INTO refunds (payment_id, order_id, amount_tiyin, reason, created_by, created_at, business_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      payment.id,
      payment.order_id,
      args.amountTiyin,
      args.reason,
      args.actorUserId,
      nowIso(),
      businessDateOf(),
    );

    recomputePaymentState(payment.order_id);
    publishEvent("pos", "payment.refunded", { orderId: payment.order_id, paymentId: payment.id });
    logAudit({
      actor: args.actor,
      action: "payment.refunded",
      entityType: "payment",
      entityId: payment.id,
      details: { orderId: payment.order_id, amountTiyin: args.amountTiyin, reason: args.reason },
    });
    return payment.order_id;
  })();

  return getOrder(orderId);
}

export function listPayments(filters: { fromDate: string; toDate: string; orderId?: number }) {
  return getDb()
    .prepare(
      `SELECT p.id, p.order_id, o.order_number, p.method, p.amount_tiyin, p.created_at, p.business_date,
              u.full_name AS created_by_name
         FROM payments p
         JOIN orders o ON o.id = p.order_id
         LEFT JOIN users u ON u.id = p.created_by
        WHERE p.business_date BETWEEN ? AND ?
          ${filters.orderId ? "AND p.order_id = ?" : ""}
        ORDER BY p.id DESC
        LIMIT 500`,
    )
    .all(
      ...(filters.orderId
        ? [filters.fromDate, filters.toDate, filters.orderId]
        : [filters.fromDate, filters.toDate]),
    );
}
