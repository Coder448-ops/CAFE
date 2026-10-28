import type { OrderStatus, PaymentStatus, Role } from "@/shared/types/domain";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Yangi",
  accepted: "Qabul qilindi",
  preparing: "Tayyorlanmoqda",
  ready: "Tayyor",
  served: "Berildi",
  completed: "Yakunlandi",
  cancelled: "Bekor qilindi",
};

export const ORDER_STATUS_TONE: Record<OrderStatus, string> = {
  new: "bg-terracotta-100 text-terracotta-700 ring-terracotta-300/60",
  accepted: "bg-cream-200 text-coffee-700 ring-coffee-200",
  preparing: "bg-amber-100 text-amber-800 ring-amber-300/60",
  ready: "bg-moss-100 text-moss-700 ring-moss-300/60",
  served: "bg-moss-50 text-moss-600 ring-moss-100",
  completed: "bg-coffee-100 text-coffee-600 ring-coffee-200",
  cancelled: "bg-red-50 text-red-700 ring-red-200",
};

/** Cashier/kitchen-driven status graph. Enforced server-side. */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ["accepted", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["served", "completed"],
  served: ["completed"],
  completed: [],
  cancelled: [],
};

export const OPEN_ORDER_STATUSES: OrderStatus[] = ["new", "accepted", "preparing", "ready", "served"];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "To'lanmagan",
  partial: "Qismiy to'langan",
  paid: "To'langan",
  refunded: "Qaytarilgan",
};

export const PAYMENT_METHOD_LABELS: Record<"cash" | "card_manual" | "other", string> = {
  cash: "Naqd",
  card_manual: "Plastik karta (terminal)",
  other: "Boshqa",
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  cashier: "Kassir",
  kitchen: "Oshxona",
};

export const ROLE_HOME: Record<Role, string> = {
  admin: "/admin",
  cashier: "/cashier",
  kitchen: "/kitchen",
};
