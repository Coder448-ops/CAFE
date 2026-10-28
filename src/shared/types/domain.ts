/**
 * Domain contracts shared by browser and server code.
 * Monetary values are always integer TIYIN; timestamps are ISO-8601 UTC strings.
 */

export type Role = "admin" | "cashier" | "kitchen";

export type StaffUser = {
  id: number;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

export type MenuCategory = {
  id: number;
  slug: string;
  nameUz: string;
  descriptionUz: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
};

export type ProductOption = {
  id: number;
  nameUz: string;
  priceDeltaTiyin: number;
  isDefault: boolean;
};

export type ProductOptionGroup = {
  id: number;
  nameUz: string;
  required: boolean;
  maxSelect: number;
  options: ProductOption[];
};

export type Product = {
  id: number;
  categoryId: number;
  categorySlug: string;
  nameUz: string;
  descriptionUz: string | null;
  priceTiyin: number;
  imageUrl: string | null;
  station: "kitchen" | "bar" | "none";
  prepMinutes: number;
  isActive: boolean;
  isAvailable: boolean;
  sortOrder: number;
  optionGroups: ProductOptionGroup[];
};

export type OrderStatus =
  | "new"
  | "accepted"
  | "preparing"
  | "ready"
  | "served"
  | "completed"
  | "cancelled";

export type PaymentStatus = "unpaid" | "partial" | "paid" | "refunded";

export type OrderItemStatus = "pending" | "preparing" | "ready" | "served" | "cancelled";

export type OrderItemOption = {
  groupName: string;
  optionName: string;
  priceDeltaTiyin: number;
};

export type OrderItem = {
  id: number;
  productId: number | null;
  productName: string;
  unitPriceTiyin: number;
  quantity: number;
  lineTotalTiyin: number;
  station: "kitchen" | "bar" | "none";
  note: string | null;
  status: OrderItemStatus;
  options: OrderItemOption[];
};

export type Order = {
  id: number;
  orderNumber: number;
  businessDate: string;
  tableId: number;
  tableLabel: string;
  tableCode: string;
  tableSessionId: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotalTiyin: number;
  totalTiyin: number;
  paidTiyin: number;
  dueTiyin: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  acceptedAt: string | null;
  readyAt: string | null;
  servedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  items: OrderItem[];
  payments: PaymentRecord[];
};

export type PaymentRecord = {
  id: number;
  orderId: number;
  method: "cash" | "card_manual" | "other";
  amountTiyin: number;
  note: string | null;
  createdByName: string | null;
  createdAt: string;
};

export type KitchenTicket = {
  id: number;
  orderId: number;
  orderNumber: number;
  tableId: number;
  tableLabel: string;
  tableCode: string;
  station: "kitchen" | "bar";
  status: "queued" | "preparing" | "ready" | "served" | "cancelled";
  createdAt: string;
  startedAt: string | null;
  readyAt: string | null;
  servedAt: string | null;
  orderNote: string | null;
  items: Array<{
    orderItemId: number;
    productName: string;
    quantity: number;
    note: string | null;
    options: string[];
    status: OrderItemStatus;
  }>;
};

export type RestaurantTable = {
  id: number;
  code: string;
  label: string;
  zone: string;
  seats: number;
  isActive: boolean;
  openSessionId: number | null;
  sessionOpenedAt: string | null;
  activeOrders: number;
  unpaidTiyin: number;
};

export type TableDevice = {
  id: number;
  tableId: number;
  label: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  expiresAt: string;
  revokedAt: string | null;
};

/** What a paired customer device is allowed to know about itself. */
export type TableDeviceContext = {
  tableId: number;
  tableCode: string;
  tableLabel: string;
  zone: string;
  sessionId: number;
  sessionOpenedAt: string;
  orders: Order[];
  totalTiyin: number;
  paidTiyin: number;
  dueTiyin: number;
};

export type ReportSummary = {
  from: string;
  to: string;
  ordersSubmitted: number;
  ordersCompleted: number;
  ordersCancelled: number;
  netSalesTiyin: number;
  paymentsRecordedTiyin: number;
  refundsTiyin: number;
  outstandingTiyin: number;
  averageOrderTiyin: number;
  guestCount: number;
};

export type SalesByProduct = {
  productId: number | null;
  productName: string;
  quantity: number;
  revenueTiyin: number;
};

export type SalesByCategory = {
  categoryName: string;
  quantity: number;
  revenueTiyin: number;
};

export type PaymentMethodBreakdown = {
  method: "cash" | "card_manual" | "other";
  count: number;
  amountTiyin: number;
};

export type DailyPoint = {
  businessDate: string;
  paymentsTiyin: number;
  orders: number;
};

export type Reports = {
  summary: ReportSummary;
  byProduct: SalesByProduct[];
  byCategory: SalesByCategory[];
  byMethod: PaymentMethodBreakdown[];
  daily: DailyPoint[];
};

export type AuditLogEntry = {
  id: number;
  actorLabel: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: unknown;
  createdAt: string;
};

export type AppSettings = {
  restaurantName: string;
  address: string;
  phone: string;
  receiptFooter: string;
  serviceChargePercent: number;
  currency: string;
  timezone: string;
};

/** Server-sent event envelope. */
export type RealtimeEvent = {
  id: number;
  type: string;
  scope: string;
  payload: Record<string, unknown>;
  createdAt: string;
};
