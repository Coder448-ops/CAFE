# LOLA CAFE — Restoran boshqaruv tizimi

LOLA CAFE — mijoz stol ekrani, kassir terminali, oshxona ekrani va administrator panelini
**bitta server va bitta doimiy bazaga** bog'laydigan to'liq restoran buyurtma tizimi.

* Interfeys tili: **o'zbek (lotin)**, valyuta: **UZS**, vaqt zonasi: **Asia/Tashkent**.
* Pul birligi: **tiyin** (1 so'm = 100 tiyin), faqat butun sonlar — float yo'q.
* Realtime: **Server-Sent Events** + bazadagi event log orqali qayta ulanishda replay.

---

## 1. Tez boshlash (lokal)

```bash
npm install
cp .env.example .env.local     # LOLA_SECRET ni o'zgartiring
npm run db:setup               # migratsiya + demo ma'lumotlar
npm run demo:orders            # (ixtiyoriy) ekranlar bo'sh bo'lmasligi uchun namuna buyurtmalar
npm run dev                    # http://localhost:3000
```

Demo hisoblar (`db:setup` yaratadi, **faqat rivojlantirish uchun**):

| Rol | Email | Parol |
| --- | --- | --- |
| Administrator | `admin@lolacafe.uz` | `lola-admin-2026` |
| Kassir | `kassir@lolacafe.uz` | `lola-cashier-2026` |
| Oshxona | `oshxona@lolacafe.uz` | `lola-kitchen-2026` |

### To'liq oqimni sinab ko'rish

1. Kassir sifatida kiring → **Stollar** → birinchi stolda **Ulash kodi** (masalan `K7PM-92XQ`).
2. Boshqa brauzer oynasida `/pair` sahifasini oching va kodni kiriting.
3. Menyudan taom tanlab **Buyurtmani yuborish**.
4. **Oshxona** ekranida bilet paydo bo'ladi → *Boshlash* → *Tayyor*.
5. **Kassir** ekranida to'lovni qayd eting → chekni chop eting (`Chek`).
6. **Administrator** panelida hisobot, audit jurnali va menyu boshqaruvi.

Real HTTP oqimini avtomatik tekshirish (server ishlab turishi kerak):

```bash
npm run dev
npm run verify:live            # 25 ta tekshiruv (login, pairing, buyurtma, to'lov, rol izolyatsiyasi, SSE)
```

---

## 2. Buyruqlar

| Buyruq | Vazifasi |
| --- | --- |
| `npm run dev` | Dev server (port 3000) |
| `npm run build` / `npm start` | Production build / ishga tushirish |
| `npm run db:migrate` | Migratsiyalarni qo'llash |
| `npm run db:seed` | Demo ma'lumotlarni qo'shish (`-- --force` bilan buyurtmalarni tozalaydi) |
| `npm run db:setup` | Migratsiya + demo ma'lumotlar |
| `npm run demo:orders` | Ekranlarni to'ldirish uchun 3 ta namunaviy buyurtma (demo) |
| `npm run admin:create` | **Production** administratorini xavfsiz yaratish |
| `npm run typecheck` | TypeScript tekshiruvi |
| `npm run lint` | ESLint |
| `npm test` | Unit + integration testlar (Vitest) |
| `npm run verify` | typecheck + lint + test |
| `npm run verify:live` | Ishlab turgan serverga qarshi HTTP oqimi |

---

## 3. Rollar va sahifalar

| Rol | Yo'l | Imkoniyatlar |
| --- | --- | --- |
| Mijoz qurilmasi | `/pair`, `/order` | Menyu, savat, buyurtma, holatni kuzatish, hisob so'rash |
| Kassir | `/cashier`, `/cashier/tables`, `/cashier/orders/[id]/receipt` | Buyurtma holati, to'lov, qaytarish, chek, sessiya |
| Oshxona | `/kitchen`, `/kitchen/history` | Biletlar, tayyorlash holati, kutish vaqti |
| Administrator | `/admin`, `/admin/menu`, `/admin/tables`, `/admin/staff`, `/admin/reports`, `/admin/audit`, `/admin/settings` | To'liq boshqaruv |

Ruxsatlar **serverda** tekshiriladi (API handler + servis qatlami). Tugmani yashirish xavfsizlik
hisoblanmaydi: masalan oshxona xodimi `/api/staff/orders` ga murojaat qilsa `403` oladi.

---

## 4. Repository tuzilishi

```
src/
  app/                      Next.js App Router (sahifalar + API route handlerlari)
    (auth)/login, (auth)/pair
    order/                  mijoz buyurtma oynasi
    cashier/ kitchen/ admin/
    api/                    barcha HTTP endpointlar
  modules/                  UI + domen modullari (customer, cashier, kitchen, menu,
                            tables, payments, reporting, administration, authentication)
  server/                   faqat server: db, auth, services, realtime, http
  shared/                   brauzer+server: tiplar, validatsiya, money/datetime, UI
database/
  migrations/               SQL sxemalar
  seeds/                    demo ma'lumotlar
tests/                      unit + integration (Vitest)
scripts/                    migrate, seed, create-admin, verify-workflow
docs/                       ARXITEKTURA, BAZA, DEPLOYMENT, TESTING, REJA
```

Batafsil: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/DATABASE.md`](docs/DATABASE.md) ·
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) · [`docs/TESTING.md`](docs/TESTING.md) ·
[`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md)

---

## 5. Muhim cheklovlar (halol ro'yxat)

* **To'lov shlyuzi yo'q.** `card_manual` — kassir jismoniy terminalda tasdiqlagan to'lovni qo'lda
  kiritadi. Tizim hech qachon avtomatik karta to'lovini "amalga oshirmaydi".
* **Baza — SQLite** (better-sqlite3, WAL). Bitta server instansiyasi uchun mo'ljallangan. Ko'p
  instansiyali gorizontal masshtablash uchun PostgreSQL ga ko'chirish kerak (sxema SQL, ORM yo'q —
  ko'chirish uchun `src/server/db` va `services` qatlamini o'zgartirish kifoya).
* **Real-time** — SSE, 1.5 s polling bilan bazadagi `realtime_events` jadvalidan. Event payloadda
  pul ma'lumoti yo'q: har bir hodisadan keyin klient holatni API dan qayta oladi.
* **Rate limiting** jarayon ichida (in-memory). Bir nechta instansiya uchun Redis kerak.
* **Chek** — brauzer orqali chop etiladigan hisob-faktura; fiskal/soliq cheki emas.
