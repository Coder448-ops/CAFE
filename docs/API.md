# LOLA CAFE — HTTP API (qisqa ma'lumotnoma)

Barcha endpointlar JSON qaytaradi. Xato formati:
`{ "error": { "code": "FORBIDDEN", "message": "...", "details": null } }`.

## Autentifikatsiya

| Metod | Yo'l | Ruxsat | Izoh |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | ochiq (rate limit 10/5daq) | HttpOnly `lola_session` cookie |
| POST | `/api/auth/logout` | sessiya | sessiyani bekor qiladi |
| GET | `/api/auth/me` | ixtiyoriy | joriy xodim + sozlamalar |
| GET | `/api/health` | ochiq | `{status, database}` |

## Mijoz qurilmasi (cookie `lola_table`)

| Metod | Yo'l | Izoh |
| --- | --- | --- |
| POST | `/api/table/pair` | `{ code }` → qurilma cookie (bir martalik kod) |
| GET | `/api/table/menu` | kategoriyalar + mavjud mahsulotlar |
| GET | `/api/table/context` | joriy sessiya, buyurtmalar, jami/to'langan/qarz |
| POST | `/api/table/orders` | `{ items[], note?, clientRequestId }` |
| POST | `/api/table/bill-request` | kassaga "hisob so'raldi" signali |
| GET | `/api/table/events` | SSE, faqat shu stol scope'i |

## Kassir / administrator (`pos`)

`/api/staff/orders` (GET, filtrlar: `status`, `paymentStatus`, `tableId`, `date`, `q`, `limit`),
`/api/staff/orders/[id]` (GET), `/api/staff/orders/[id]/status` (POST),
`/api/staff/orders/[id]/payments` (POST to'lov, PATCH qaytarish),
`/api/staff/tables` (GET, POST), `/api/staff/tables/[id]` (PATCH),
`/api/staff/tables/[id]/session` (POST ochish, DELETE yopish),
`/api/staff/tables/[id]/pairing-code` (POST), `/api/staff/tables/[id]/devices` (GET),
`/api/staff/devices/[id]` (DELETE), `/api/staff/reports?from=&to=`, `/api/staff/dashboard`,
`/api/staff/payments?from=&to=`, `/api/staff/settings` (GET/PATCH).

## Oshxona

`/api/staff/kitchen/tickets?station=&history=1` (GET),
`/api/staff/kitchen/tickets/[id]` (GET, POST `{status}` — `preparing|ready`, kassir uchun
`served|cancelled`).

## Administrator

`/api/staff/menu` (GET), `/api/staff/menu/categories` (POST), `/api/staff/menu/categories/[id]`
(PATCH/DELETE), `/api/staff/menu/products` (POST), `/api/staff/menu/products/[id]` (PATCH/DELETE),
`/api/staff/menu/products/[id]/availability` (POST), `/api/staff/users` (GET/POST),
`/api/staff/users/[id]` (PATCH), `/api/staff/audit?limit=`, `/api/events` (SSE, rolga qarab scope).

## Misol

```bash
# kassir sessiyasi
curl -c jar -H 'Content-Type: application/json' \
     -d '{"email":"kassir@lolacafe.uz","password":"lola-cashier-2026"}' \
     http://localhost:3000/api/auth/login

# stol 5 uchun ulash kodi
curl -b jar -X POST http://localhost:3000/api/staff/tables/5/pairing-code

# to'lov
curl -b jar -H 'Content-Type: application/json' \
     -d '{"method":"cash","clientRequestId":"pay-001"}' \
     http://localhost:3000/api/staff/orders/1/payments
```
