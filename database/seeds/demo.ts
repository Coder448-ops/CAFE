import { getDb } from "@/server/db/client";
import { hashPassword } from "@/server/auth/password";
import { nowIso } from "@/shared/lib/datetime";
import { somToTiyin } from "@/shared/lib/money";

/**
 * DEMO / DEVELOPMENT DATA ONLY.
 * Passwords here are intentionally simple and must never be used in a real
 * cafe. Production staff accounts are created with `npm run admin:create` and
 * the admin UI.
 */
export const DEMO_PASSWORDS = {
  admin: "lola-admin-2026",
  cashier: "lola-cashier-2026",
  kitchen: "lola-kitchen-2026",
} as const;

type SeedProduct = {
  name: string;
  description: string;
  priceSom: number;
  image?: string;
  station: "kitchen" | "bar" | "none";
  prep: number;
  options?: Array<{ group: string; required?: boolean; max?: number; options: Array<[string, number, boolean?]> }>;
};

const CATEGORIES: Array<{ slug: string; name: string; description: string; products: SeedProduct[] }> = [
  {
    slug: "kofe",
    name: "Kofe",
    description: "Yangi qovurilgan donadan tayyorlangan ichimliklar",
    products: [
      {
        name: "Espresso",
        description: "Ikki porsiya arabika, 30 ml",
        priceSom: 20000,
        image: "/menu/espresso.jpg",
        station: "bar",
        prep: 3,
        options: [{ group: "Qo'shimcha", max: 1, options: [["Qo'sh porsiya", 8000]] }],
      },
      {
        name: "Amerikano",
        description: "Espresso va issiq suv, yumshoq ta'm",
        priceSom: 25000,
        image: "/menu/americano.jpg",
        station: "bar",
        prep: 4,
        options: [
          {
            group: "Hajm",
            required: true,
            options: [
              ["250 ml", 0, true],
              ["350 ml", 5000],
            ],
          },
        ],
      },
      {
        name: "Kapuchino",
        description: "Espresso, bug'langan sut va zich ko'pik",
        priceSom: 32000,
        image: "/menu/cappuccino.jpg",
        station: "bar",
        prep: 5,
        options: [
          {
            group: "Sut",
            required: true,
            options: [
              ["Odatdagi sut", 0, true],
              ["Laktozasiz sut", 4000],
              ["Bodom suti", 8000],
            ],
          },
          {
            group: "Hajm",
            required: true,
            options: [
              ["250 ml", 0, true],
              ["350 ml", 6000],
            ],
          },
        ],
      },
      {
        name: "Latte",
        description: "Yumshoq sutli kofe, vanil notasida",
        priceSom: 34000,
        image: "/menu/latte.jpg",
        station: "bar",
        prep: 5,
      },
      {
        name: "Flat white",
        description: "Ikki shot espresso va nozik mikroko'pik",
        priceSom: 35000,
        image: "/menu/latte.jpg",
        station: "bar",
        prep: 5,
      },
      {
        name: "Moka",
        description: "Kofe, shokolad va sut uyg'unligi",
        priceSom: 38000,
        image: "/menu/mocha.jpg",
        station: "bar",
        prep: 6,
      },
      {
        name: "Raf kofe",
        description: "Qaymoq, vanil shakar va espresso",
        priceSom: 40000,
        image: "/menu/latte.jpg",
        station: "bar",
        prep: 6,
      },
    ],
  },
  {
    slug: "ichimliklar",
    name: "Choy va ichimliklar",
    description: "Choy, limonad va salqin ichimliklar",
    products: [
      {
        name: "Ko'k choy",
        description: "Choynakda, an'anaviy ko'k choy",
        priceSom: 12000,
        image: "/menu/tea.jpg",
        station: "bar",
        prep: 4,
      },
      {
        name: "Qora choy",
        description: "Limon va asal bilan",
        priceSom: 14000,
        image: "/menu/tea.jpg",
        station: "bar",
        prep: 4,
      },
      {
        name: "Uy limonadi",
        description: "Limon, yalpiz va gazlangan suv",
        priceSom: 26000,
        image: "/menu/lemonade.jpg",
        station: "bar",
        prep: 4,
        options: [
          {
            group: "Ta'm",
            required: true,
            options: [
              ["Klassik limon", 0, true],
              ["Malina", 3000],
              ["Yalpiz", 2000],
            ],
          },
        ],
      },
      {
        name: "Ice latte",
        description: "Muz, sut va espresso",
        priceSom: 36000,
        image: "/menu/iced-latte.jpg",
        station: "bar",
        prep: 5,
      },
      {
        name: "Ayran",
        description: "Uy sharoitida tayyorlangan, 300 ml",
        priceSom: 15000,
        image: "/menu/ayran.jpg",
        station: "bar",
        prep: 2,
      },
    ],
  },
  {
    slug: "nonushta",
    name: "Nonushta",
    description: "Ertalabki taomlar, 08:00 dan 12:00 gacha",
    products: [
      {
        name: "Omlet",
        description: "Uch tuxum, pishloq va ko'katlar",
        priceSom: 38000,
        image: "/menu/omelette.jpg",
        station: "kitchen",
        prep: 10,
        options: [
          {
            group: "Qo'shimcha",
            max: 2,
            options: [
              ["Bekon", 15000],
              ["Pomidor", 5000],
              ["Qo'shimcha pishloq", 8000],
            ],
          },
        ],
      },
      {
        name: "Syrniki",
        description: "Tvorogli quymoq, smetana va murabbo bilan",
        priceSom: 42000,
        image: "/menu/syrniki.jpg",
        station: "kitchen",
        prep: 12,
      },
      {
        name: "Kruassan",
        description: "Yangi pishirilgan, sariyog'li",
        priceSom: 22000,
        image: "/menu/croissant.jpg",
        station: "kitchen",
        prep: 3,
      },
      {
        name: "Avokado tost",
        description: "Tandir non, avokado, tuxum poach",
        priceSom: 48000,
        image: "/menu/toast.jpg",
        station: "kitchen",
        prep: 12,
      },
    ],
  },
  {
    slug: "asosiy",
    name: "Asosiy taomlar",
    description: "Tushlik va kechki ovqat uchun",
    products: [
      {
        name: "Sezar salat",
        description: "Tovuq, parmezan, kruton va sous",
        priceSom: 56000,
        image: "/menu/caesar.jpg",
        station: "kitchen",
        prep: 12,
      },
      {
        name: "Klub sendvich",
        description: "Tovuq, bekon, tuxum, pomidor",
        priceSom: 52000,
        image: "/menu/sandwich.jpg",
        station: "kitchen",
        prep: 12,
      },
      {
        name: "Lola burger",
        description: "Mol go'shti kotleti, chedar, tuzlangan bodring",
        priceSom: 68000,
        image: "/menu/burger.jpg",
        station: "kitchen",
        prep: 16,
        options: [
          {
            group: "Qo'shimcha",
            max: 2,
            options: [
              ["Chedar pishloq", 8000],
              ["Bekon", 12000],
              ["Halapenyo", 5000],
            ],
          },
          {
            group: "Garnir",
            required: true,
            options: [
              ["Fri kartoshka", 0, true],
              ["Salat", 2000],
            ],
          },
        ],
      },
      {
        name: "Alfredo pasta",
        description: "Qaymoqli sous, tovuq va parmezan",
        priceSom: 62000,
        image: "/menu/pasta.jpg",
        station: "kitchen",
        prep: 15,
      },
      {
        name: "Tovuq shashlik",
        description: "Ko'mirda pishirilgan, ko'kat va sous bilan",
        priceSom: 58000,
        image: "/menu/shashlik.jpg",
        station: "kitchen",
        prep: 18,
      },
    ],
  },
  {
    slug: "shirinliklar",
    name: "Shirinliklar",
    description: "Uyda tayyorlangan desertlar",
    products: [
      {
        name: "Tiramisu",
        description: "Mascarpone, espresso va kakao",
        priceSom: 38000,
        image: "/menu/tiramisu.jpg",
        station: "kitchen",
        prep: 3,
      },
      {
        name: "Chizkeyk",
        description: "New York uslubidagi, malinali sous",
        priceSom: 36000,
        image: "/menu/cheesecake.jpg",
        station: "kitchen",
        prep: 3,
      },
      {
        name: "Medovik",
        description: "Asalli ko'p qavatli tort",
        priceSom: 32000,
        image: "/menu/honeycake.jpg",
        station: "kitchen",
        prep: 3,
      },
      {
        name: "Brauni",
        description: "Issiq shokoladli brauni, muzqaymoq bilan",
        priceSom: 34000,
        image: "/menu/brownie.jpg",
        station: "kitchen",
        prep: 6,
      },
    ],
  },
];

export function seedDemoData(options: { force?: boolean } = {}): {
  categories: number;
  products: number;
  tables: number;
  users: number;
} {
  const db = getDb();
  const now = nowIso();

  const existingProducts = db.prepare("SELECT COUNT(*) AS count FROM products").get() as { count: number };
  if (existingProducts.count > 0 && !options.force) {
    return { categories: 0, products: 0, tables: 0, users: 0 };
  }

  return db.transaction(() => {
    if (options.force) {
      db.exec("DELETE FROM kitchen_tickets; DELETE FROM order_items; DELETE FROM orders;");
      db.exec("DELETE FROM product_options; DELETE FROM product_option_groups;");
      db.exec("DELETE FROM products; DELETE FROM menu_categories;");
    }

    let categoryCount = 0;
    let productCount = 0;
    CATEGORIES.forEach((category, categoryIndex) => {
      const categoryResult = db
        .prepare(
          `INSERT INTO menu_categories (slug, name_uz, description_uz, sort_order, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, 1, ?, ?)
           ON CONFLICT(slug) DO UPDATE SET name_uz = excluded.name_uz, updated_at = excluded.updated_at`,
        )
        .run(category.slug, category.name, category.description, categoryIndex, now, now);
      const categoryId =
        Number(categoryResult.lastInsertRowid) ||
        (db.prepare("SELECT id FROM menu_categories WHERE slug = ?").get(category.slug) as { id: number }).id;
      categoryCount += 1;

      category.products.forEach((product, productIndex) => {
        const productResult = db
          .prepare(
            `INSERT INTO products (category_id, name_uz, description_uz, price_tiyin, image_url, station,
                                   prep_minutes, is_active, is_available, sort_order, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?)`,
          )
          .run(
            categoryId,
            product.name,
            product.description,
            somToTiyin(product.priceSom),
            product.image ?? null,
            product.station,
            product.prep,
            productIndex,
            now,
            now,
          );
        const productId = Number(productResult.lastInsertRowid);
        productCount += 1;

        (product.options ?? []).forEach((group, groupIndex) => {
          const groupResult = db
            .prepare(
              `INSERT INTO product_option_groups (product_id, name_uz, required, max_select, sort_order)
               VALUES (?, ?, ?, ?, ?)`,
            )
            .run(productId, group.group, group.required ? 1 : 0, group.max ?? 1, groupIndex);
          const groupId = Number(groupResult.lastInsertRowid);
          group.options.forEach(([name, deltaSom, isDefault], optionIndex) => {
            db.prepare(
              `INSERT INTO product_options (group_id, name_uz, price_delta_tiyin, is_default, is_active, sort_order)
               VALUES (?, ?, ?, ?, 1, ?)`,
            ).run(groupId, name, somToTiyin(deltaSom), isDefault ? 1 : 0, optionIndex);
          });
        });
      });
    });

    const tableCount = db.prepare("SELECT COUNT(*) AS count FROM restaurant_tables").get() as { count: number };
    let tables = 0;
    if (tableCount.count === 0) {
      const insertTable = db.prepare(
        `INSERT INTO restaurant_tables (code, label, zone, seats, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?)`,
      );
      for (let index = 1; index <= 12; index += 1) {
        const zone = index <= 6 ? "Asosiy zal" : index <= 10 ? "Terrasa" : "VIP xona";
        const seats = index <= 8 ? 4 : index <= 10 ? 2 : 6;
        insertTable.run(
          `T${String(index).padStart(2, "0")}`,
          `${index}-stol`,
          zone,
          seats,
          now,
          now,
        );
        tables += 1;
      }
    }

    const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number };
    let users = 0;
    if (userCount.count === 0) {
      const insertUser = db.prepare(
        `INSERT INTO users (email, password_hash, full_name, role, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?)`,
      );
      insertUser.run("admin@lolacafe.uz", hashPassword(DEMO_PASSWORDS.admin), "Lola Administrator", "admin", now, now);
      insertUser.run("kassir@lolacafe.uz", hashPassword(DEMO_PASSWORDS.cashier), "Dilnoza Kassir", "cashier", now, now);
      insertUser.run("oshxona@lolacafe.uz", hashPassword(DEMO_PASSWORDS.kitchen), "Sardor Oshpaz", "kitchen", now, now);
      users = 3;
    }

    return { categories: categoryCount, products: productCount, tables, users };
  })();
}
