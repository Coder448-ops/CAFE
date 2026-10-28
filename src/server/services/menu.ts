import { getDb } from "@/server/db/client";
import { nowIso } from "@/shared/lib/datetime";
import { conflict, notFound } from "@/server/http/errors";
import type { MenuCategory, Product, ProductOptionGroup } from "@/shared/types/domain";
import type { CategoryInput, ProductInput } from "@/shared/validation/schemas";

type CategoryRow = {
  id: number;
  slug: string;
  name_uz: string;
  description_uz: string | null;
  sort_order: number;
  is_active: number;
  product_count: number;
};

type ProductRow = {
  id: number;
  category_id: number;
  category_slug: string;
  name_uz: string;
  description_uz: string | null;
  price_tiyin: number;
  image_url: string | null;
  station: "kitchen" | "bar" | "none";
  prep_minutes: number;
  is_active: number;
  is_available: number;
  sort_order: number;
};

type OptionRow = {
  group_id: number;
  group_name: string;
  group_required: number;
  group_max: number;
  group_sort: number;
  option_id: number;
  option_name: string;
  option_delta: number;
  option_default: number;
};

export function listCategories(options: { includeInactive?: boolean } = {}): MenuCategory[] {
  const rows = getDb()
    .prepare(
      `SELECT c.id, c.slug, c.name_uz, c.description_uz, c.sort_order, c.is_active,
              (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.is_active = 1) AS product_count
         FROM menu_categories c
        ${options.includeInactive ? "" : "WHERE c.is_active = 1"}
        ORDER BY c.sort_order ASC, c.name_uz ASC`,
    )
    .all() as CategoryRow[];
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    nameUz: row.name_uz,
    descriptionUz: row.description_uz,
    sortOrder: row.sort_order,
    isActive: row.is_active === 1,
    productCount: row.product_count,
  }));
}

function loadOptionGroups(productIds: number[]): Map<number, ProductOptionGroup[]> {
  const map = new Map<number, ProductOptionGroup[]>();
  if (productIds.length === 0) return map;
  const placeholders = productIds.map(() => "?").join(",");
  const rows = getDb()
    .prepare(
      `SELECT g.id AS group_id, g.name_uz AS group_name, g.required AS group_required,
              g.max_select AS group_max, g.sort_order AS group_sort,
              o.id AS option_id, o.name_uz AS option_name, o.price_delta_tiyin AS option_delta,
              o.is_default AS option_default, g.product_id
         FROM product_option_groups g
         LEFT JOIN product_options o ON o.group_id = g.id AND o.is_active = 1
        WHERE g.product_id IN (${placeholders})
        ORDER BY g.sort_order ASC, o.sort_order ASC, o.id ASC`,
    )
    .all(...productIds) as Array<OptionRow & { product_id: number }>;

  for (const row of rows) {
    const groups = map.get(row.product_id) ?? [];
    let group = groups.find((candidate) => candidate.id === row.group_id);
    if (!group) {
      group = {
        id: row.group_id,
        nameUz: row.group_name,
        required: row.group_required === 1,
        maxSelect: row.group_max,
        options: [],
      };
      groups.push(group);
      map.set(row.product_id, groups);
    }
    if (row.option_id != null) {
      group.options.push({
        id: row.option_id,
        nameUz: row.option_name,
        priceDeltaTiyin: row.option_delta,
        isDefault: row.option_default === 1,
      });
    }
  }
  return map;
}

export function listProducts(
  options: { includeInactive?: boolean; categoryId?: number; onlyAvailable?: boolean } = {},
): Product[] {
  const filters: string[] = [];
  const params: unknown[] = [];
  if (!options.includeInactive) filters.push("p.is_active = 1", "c.is_active = 1");
  if (options.onlyAvailable) filters.push("p.is_available = 1");
  if (options.categoryId) {
    filters.push("p.category_id = ?");
    params.push(options.categoryId);
  }
  const rows = getDb()
    .prepare(
      `SELECT p.id, p.category_id, c.slug AS category_slug, p.name_uz, p.description_uz,
              p.price_tiyin, p.image_url, p.station, p.prep_minutes, p.is_active, p.is_available, p.sort_order
         FROM products p
         JOIN menu_categories c ON c.id = p.category_id
        ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
        ORDER BY c.sort_order ASC, p.sort_order ASC, p.name_uz ASC`,
    )
    .all(...params) as ProductRow[];

  const groups = loadOptionGroups(rows.map((row) => row.id));
  return rows.map((row) => ({
    id: row.id,
    categoryId: row.category_id,
    categorySlug: row.category_slug,
    nameUz: row.name_uz,
    descriptionUz: row.description_uz,
    priceTiyin: row.price_tiyin,
    imageUrl: row.image_url,
    station: row.station,
    prepMinutes: row.prep_minutes,
    isActive: row.is_active === 1,
    isAvailable: row.is_available === 1,
    sortOrder: row.sort_order,
    optionGroups: groups.get(row.id) ?? [],
  }));
}

export function getProduct(id: number): Product | null {
  const products = listProducts({ includeInactive: true });
  return products.find((product) => product.id === id) ?? null;
}

// ------------------------------------------------------------ admin CRUD ---
export function createCategory(input: CategoryInput): number {
  const db = getDb();
  const exists = db.prepare("SELECT id FROM menu_categories WHERE slug = ?").get(input.slug);
  if (exists) throw conflict("Bu slug allaqachon mavjud");
  const now = nowIso();
  const result = db
    .prepare(
      `INSERT INTO menu_categories (slug, name_uz, description_uz, sort_order, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(input.slug, input.nameUz, input.descriptionUz ?? null, input.sortOrder, input.isActive ? 1 : 0, now, now);
  return Number(result.lastInsertRowid);
}

export function updateCategory(id: number, input: CategoryInput): void {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM menu_categories WHERE id = ?").get(id);
  if (!existing) throw notFound("Kategoriya topilmadi");
  const slugTaken = db
    .prepare("SELECT id FROM menu_categories WHERE slug = ? AND id <> ?")
    .get(input.slug, id);
  if (slugTaken) throw conflict("Bu slug allaqachon mavjud");
  db.prepare(
    `UPDATE menu_categories
        SET slug = ?, name_uz = ?, description_uz = ?, sort_order = ?, is_active = ?, updated_at = ?
      WHERE id = ?`,
  ).run(
    input.slug,
    input.nameUz,
    input.descriptionUz ?? null,
    input.sortOrder,
    input.isActive ? 1 : 0,
    nowIso(),
    id,
  );
}

export function createProduct(input: ProductInput): number {
  const db = getDb();
  const category = db.prepare("SELECT id FROM menu_categories WHERE id = ?").get(input.categoryId);
  if (!category) throw notFound("Kategoriya topilmadi");
  const now = nowIso();
  const result = db
    .prepare(
      `INSERT INTO products (category_id, name_uz, description_uz, price_tiyin, image_url, station,
                             prep_minutes, is_active, is_available, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.categoryId,
      input.nameUz,
      input.descriptionUz ?? null,
      input.priceTiyin,
      input.imageUrl ?? null,
      input.station,
      input.prepMinutes,
      input.isActive ? 1 : 0,
      input.isAvailable ? 1 : 0,
      input.sortOrder,
      now,
      now,
    );
  return Number(result.lastInsertRowid);
}

/**
 * Price edits affect only future orders. Existing order items keep their
 * snapshotted product name and unit price.
 */
export function updateProduct(id: number, input: ProductInput): void {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM products WHERE id = ?").get(id);
  if (!existing) throw notFound("Mahsulot topilmadi");
  const category = db.prepare("SELECT id FROM menu_categories WHERE id = ?").get(input.categoryId);
  if (!category) throw notFound("Kategoriya topilmadi");
  db.prepare(
    `UPDATE products
        SET category_id = ?, name_uz = ?, description_uz = ?, price_tiyin = ?, image_url = ?,
            station = ?, prep_minutes = ?, is_active = ?, is_available = ?, sort_order = ?, updated_at = ?
      WHERE id = ?`,
  ).run(
    input.categoryId,
    input.nameUz,
    input.descriptionUz ?? null,
    input.priceTiyin,
    input.imageUrl ?? null,
    input.station,
    input.prepMinutes,
    input.isActive ? 1 : 0,
    input.isAvailable ? 1 : 0,
    input.sortOrder,
    nowIso(),
    id,
  );
}

export function setProductAvailability(id: number, isAvailable: boolean): void {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM products WHERE id = ?").get(id);
  if (!existing) throw notFound("Mahsulot topilmadi");
  db.prepare("UPDATE products SET is_available = ?, updated_at = ? WHERE id = ?").run(
    isAvailable ? 1 : 0,
    nowIso(),
    id,
  );
}

/** Soft delete: historical order items keep referencing the product row. */
export function archiveProduct(id: number): void {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM products WHERE id = ?").get(id);
  if (!existing) throw notFound("Mahsulot topilmadi");
  db.prepare("UPDATE products SET is_active = 0, is_available = 0, updated_at = ? WHERE id = ?").run(
    nowIso(),
    id,
  );
}

export function archiveCategory(id: number): void {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM menu_categories WHERE id = ?").get(id);
  if (!existing) throw notFound("Kategoriya topilmadi");
  const activeProducts = db
    .prepare("SELECT COUNT(*) AS count FROM products WHERE category_id = ? AND is_active = 1")
    .get(id) as { count: number };
  if (activeProducts.count > 0) {
    throw conflict("Avval kategoriyadagi mahsulotlarni arxivlang");
  }
  db.prepare("UPDATE menu_categories SET is_active = 0, updated_at = ? WHERE id = ?").run(nowIso(), id);
}

export const menuService = {
  listCategories,
  listProducts,
  getProduct,
  createCategory,
  updateCategory,
  createProduct,
  updateProduct,
  setProductAvailability,
  archiveProduct,
  archiveCategory,
};
