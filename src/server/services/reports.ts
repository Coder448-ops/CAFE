import { getDb } from "@/server/db/client";
import { businessDateRangeUtc, todayBusinessDate } from "@/shared/lib/datetime";
import type { DailyPoint, Reports, ReportSummary } from "@/shared/types/domain";

/**
 * Reporting rules:
 *  - revenue is measured from RECORDED PAYMENTS (cash actually taken),
 *  - order totals are separate: submitted orders still have outstanding balances,
 *  - cancelled orders never count as sales,
 *  - all date bucketing uses the Asia/Tashkent business date.
 */
export function getReports(fromDate: string, toDate: string): Reports {
  const db = getDb();
  const { startIso } = businessDateRangeUtc(fromDate);
  const { endIso } = businessDateRangeUtc(toDate);

  const orders = db
    .prepare(
      `SELECT
          COUNT(*) AS submitted,
          COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS completed,
          COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled,
          COALESCE(SUM(CASE WHEN status <> 'cancelled' THEN total_tiyin ELSE 0 END), 0) AS sales,
          COALESCE(SUM(CASE WHEN status <> 'cancelled' THEN 1 ELSE 0 END), 0) AS billable,
          COALESCE(SUM(CASE WHEN status <> 'cancelled' THEN total_tiyin - paid_tiyin ELSE 0 END), 0) AS outstanding
        FROM orders
       WHERE business_date BETWEEN ? AND ?`,
    )
    .get(fromDate, toDate) as {
    submitted: number;
    completed: number;
    cancelled: number;
    sales: number;
    billable: number;
    outstanding: number;
  };

  const payments = db
    .prepare(
      `SELECT COALESCE(SUM(amount_tiyin), 0) AS total, COUNT(*) AS count
         FROM payments WHERE business_date BETWEEN ? AND ?`,
    )
    .get(fromDate, toDate) as { total: number; count: number };

  const refunds = db
    .prepare(
      `SELECT COALESCE(SUM(amount_tiyin), 0) AS total FROM refunds WHERE business_date BETWEEN ? AND ?`,
    )
    .get(fromDate, toDate) as { total: number };

  const sessions = db
    .prepare(
      `SELECT COUNT(*) AS sessions, COALESCE(SUM(COALESCE(guests, 0)), 0) AS guests
         FROM table_sessions WHERE opened_at BETWEEN ? AND ?`,
    )
    .get(startIso, endIso) as { sessions: number; guests: number };

  const summary: ReportSummary = {
    from: fromDate,
    to: toDate,
    ordersSubmitted: orders.submitted,
    ordersCompleted: orders.completed,
    ordersCancelled: orders.cancelled,
    netSalesTiyin: orders.sales,
    paymentsRecordedTiyin: payments.total,
    refundsTiyin: refunds.total,
    outstandingTiyin: orders.outstanding,
    averageOrderTiyin: orders.billable > 0 ? Math.round(orders.sales / orders.billable) : 0,
    guestCount: sessions.guests,
  };

  const byProduct = db
    .prepare(
      `SELECT oi.product_id, oi.product_name_snapshot AS product_name,
              COALESCE(SUM(oi.quantity), 0) AS quantity,
              COALESCE(SUM(oi.line_total_tiyin), 0) AS revenue
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
        WHERE o.business_date BETWEEN ? AND ? AND o.status <> 'cancelled'
        GROUP BY oi.product_id, oi.product_name_snapshot
        ORDER BY revenue DESC
        LIMIT 50`,
    )
    .all(fromDate, toDate) as Array<{
    product_id: number | null;
    product_name: string;
    quantity: number;
    revenue: number;
  }>;

  const byCategory = db
    .prepare(
      `SELECT COALESCE(c.name_uz, 'Boshqa') AS category_name,
              COALESCE(SUM(oi.quantity), 0) AS quantity,
              COALESCE(SUM(oi.line_total_tiyin), 0) AS revenue
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         LEFT JOIN products p ON p.id = oi.product_id
         LEFT JOIN menu_categories c ON c.id = p.category_id
        WHERE o.business_date BETWEEN ? AND ? AND o.status <> 'cancelled'
        GROUP BY c.id
        ORDER BY revenue DESC`,
    )
    .all(fromDate, toDate) as Array<{ category_name: string; quantity: number; revenue: number }>;

  const byMethod = db
    .prepare(
      `SELECT method, COUNT(*) AS count, COALESCE(SUM(amount_tiyin), 0) AS amount
         FROM payments WHERE business_date BETWEEN ? AND ?
        GROUP BY method
        ORDER BY amount DESC`,
    )
    .all(fromDate, toDate) as Array<{ method: "cash" | "card_manual" | "other"; count: number; amount: number }>;

  const dailyRows = db
    .prepare(
      `SELECT business_date AS day,
              COALESCE(SUM(amount_tiyin), 0) AS payments
         FROM payments WHERE business_date BETWEEN ? AND ?
        GROUP BY business_date ORDER BY business_date ASC`,
    )
    .all(fromDate, toDate) as Array<{ day: string; payments: number }>;

  const orderDaily = db
    .prepare(
      `SELECT business_date AS day, COUNT(*) AS orders
         FROM orders WHERE business_date BETWEEN ? AND ? AND status <> 'cancelled'
        GROUP BY business_date ORDER BY business_date ASC`,
    )
    .all(fromDate, toDate) as Array<{ day: string; orders: number }>;

  const orderDailyMap = new Map(orderDaily.map((row) => [row.day, row.orders]));
  const daily: DailyPoint[] = dailyRows.map((row) => ({
    businessDate: row.day,
    paymentsTiyin: row.payments,
    orders: orderDailyMap.get(row.day) ?? 0,
  }));

  return {
    summary,
    byProduct: byProduct.map((row) => ({
      productId: row.product_id,
      productName: row.product_name,
      quantity: row.quantity,
      revenueTiyin: row.revenue,
    })),
    byCategory: byCategory.map((row) => ({
      categoryName: row.category_name,
      quantity: row.quantity,
      revenueTiyin: row.revenue,
    })),
    byMethod: byMethod.map((row) => ({
      method: row.method,
      count: row.count,
      amountTiyin: row.amount,
    })),
    daily,
  };
}

export function todayRange(): { fromDate: string; toDate: string } {
  const date = todayBusinessDate();
  return { fromDate: date, toDate: date };
}

export function dashboardSnapshot() {
  const db = getDb();
  const today = todayBusinessDate();
  const openOrders = db
    .prepare(
      `SELECT COUNT(*) AS count FROM orders
        WHERE status NOT IN ('completed', 'cancelled')`,
    )
    .get() as { count: number };
  const openTables = db
    .prepare("SELECT COUNT(*) AS count FROM table_sessions WHERE status = 'open'")
    .get() as { count: number };
  const unpaid = db
    .prepare(
      `SELECT COALESCE(SUM(total_tiyin - paid_tiyin), 0) AS due FROM orders
        WHERE status <> 'cancelled' AND payment_status <> 'paid'`,
    )
    .get() as { due: number };
  const paymentsToday = db
    .prepare("SELECT COALESCE(SUM(amount_tiyin), 0) AS total FROM payments WHERE business_date = ?")
    .get(today) as { total: number };
  const tickets = db
    .prepare("SELECT COUNT(*) AS count FROM kitchen_tickets WHERE status IN ('queued', 'preparing')")
    .get() as { count: number };

  return {
    businessDate: today,
    openOrders: openOrders.count,
    openTables: openTables.count,
    outstandingTiyin: unpaid.due,
    paymentsTodayTiyin: paymentsToday.total,
    activeTickets: tickets.count,
  };
}
