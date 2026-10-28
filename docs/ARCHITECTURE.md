# LOLA CAFE — Arxitektura

## 1. Tanlangan stack va sabab

| Qatlam | Tanlov | Sabab |
| --- | --- | --- |
| Framework | **Next.js 15 (App Router) + React 19 + TypeScript** | Bitta kod bazasida UI va server API; route handlerlar serverda ishlaydi, native Node modullari (`better-sqlite3`) uchun `serverExternalPackages` ishlatilgan. |
| Baza | **SQLite (better-sqlite3, WAL)** | Repository'da baza mavjud emas edi va sandbox'da tashqi DB xizmati yo'q. SQLite transaksiyaga to'liq ega, faylga doimiy yozadi, migratsiyalar sof SQL. Bitta kafe (bitta server) uchun yetarli. |
| Validatsiya | **Zod** | Bir xil sxema brauzer formasi va server handlerida ishlatiladi. |
| Stil | **Tailwind CSS 3.4** + CSS o'zgaruvchilar | Tez, izchil dizayn tizimi; alohida UI kutubxonasi keraksiz. |
| Testlar | **Vitest** | Node muhitida servis qatlamini to'g'ridan-to'g'ri sinaydi (happy-dom/DOM shart emas). |
| Realtime | **SSE + DB event log** | Socket.IO kabi qo'shimcha server/process kerak emas; reconnect'da `Last-Event-ID` bilan replay. |

**Modulli monolit.** Mikroservislar bu hajmdagi tizim uchun ortiqcha murakkablik: buyurtma, to'lov va
oshxona biletlari bitta tranzaksiyada yozilishi kerak.

## 2. Qatlamlar va bog'liqliklar

```
        ┌──────────────────────────── brauzer ────────────────────────────┐
        │  modules/*/components (React)   shared/components/ui (dizayn)   │
        │  shared/hooks (useApi, useRealtime)   modules/shared/api (fetch) │
        └───────────────────────────────┬─────────────────────────────────┘
                                        │ HTTP JSON + cookies, SSE
        ┌───────────────────────────────▼─────────────────────────────────┐
        │  src/app/api/**  (route handlerlar)                             │
        │   • requireStaff / requireTableDevice  (authn)                   │
        │   • role guardlar: ADMIN_ROLES | POS_ROLES | KITCHEN_ROLES       │
        │   • Zod parseBody, rate limiting, structured xatolar              │
        └───────────────────────────────┬─────────────────────────────────┘
        ┌───────────────────────────────▼─────────────────────────────────┐
        │  src/server/services/**  (domen qatlami, biznes qoidalari)       │
        │  orders · payments · kitchen · tables · menu · reports · staff   │
        │  settings · realtime/bus · audit                                 │
        └───────────────────────────────┬─────────────────────────────────┘
        ┌───────────────────────────────▼─────────────────────────────────┐
        │  src/server/db (better-sqlite3 + migratsiya runner)             │
        │  database/migrations/*.sql                                      │
        └─────────────────────────────────────────────────────────────────┘
```

Qoidalar:

* `src/server/**` faqat serverda ishlaydi; brauzer kodi bu yerdan import qilmaydi.
  (Istisno yo'q — `shared/` ichida `node:crypto`, `fs`, `better-sqlite3` ishlatilmaydi.)
* Biznes qoidalari faqat servislarda. UI hech qachon narx, status yoki to'lovni "o'zi" hisoblamaydi.
* Har bir HTTP endpoint o'z validatsiyasini va ruxsatini o'zi tekshiradi (handler darajasida),
  servis esa qoidani qayta tekshiradi (masalan biletni faqat kassir "served" qiladi).

## 3. Asosiy dizayn qarorlari

### 3.1 Pul: tiyin (integer)
Barcha summalar `INTEGER` tiyin. `shared/lib/money.ts` — yagona konvertatsiya/formatsiya nuqtasi.
`parseSomInput()` admin kiritgan "32 000" ni tiyin qiladi, `formatUzs()` ko'rsatadi. Foizli xizmat
haqi `Math.round(subtotal * percent / 100)` bilan bir marta, buyurtma yaratilganda hisoblanadi va
`orders.service_charge_tiyin` ga yoziladi (keyingi sozlama o'zgarishi tarixni buzmaydi).

### 3.2 Narx snapshot
`order_items` da `product_name_snapshot`, `unit_price_tiyin`, `line_total_tiyin` saqlanadi;
`order_item_options` da qo'shimcha nomi va narx deltasi. Menyudagi narx o'zgarsa, eski buyurtmalar
o'zgarmaydi (test bilan tasdiqlangan).

### 3.3 Serverda narxlash
`createOrder` faqat `productId`, `quantity`, `optionIds`, `note` qabul qiladi. Narx, mavjudlik va
qo'shimcha to'lovlar bazadan o'qiladi. Klient yuborgan `priceTiyin` e'tiborga olinmaydi.

### 3.4 Idempotentlik
* Buyurtma: `UNIQUE (table_session_id, client_request_id)`. Takroriy so'rov yangi buyurtma
  yaratmaydi, mavjudini qaytaradi (`duplicate: true`).
* To'lov: `UNIQUE (client_request_id)`. Takroriy so'rov **to'lov tekshiruvidan oldin** tekshiriladi,
  shuning uchun allaqachon to'langan buyurtma uchun ham `duplicate: true` qaytadi (xato emas).

### 3.5 Holat mashinasi
`shared/constants/orders.ts` dagi `ORDER_TRANSITIONS` — yagona haqiqat manbai:
`new → accepted → preparing → ready → served → completed`, har qadamda `cancelled` (to'lanmagan
bo'lsa). Servis ruxsat etilmagan o'tishda `409` qaytaradi. Oshxona biletlari o'z mashinasiga ega
(`queued → preparing → ready → served`), va bilet holatlari buyurtma holatini avtomatik sinxronlaydi
(barcha biletlar `ready` bo'lsa → buyurtma `ready`).

### 3.6 To'lovlar = append-only ledjer
`payments` hech qachon o'chirilmaydi yoki tahrirlanmaydi. Qaytarish `refunds` jadvaliga alohida
yozuv. `orders.paid_tiyin` / `payment_status` har safar `SUM(payments) - SUM(refunds)` dan qayta
hisoblanadi (`recomputePaymentState`).

### 3.7 Stol qurilmasi identifikatsiyasi
Mijoz sahifasida stol raqami URL'da emas. Ofitsiant 10 daqiqalik **bir martalik kod** yaratadi
(faqat SHA-256 hash bazada). Kod almashtirilganda qurilma 30 kunlik token oladi — token ham faqat
hash sifatida saqlanadi va **HttpOnly cookie** da yuboriladi (JS ko'rmaydi). Har so'rovda token
hash'i orqali stol aniqlanadi; boshqa stol ma'lumotiga kirish imkoni yo'q.

### 3.8 Authn / authz
* Parol: `scrypt` (N=16384) + tasodifiy salt, `timingSafeEqual`.
* Sessiya: tasodifiy 32 baytli token, bazada SHA-256 hash, 7 kun TTL, bekor qilinadigan
  (`revoked_at`). Parol o'zgarsa yoki xodim bloklansa — barcha sessiyalar bekor qilinadi.
* Rol tekshiruvi har endpointda. Mijoz tokeni va xodim sessiyasi butunlay alohida cookie.

### 3.9 Real-time
Har bir domen o'zgarishi `realtime_events(type, scope, payload)` ga yoziladi (yozuv bilan **bir
tranzaksiyada**). Scope'lar: `pos`, `kitchen`, `admin`, `table:<id>`.
`GET /api/events` (xodim) va `GET /api/table/events` (qurilma) SSE oqimi beradi:

* scope'lar rolga qarab tanlanadi — oshxona `pos` eventlarini **olmaydi** (to'lov ma'lumoti).
* `id:` maydoni `Last-Event-ID` bilan qayta ulanishda yetishmagan eventlarni yuboradi.
* payload faqat identifikator va status; summalar va shaxsiy ma'lumot yo'q — klient API dan
  haqiqiy holatni qayta o'qiydi.
* SSE ustidan qo'shimcha xavfsizlik to'ri: klientlarda 30–60 s polling va `focus` da yangilash.

### 3.10 Hisobotlar
`orders.business_date` — Asia/Tashkent bo'yicha kun. Hisobotda:
* **paymentsRecordedTiyin** — kassir tasdiqlagan pul (tushum),
* **netSalesTiyin** — buyurtmalar summasi (bekor qilinganlarsiz),
* **outstandingTiyin** — `total - paid`,
* **refundsTiyin** — qaytarishlar.
Ular hech qachon bitta "savdo" raqamiga aralashtirilmaydi.

## 4. Xatolar va kuzatuv

* `ApiError(status, code, message_uz)` — barcha handlerlar `route()` bilan o'ralgan, xatolar bir xil
  JSON shaklga aylanadi: `{ error: { code, message, details } }`.
* `audit_logs` — muhim harakatlar (login, buyurtma, status, to'lov, menyu, xodim, sozlama).
  Yozuvlar o'chirilmaydi va administrator panelida ko'rinadi.
* Server log: `console.error` faqat kutilmagan xatolar uchun (handler ichida).

## 5. Ma'lum cheklovlar / keyingi qadamlar

1. **SQLite → PostgreSQL**: `src/server/db/client.ts` + `services/*` dagi SQL bir necha joyda
   SQLite sintaksisi (`COALESCE`, `GROUP_CONCAT`) ishlatadi. Ko'chirish rejalashtirilgan, hozircha
   bitta instansiya uchun optimallashtirilgan.
2. **Rate limiting** in-memory (bir instansiya uchun to'g'ri).
3. **SSE** har klient uchun 1.5 s da bir SELECT qiladi — 20–30 qurilma uchun qabul qilinadi,
   kattaroq yuklamada LISTEN/NOTIFY yoki Redis pub/sub kerak.
4. **To'lov integratsiyasi yo'q** (Payme/Click/Uzum) — ataylab, chunki haqiqiy merchant hisobi
   sozlanmagan. `payments.method` ga yangi qiymat qo'shish va webhook endpoint qo'shish yetarli.
5. **Rasm fayllari** `public/menu` da statik; admin panelda URL kiritiladi (fayl yuklash oqimi yo'q).
