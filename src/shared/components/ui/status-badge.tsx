import { Badge } from "@/shared/components/ui/badge";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  ORDER_STATUS_TONE,
} from "@/shared/constants/orders";
import type { OrderStatus, PaymentStatus } from "@/shared/types/domain";
import { cn } from "@/shared/lib/cn";

export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        ORDER_STATUS_TONE[status],
        className,
      )}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const tone =
    status === "paid" ? "success" : status === "partial" ? "warning" : status === "refunded" ? "info" : "danger";
  return <Badge tone={tone}>{PAYMENT_STATUS_LABELS[status]}</Badge>;
}
