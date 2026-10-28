# LOLA CAFE — Testlar va sifat nazorati

## Buyruqlar

```bash
npm run typecheck      # tsc --noEmit
npm run lint           # eslint (next/core-web-vitals + next/typescript)
npm test               # vitest run (unit + integration)
npm run verify         # typecheck + lint + test
npm run verify:live    # ishlab turgan serverga qarshi real HTTP oqimi
```

## Test izolyatsiyasi

`tests/setup/db.ts` har bir test fayli uchun vaqtinchalik katalogda alohida SQLite bazasini yaratadi
(`LOLA_DB_PATH`), migratsiyalarni qo'llaydi va demo ma'lumotlarni seed qiladi. Shuning uchun testlar
lokal `data/lola.db` ga tegmaydi va bir-biridan mustaqil.

## Unit testlar (`tests/unit`)

| Fayl | Nima tekshiriladi |
| --- | --- |
| `money.test.ts` | so'm ↔ tiyin konvertatsiyasi (float drift yo'q), `formatUzs`, `parseSomInput` (noto'g'ri kiritishni rad etish), manfiy qiymatlar |
| `cart.test.ts` | savat: qo'shish/birlashtirish, kamaytirish, **manfiy miqdor bo'lmasligi**, maksimal miqdor, bo'sh savat |
| `datetime.test.ts` | Asia/Tashkent biznes kuni chegarasi (UTC+5), sana oynasi, davomiylik formati |
| `order-rules.test.ts` | status mashinasi, bo'sh savat / noto'g'ri miqdor / idempotency kaliti validatsiyasi |

## Integration testlar (`tests/integration`)

| Fayl | Ssenariylar |
| --- | --- |
| `orders.test.ts` | buyurtma saqlanishi, **server narxi klient narxini yengishi**, noma'lum/mavjud bo'lmagan mahsulot, **takroriy yuborishda dublikat yo'qligi**, narx snapshoti menyu o'zgargandan keyin ham saqlanishi, kunlik tartib raqami, sessiya qayta ishlatilishi, qo'shimcha narx deltalari va boshqa mahsulot qo'shimchasini rad etish, status o'tishlari, bekor qilish sababi |
| `payments.test.ts` | buyurtma o'z-o'zidan to'langan bo'lmasligi, naqd to'lov, bo'lib to'lash, **takroriy to'lov dublikat yaratmasligi**, ortiqcha to'lovni rad etish, bekor qilingan buyurtmaga to'lov yo'qligi, qaytarish (payment o'chmaydi), qaytarish limiti, **hisobot to'lov va buyurtma summalarini ajratishi** |
| `kitchen.test.ts` | stansiya bo'yicha biletlar, `queued → preparing → ready` sinxronizatsiyasi, **kassaga tegishli bo'lmagan ma'lumot (narx/to'lov) biletda yo'qligi**, taqiqlangan o'tishlar, "faqat kassir" qoidalari, tarix |
| `access-control.test.ts` | bir martalik pairing kodi, qurilma tokeni, **stollar izolyatsiyasi**, scrypt hash, sessiya yaratish/bekor qilish, bloklangan xodim, oxirgi administratorni himoya, **to'lanmagan sessiyani yopolmaslik**, realtime scope izolyatsiyasi |

Joriy natija: **8 test fayli / 59 test — barchasi o'tadi.**

## Live HTTP tekshiruvi (`scripts/verify-workflow.ts`)

Real serverga qarshi ishlaydi (cookie'lar, HTTP statuslar, SSE):

```bash
npm run dev
npm run verify:live       # 25 tekshiruv
```

Qamrov: health, login (to'g'ri/noto'g'ri parol 401), pairing kodi va bir martalik ishlatilishi,
qurilmasiz menyu 401, buyurtma yaratish, **narx manipulyatsiyasi**, dublikat yuborish, bo'sh savat
400, kassir ko'rinishi, oshxona bileti va statuslari, mijoz holati, **rol izolyatsiyasi (403/401)**,
to'lov, **to'lov replay**, allaqachon to'langan (409), hisobot, SSE oqimi.

## Qo'lda tekshirish ro'yxati (UI)

1. `/` → rol kartalari, `/login` → xodim kirishi.
2. `/pair` bilan qurilma ulash, `/order` da savat va buyurtma.
3. Sahifani yangilash → savat (sessionStorage) va faol buyurtmalar tiklanadi.
4. `/kitchen` da bilet, statuslar; tarmoq uzilsa "Qayta ulanmoqda…" indikatori va avtomatik tiklanish.
5. `/cashier` da to'lov, qismiy to'lov, chek chop etish (`window.print`, `no-print` elementlar yashirin).
6. `/admin` da menyu narxini o'zgartirish → eski buyurtma summasi o'zgarmaydi.
7. Planshet/telefon o'lchamida (1280/1024/768) asosiy oqimlar ishlashi.

## Halol cheklovlar

* **Brauzer E2E (Playwright/Cypress) o'rnatilmagan**: sandbox'da brauzer binarlarini yuklab bo'lmaydi.
  Shuning uchun UI oqimi HTTP darajasida (`verify:live`) va qo'lda tekshiriladi. Playwright qo'shish
  uchun `npm i -D @playwright/test` va oqim skriptlarini yozish kifoya — API barqaror.
* Lighthouse/axe avtomatik auditi ishlatilmagan; semantik HTML, `aria-*`, fokus holatlari qo'lda
  qo'llangan.
