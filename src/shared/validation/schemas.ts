import { z } from "zod";

const idSchema = z.number().int().positive();
const requestIdSchema = z.string().min(8).max(64);

export const loginSchema = z.object({
  email: z.string().trim().min(3).max(160).email("To'g'ri email kiriting"),
  password: z.string().min(6, "Parol kamida 6 belgidan iborat bo'lishi kerak").max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const cartItemInputSchema = z.object({
  productId: idSchema,
  quantity: z.number().int().min(1, "Miqdor kamida 1").max(50, "Miqdor juda katta"),
  note: z.string().trim().max(200).optional().nullable(),
  optionIds: z.array(idSchema).max(10).optional().default([]),
});
export type CartItemInput = z.infer<typeof cartItemInputSchema>;

export const createOrderSchema = z.object({
  items: z.array(cartItemInputSchema).min(1, "Savat bo'sh").max(40, "Buyurtma juda katta"),
  note: z.string().trim().max(300).optional().nullable(),
  clientRequestId: requestIdSchema,
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const orderStatusUpdateSchema = z.object({
  status: z.enum(["accepted", "preparing", "ready", "served", "completed", "cancelled"]),
  reason: z.string().trim().max(200).optional(),
});
export type OrderStatusUpdateInput = z.infer<typeof orderStatusUpdateSchema>;

export const cancelOrderSchema = z.object({
  reason: z.string().trim().min(2, "Sababni yozing").max(200),
});

export const recordPaymentSchema = z.object({
  method: z.enum(["cash", "card_manual", "other"]),
  /** Optional: omit to settle the full outstanding balance. */
  amountTiyin: z.number().int().positive().optional(),
  note: z.string().trim().max(200).optional(),
  clientRequestId: requestIdSchema,
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const refundSchema = z.object({
  paymentId: idSchema,
  amountTiyin: z.number().int().positive(),
  reason: z.string().trim().min(2, "Sababni yozing").max(200),
});

export const tableSessionSchema = z.object({
  guests: z.number().int().min(1).max(50).optional(),
  notes: z.string().trim().max(200).optional(),
});

// ------------------------------------------------------------------ admin ---
export const categorySchema = z.object({
  nameUz: z.string().trim().min(2, "Nom kerak").max(80),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Faqat kichik lotin harflari, raqam va '-'"),
  descriptionUz: z.string().trim().max(300).optional().nullable(),
  sortOrder: z.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});
export type CategoryInput = z.infer<typeof categorySchema>;

export const productSchema = z.object({
  categoryId: idSchema,
  nameUz: z.string().trim().min(2, "Nom kerak").max(120),
  descriptionUz: z.string().trim().max(500).optional().nullable(),
  priceTiyin: z.number().int().min(0, "Narx manfiy bo'lmaydi").max(1_000_000_00),
  imageUrl: z.string().trim().url("To'g'ri rasm manzili kiriting").max(500).optional().nullable(),
  station: z.enum(["kitchen", "bar", "none"]),
  prepMinutes: z.number().int().min(0).max(240).default(10),
  isActive: z.boolean().default(true),
  isAvailable: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).default(0),
});
export type ProductInput = z.infer<typeof productSchema>;

export const productAvailabilitySchema = z.object({
  isAvailable: z.boolean(),
});

export const tableSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(16)
    .regex(/^[A-Z0-9-]+$/, "Faqat katta harflar, raqam va '-'"),
  label: z.string().trim().min(1, "Nom kerak").max(60),
  zone: z.string().trim().min(1).max(60),
  seats: z.number().int().min(1).max(50),
  isActive: z.boolean().default(true),
});
export type TableInput = z.infer<typeof tableSchema>;

export const staffSchema = z.object({
  email: z.string().trim().email("To'g'ri email kiriting").max(160),
  fullName: z.string().trim().min(2, "Ism kerak").max(120),
  role: z.enum(["admin", "cashier", "kitchen"]),
  password: z.string().min(8, "Parol kamida 8 belgi").max(200),
});
export type StaffInput = z.infer<typeof staffSchema>;

export const staffUpdateSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  role: z.enum(["admin", "cashier", "kitchen"]).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).max(200).optional(),
});
export type StaffUpdateInput = z.infer<typeof staffUpdateSchema>;

export const settingsSchema = z.object({
  restaurantName: z.string().trim().min(1).max(80),
  address: z.string().trim().max(160),
  phone: z.string().trim().max(40),
  receiptFooter: z.string().trim().max(200),
  serviceChargePercent: z.number().int().min(0).max(30),
});
export type SettingsInput = z.infer<typeof settingsSchema>;
