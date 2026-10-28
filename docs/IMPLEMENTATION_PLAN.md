# LOLA CAFE — Amalga oshirish rejasi (holat bilan)

> Bu hujjat haqiqiy holatni aks ettiradi. Har bir band: **bajarildi / qisman / rejalashtirilgan**.

## 0. Repository tahlili (boshlang'ich holat)

* Repository bo'sh edi: faqat `README.md` (`# CAFE`) va bitta commit. Framework, baza, auth, testlar
  yo'q edi.
* Sandbox imkoniyatlari tekshirildi: Node 22.22.3, npm 10.9.8, `better-sqlite3` native build
  ishlaydi, tashqi DB/managed servis yo'q, tashqi tarmoq faqat npm/github uchun.
* **Xulosa:** greenfield qurilish; SQLite + Next.js eng kam murakkablik bilan talablarni qoplaydi
  (bitta server, haqiqiy doimiy saqlash, migratsiyalar).

## 1. Preserve / o'zgartirish qarorlari

| Element | Qaror |
| --- | --- |
| Mavjud kod | Saqlanadigan kod yo'q edi (faqat README sarlavhasi). |
| Stack | Next.js App Router + TypeScript + Tailwind + SQLite (better-sqlite3) + Zod + Vitest. |
| Backend | Alohida `server/` ilovasi emas — Next route handlerlari + `src/server/services` domen qatlami. |

## 2. Fazalar

### Faza 1 — Asos ✅
* [x] `package.json`, `tsconfig`, Tailwind, ESLint (flat config), `.env.example`, `.gitignore`
* [x] Dizayn tizimi (ranglar, tipografiya, `surface`, `input-base`, animatsiyalar)
* [x] `docs/ARCHITECTURE.md`, `docs/DATABASE.md`

### Faza 2 — Baza va xavfsizlik ✅
* [x] `database/migrations/001_init.sql` — 18 jadval, FK, CHECK, indekslar
* [x] Migratsiya runner (`schema_migrations`, idempotent)
* [x] scrypt parol hash, sessiya tokenlari (hash + TTL + revoke), HttpOnly cookie
* [x] Rol guardlari (`ADMIN_ROLES`, `POS_ROLES`, `KITCHEN_ROLES`), `route()` xato o'rami
* [x] Rate limiting (login, pairing, buyurtma), audit log
* [x] `npm run admin:create` — production administratorini xavfsiz yaratish

### Faza 3 — Mijoz oqimi ✅
* [x] Bir martalik pairing kodi → 30 kunlik qurilma tokeni (faqat hash bazada)
* [x] Menyu (kategoriyalar, mahsulotlar, qo'shimchalar), savat (pure logic + testlar)
* [x] Buyurtma yuborish: serverda narxlash, mavjudlik tekshiruvi, idempotentlik
* [x] Buyurtma holatini kuzatish, hisob so'rash, reconnect'da holatni qayta olish

### Faza 4 — Kassir ✅
* [x] Real-time buyurtma ro'yxati, qidiruv, filtrlar, tafsilotlar
* [x] Status boshqaruvi, bekor qilish (sabab bilan), qismiy to'lov, qaytarish
* [x] Stollar ekrani: sessiya ochish/yopish, qurilma ulash kodi, qarzlar
* [x] Chek sahifasi (brauzer orqali chop etish)
* [x] "Hisob so'rash" signali kassaga real vaqtda keladi

### Faza 5 — Oshxona ✅
* [x] Stansiya bo'yicha doimiy biletlar (oshxona/bar), taom izohlari, kutish vaqti
* [x] `queued → preparing → ready`, buyurtma holati bilan sinxronizatsiya
* [x] Reconnect'da faol biletlarni tiklash, tarix sahifasi, 15 daqiqadan keyin vizual ogohlantirish
* [x] Oshxona DTO'sida narx/to'lov ma'lumoti **yo'q**

### Faza 6 — Administrator ✅
* [x] Boshqaruv paneli (bugungi ko'rsatkichlar, so'nggi harakatlar)
* [x] Menyu boshqaruvi (kategoriya/mahsulot CRUD, narx, mavjudlik, arxivlash)
* [x] Stollar va qurilmalar (zona, o'rin, ulash kodi, qurilmani bekor qilish)
* [x] Xodimlar (rol, bloklash, parol), oxirgi administrator himoyasi
* [x] Hisobotlar (davr, to'lov usullari, kategoriya, taom, kunlik)
* [x] Audit jurnali, sozlamalar (nom, manzil, chek, xizmat haqi %)

### Faza 7 — Sifat ✅
* [x] 59 unit/integration test (8 fayl) — o'tadi
* [x] `tsc --noEmit` — xatosiz
* [x] ESLint — xatosiz
* [x] `next build` — muvaffaqiyatli
* [x] `scripts/verify-workflow.ts` — real HTTP bo'yicha 25 tekshiruv
* [x] `docs/DEPLOYMENT.md`, `docs/TESTING.md`, README

## 3. Rejalashtirilgan (keyingi bosqich)

| Band | Holat | Izoh |
| --- | --- | --- |
| Onlayn to'lov (Payme/Click/Uzum) | rejalashtirilgan | merchant hisobi yo'q; webhook + `payments.method` kengaytirish kerak |
| Brauzer E2E (Playwright) | rejalashtirilgan | sandbox'da brauzer binari yuklanmaydi |
| PostgreSQL | rejalashtirilgan | ko'p instansiya uchun; SQL allaqachon servis qatlamida izolyatsiyalangan |
| Mahsulot rasm yuklash (fayl) | qisman | hozir URL kiritiladi, `public/menu` da statik rasmlar |
| Inventar/ombor hisobi | rejalashtirilgan | talab qilinmagan |
| Fiskal chek (soliq moduli) | rejalashtirilgan | hozirgi chek — ichki hisob-faktura |
| Stol qurilmasi uchun avtomatik QR chop etish | rejalashtirilgan | kod ekranda ko'rsatiladi, QR generatsiyasi qo'shilishi mumkin |
| SSE o'rniga WebSocket/Redis | rejalashtirilgan | 20–30 qurilma uchun SSE yetarli |

## 4. Risklar

1. **SQLite + bitta jarayon** — bir vaqtda yozuvlar seriyali; kichik kafe uchun yetarli, katta
   filiallar uchun PostgreSQL kerak.
2. **SSE polling yuklamasi** — har bir ulangan qurilma uchun 1.5 s da SELECT; 50+ qurilmada
   optimallashtirish talab qilinadi.
3. **Brauzer chop etish** — printer sozlamalari qurilmaga bog'liq; ESC/POS termal printer
   integratsiyasi yo'q.
4. **Demo parollar** — `db:setup` faqat lokal; production uchun `admin:create` qat'iy tavsiya etiladi.
