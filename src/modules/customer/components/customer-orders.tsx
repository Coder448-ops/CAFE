"use client";

import { Modal } from "@/shared/components/ui/modal";
import { Button } from "@/shared/components/ui/button";
import { EmptyState, LoadingBlock } from "@/shared/components/ui/empty-state";
import { OrderStatusBadge, PaymentStatusBadge } from "@/shared/components/ui/status-badge";
import { formatUzs } from "@/shared/lib/money";
import { formatTime } from "@/shared/lib/datetime";
import { ORDER_STATUS_LABELS } from "@/shared/constants/orders";
import type { Order, OrderStatus } from "@/shared/types/domain";

const FLOW: OrderStatus[] = ["new", "accepted", "preparing", "ready", "served", "completed"];

export function CustomerOrders({
  open,
  onClose,
  orders,
  loading,
  totalTiyin,
  paidTiyin,
  dueTiyin,
  onRefresh,
  onRequestBill,
}: {
  open: boolean;
  onClose: () => void;
  orders: Order[];
  loading: boolean;
  totalTiyin: number;
  paidTiyin: number;
  dueTiyin: number;
  onRefresh: () => void;
  onRequestBill: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Mening buyurtmalarim"
      description="Bu stoldagi joriy sessiya buyurtmalari"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onRefresh}>
            Yangilash
          </Button>
          <Button onClick={onRequestBill}>Hisobni so&apos;rash</Button>
        </>
      }
    >
      {loading ? <LoadingBlock /> : null}

      {!loading && orders.length === 0 ? (
        <EmptyState
          title="Hozircha buyurtma yo'q"
          description="Menyudan taom tanlab birinchi buyurtmani yuboring."
          icon="🧾"
        />
      ) : null}

      {orders.length > 0 ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-cream-100 p-3 text-center">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-coffee-400">Jami</p>
              <p className="text-sm font-bold text-coffee-900">{formatUzs(totalTiyin)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-coffee-400">To&apos;langan</p>
              <p className="text-sm font-bold text-moss-700">{formatUzs(paidTiyin)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-coffee-400">Qarz</p>
              <p className="text-sm font-bold text-terracotta-600">{formatUzs(dueTiyin)}</p>
            </div>
          </div>

          <ul className="space-y-3">
            {orders
              .slice()
              .sort((a, b) => b.id - a.id)
              .map((order) => (
                <li key={order.id} className="surface p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-lg font-semibold text-coffee-900">
                        #{order.orderNumber}
                      </span>
                      <OrderStatusBadge status={order.status} />
                      <PaymentStatusBadge status={order.paymentStatus} />
                    </div>
                    <span className="text-xs text-coffee-400">{formatTime(order.createdAt)}</span>
                  </div>

                  {order.status !== "cancelled" ? (
                    <div className="mt-3 flex items-center gap-1" aria-hidden>
                      {FLOW.map((step) => {
                        const reached = FLOW.indexOf(order.status) >= FLOW.indexOf(step);
                        return (
                          <div key={step} className="flex flex-1 items-center gap-1">
                            <span
                              className={`h-1.5 flex-1 rounded-full ${
                                reached ? "bg-moss-500" : "bg-coffee-100"
                              }`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                  <p className="mt-1.5 text-xs text-coffee-500">
                    {ORDER_STATUS_LABELS[order.status]}
                    {order.cancelReason ? ` · ${order.cancelReason}` : ""}
                  </p>

                  <ul className="mt-3 space-y-1 text-sm text-coffee-700">
                    {order.items.map((item) => (
                      <li key={item.id} className="flex justify-between gap-3">
                        <span>
                          {item.quantity} × {item.productName}
                          {item.options.length > 0 ? (
                            <span className="text-coffee-400">
                              {" "}
                              ({item.options.map((option) => option.optionName).join(", ")})
                            </span>
                          ) : null}
                          {item.note ? <span className="text-coffee-400"> — {item.note}</span> : null}
                        </span>
                        <span className="shrink-0 text-coffee-500">{formatUzs(item.lineTotalTiyin)}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-2 flex justify-between border-t border-coffee-100 pt-2 text-sm font-semibold">
                    <span>Jami</span>
                    <span>{formatUzs(order.totalTiyin)}</span>
                  </div>
                </li>
              ))}
          </ul>
          <p className="text-center text-xs text-coffee-400">
            To&apos;lov kassada naqd yoki plastik karta orqali amalga oshiriladi.
          </p>
        </div>
      ) : null}
    </Modal>
  );
}
