# LOLA CAFE — Joylashtirish (deployment)

## 1. Talablar

* Node.js **20+** (loyihada 22.22 da sinovdan o'tkazilgan)
* Yozish huquqi bo'lgan disk (SQLite fayli + WAL)
* Tashqi xizmat **shart emas** (baza, kesh, message broker — barchasi jarayon ichida)

## 2. Environment

`.env.example` dan nusxa oling va to'ldiring:

| O'zgaruvchi | Majburiy | Izoh |
| --- | --- | --- |
| `LOLA_DB_PATH` | ha | SQLite fayl yo'li, masalan `/var/lib/lola/lola.db`. Katalog avtomatik yaratiladi. |
| `LOLA_SECRET` | **production** | Kamida 16 belgi. `openssl rand -hex 32`. Ishlab chiqishda standart qiymat ishlatiladi, production'da **bo'lmasa ilova ishga tushmaydi**. |
| `NODE_ENV` | ha | `production` bo'lsa cookie'lar `Secure` bo'ladi. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | faqat `admin:create` uchun | Parol kamida 10 belgi; repoga yozilmaydi. |

> Eslatma: `.env.local` **commit qilinmaydi** (`.gitignore`), unda faqat lokal sir bor.

## 3. Birinchi marta

```bash
npm ci
npm run db:migrate                                     # sxema (demo ma'lumot YO'Q)
ADMIN_EMAIL=egasi@lolacafe.uz \
ADMIN_PASSWORD='juda-kuchli-parol' \
ADMIN_NAME='Restoran egasi' npm run admin:create       # birinchi administrator
npm run build
NODE_ENV=production npm start                          # http://0.0.0.0:3000
```

Kassir/osxona xodimlarini administrator panelidan (`/admin/staff`) qo'shing.
Demo hisoblar (`lola-admin-2026` va h.k.) **production'da ishlatilmasin** — ular faqat
`npm run db:setup` bilan yaratiladi.

## 4. HTTPS va reverse proxy

Ilova HTTP ustida ishlaydi; TLS ni proxy (nginx/Caddy) tugatadi. `X-Forwarded-For` login va
pairing rate-limit uchun o'qiladi.

```nginx
server {
  listen 443 ssl http2;
  server_name lola.example.uz;
  # ssl_certificate ... (certbot)

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # SSE uchun buferlashni o'chirish SHART
  location /api/events       { proxy_pass http://127.0.0.1:3000; proxy_buffering off; proxy_read_timeout 15m; }
  location /api/table/events { proxy_pass http://127.0.0.1:3000; proxy_buffering off; proxy_read_timeout 15m; }
}
```

`secure` cookie va HSTS uchun `NODE_ENV=production` qo'yilganini tekshiring.

## 5. Process menejeri (systemd)

```ini
[Unit]
Description=LOLA CAFE
After=network.target

[Service]
Type=simple
WorkingDirectory=/srv/lola
EnvironmentFile=/srv/lola/.env.production
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=3
User=lola

[Install]
WantedBy=multi-user.target
```

`User=lola` foydalanuvchisi `LOLA_DB_PATH` katalogiga yozish huquqiga ega bo'lishi kerak.

## 6. Zaxira nusxa (backup)

SQLite uchun onlayn zaxira:

```bash
sqlite3 /var/lib/lola/lola.db ".backup '/backup/lola-$(date +%F).db'"
```

Yoki WAL holatida faylni to'xtatib ko'chirish. Kunlik cron + 30 kunlik saqlash tavsiya etiladi.
`data/` papkasi git'ga **kirmaydi**.

## 7. Yangilash

```bash
git pull
npm ci
npm run db:migrate      # yangi migratsiyalar (idempotent)
npm run build
systemctl restart lola
```

Migratsiyalar orqaga qaytarilmaydi — yangilashdan oldin zaxira oling.

## 8. Ishga tushganini tekshirish

```bash
curl -s https://lola.example.uz/api/health    # {"status":"ok","database":"up"}
```

Keyin kassadan bitta test buyurtma yuborib, oshxona ekranida bilet paydo bo'lishini va to'lov
qayd etilishini tekshiring.

## 9. Ko'p instansiya (kelajak)

Hozirgi arxitektura **bitta Node jarayoni** uchun: in-memory rate limit, SQLite, jarayon ichidagi
SSE poll. Gorizontal masshtablash uchun: PostgreSQL + Redis (rate limit va pub/sub) + SSE o'rniga
Redis Stream yoki WebSocket gateway. Bu o'zgarishlar `src/server/db`, `src/server/realtime` va
`src/server/http/handler.ts` (rate limit) bilan chegaralangan.
