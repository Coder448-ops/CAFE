# LOLA CAFE — Ma'lumotlar bazasi

Manba: `database/migrations/001_init.sql` (SQLite, WAL). Migratsiyalar `schema_migrations` jadvalida
kuzatiladi va `npm run db:migrate` bilan idempotent qo'llanadi.

## Konvensiyalar

| Mavzu | Qoida |
| --- | --- |
| Pul | `*_tiyin INTEGER` (1 so'm = 100 tiyin). `REAL` hech qachon ishlatilmaydi. |
| Vaqt | ISO-8601 UTC matn (`2026-10-28T16:04:16.273Z`). `business_date` — `YYYY-MM-DD` (Asia/Tashkent). |
| FK | `PRAGMA foreign_keys = ON`; o'chirishga `RESTRICT` (tarixiy yozuvlar himoyalangan). |
| O'chirish | Mahsulot/kategoriya "arxivlanadi" (`is_active = 0`), jismonan o'chirilmaydi. |
| Status | `CHECK` cheklovlari bilan sanab o'tilgan qiymatlar. |

## Jadval xaritasi

```
users ─┬─ user_sessions
       ├─ audit_logs
       └─ table_sessions(opened_by/closed_by) · payments(created_by) · refunds(created_by)

restaurant_tables ─┬─ table_devices
                   ├─ table_pairing_codes
                   ├─ table_sessions ─── orders ─┬─ order_items ─┬─ order_item_options
                   │                             │               └─ kitchen_ticket_items
                   │                             ├─ payments ─── refunds
                   │                             └─ kitchen_tickets
                   └───────────────────────────────┘

menu_categories ── products ── product_option_groups ── product_options
app_settings (key/value)      realtime_events (id, type, scope, payload)
```

## Asosiy jadvallar va cheklovlar

* **orders** — `UNIQUE (business_date, order_number)` (kunlik tartib raqami),
  `UNIQUE (table_session_id, client_request_id) WHERE client_request_id IS NOT NULL` (idempotentlik),
  `total_tiyin = subtotal + service_charge` (servis qatlamida), `CHECK (subtotal_tiyin >= 0)`.
* **order_items** — `CHECK (quantity > 0)`; mahsulot nomi va narxi snapshot sifatida.
  `product_id` `ON DELETE RESTRICT` — mahsulot o'chirilsa ham tarix qoladi.
* **table_sessions** — `UNIQUE INDEX ... WHERE status = 'open'`: bir stolda bir vaqtda faqat bitta
  ochiq sessiya.
* **payments** — `CHECK (amount_tiyin > 0)`, `UNIQUE (client_request_id) WHERE NOT NULL`.
  Append-only: kodda `UPDATE/DELETE` yo'q.
* **refunds** — har doim `payment_id` ga bog'langan; qaytarish yig'indisi to'lovdan oshmasligi
  servisda tekshiriladi.
* **kitchen_tickets** — `(order_id, station)` bo'yicha amalda bitta faol bilet; itemlar
  `kitchen_ticket_items` orqali bog'lanadi (`UNIQUE(ticket_id, order_item_id)`).
* **table_devices / table_pairing_codes** — faqat token/kod **hash**i saqlanadi.
* **realtime_events** — `id` monoton o'sadi (SSE kursori); 5000 tadan ortiq eski yozuv vaqti-vaqti
  bilan o'chiriladi.

## Indekslar

`orders(status)`, `orders(business_date)`, `orders(table_session_id)`, `order_items(order_id)`,
`kitchen_tickets(station, status)`, `payments(business_date)`, `audit_logs(created_at)`,
`realtime_events(scope, id)`, `users(role)`, `table_devices(table_id)`.

## Demo ma'lumotlar

`database/seeds/demo.ts`:
* 5 kategoriya, 25 mahsulot (qo'shimchalar bilan: sut turi, hajm, garnir),
* 12 stol: `Asosiy zal` (1–6), `Terrasa` (7–10), `VIP xona` (11–12),
* 3 demo xodim.

Seed **faqat** bo'sh bazada ishlaydi; `--force` faqat buyurtma/menyu jadvallarini tozalaydi.
Production'da demo xodimlarni yaratmaslik uchun `npm run db:migrate` + `npm run admin:create`
ishlatiladi.

## Transaction chegaralari

Bitta tranzaksiyada bajariladi:
1. buyurtma yaratish (sessiya, narxlash, order + items + options, biletlar, eventlar, audit),
2. status o'zgarishi (order, items, tickets, eventlar, audit),
3. to'lov (payment, qayta hisoblash, eventlar, audit),
4. qurilma ulash (kod ishlatilishi + qurilma yaratish),
5. sessiya yopish (tekshiruv + orderlarni yakunlash).

Xato bo'lsa hammasi rollback bo'ladi — yarim yozilgan buyurtma yoki to'lov qolmaydi.
