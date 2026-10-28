-- LOLA CAFE — initial schema
-- Money: all monetary columns are INTEGER amounts in TIYIN (1 UZS = 100 tiyin).
-- Never use REAL for money. All timestamps are ISO-8601 UTC strings ('YYYY-MM-DDTHH:MM:SS.sssZ').

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------- staff ----
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'cashier', 'kitchen')),
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  last_login_at TEXT
);
CREATE INDEX idx_users_role ON users(role);

CREATE TABLE user_sessions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  revoked_at   TEXT,
  user_agent   TEXT,
  ip           TEXT
);
CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

-- ---------------------------------------------------------------- tables ---
CREATE TABLE restaurant_tables (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  code       TEXT NOT NULL UNIQUE,          -- short human code, e.g. "T05"
  label      TEXT NOT NULL,                 -- "5-stol"
  zone       TEXT NOT NULL DEFAULT 'Asosiy zal',
  seats      INTEGER NOT NULL DEFAULT 4 CHECK (seats > 0),
  is_active  INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- A customer device is paired with a table through an unguessable QR token.
CREATE TABLE table_devices (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id     INTEGER NOT NULL REFERENCES restaurant_tables(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,
  label        TEXT,
  created_at   TEXT NOT NULL,
  last_seen_at TEXT,
  expires_at   TEXT NOT NULL,
  revoked_at   TEXT
);
CREATE INDEX idx_table_devices_table ON table_devices(table_id);

-- Short-lived, single-use codes used to pair a physical device with a table.
CREATE TABLE table_pairing_codes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id    INTEGER NOT NULL REFERENCES restaurant_tables(id) ON DELETE CASCADE,
  code_hash   TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  used_at     TEXT,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_pairing_codes_table ON table_pairing_codes(table_id);

-- A dining session groups everything that happens while guests occupy a table.
CREATE TABLE table_sessions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id      INTEGER NOT NULL REFERENCES restaurant_tables(id) ON DELETE RESTRICT,
  status        TEXT NOT NULL CHECK (status IN ('open', 'closed')),
  guests        INTEGER CHECK (guests IS NULL OR guests > 0),
  opened_at     TEXT NOT NULL,
  closed_at     TEXT,
  opened_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  closed_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes         TEXT
);
-- At most one open session per table at any time.
CREATE UNIQUE INDEX ux_table_sessions_open ON table_sessions(table_id) WHERE status = 'open';

-- ------------------------------------------------------------------ menu ---
CREATE TABLE menu_categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT NOT NULL UNIQUE,
  name_uz    TEXT NOT NULL,
  description_uz TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE products (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id    INTEGER NOT NULL REFERENCES menu_categories(id) ON DELETE RESTRICT,
  name_uz        TEXT NOT NULL,
  description_uz TEXT,
  price_tiyin    INTEGER NOT NULL CHECK (price_tiyin >= 0),
  image_url      TEXT,
  station        TEXT NOT NULL DEFAULT 'kitchen' CHECK (station IN ('kitchen', 'bar', 'none')),
  prep_minutes   INTEGER NOT NULL DEFAULT 10 CHECK (prep_minutes >= 0),
  is_active      INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  is_available   INTEGER NOT NULL DEFAULT 1 CHECK (is_available IN (0, 1)),
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX idx_products_category ON products(category_id);

CREATE TABLE product_option_groups (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name_uz    TEXT NOT NULL,
  required   INTEGER NOT NULL DEFAULT 0 CHECK (required IN (0, 1)),
  max_select INTEGER NOT NULL DEFAULT 1 CHECK (max_select >= 1),
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_option_groups_product ON product_option_groups(product_id);

CREATE TABLE product_options (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id         INTEGER NOT NULL REFERENCES product_option_groups(id) ON DELETE CASCADE,
  name_uz          TEXT NOT NULL,
  price_delta_tiyin INTEGER NOT NULL DEFAULT 0 CHECK (price_delta_tiyin >= 0),
  is_default       INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  is_active        INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_options_group ON product_options(group_id);

-- ---------------------------------------------------------------- orders ---
CREATE TABLE orders (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number     INTEGER NOT NULL,
  business_date    TEXT NOT NULL,                 -- YYYY-MM-DD in Asia/Tashkent
  table_id         INTEGER NOT NULL REFERENCES restaurant_tables(id) ON DELETE RESTRICT,
  table_session_id INTEGER NOT NULL REFERENCES table_sessions(id) ON DELETE RESTRICT,
  customer_device_id INTEGER REFERENCES table_devices(id) ON DELETE SET NULL,
  status           TEXT NOT NULL DEFAULT 'new'
                     CHECK (status IN ('new','accepted','preparing','ready','served','completed','cancelled')),
  payment_status   TEXT NOT NULL DEFAULT 'unpaid'
                     CHECK (payment_status IN ('unpaid','partial','paid','refunded')),
  subtotal_tiyin   INTEGER NOT NULL CHECK (subtotal_tiyin >= 0),
  service_charge_tiyin INTEGER NOT NULL DEFAULT 0 CHECK (service_charge_tiyin >= 0),
  total_tiyin      INTEGER NOT NULL CHECK (total_tiyin >= 0),
  paid_tiyin       INTEGER NOT NULL DEFAULT 0 CHECK (paid_tiyin >= 0),
  note             TEXT,
  client_request_id TEXT,                         -- idempotency key from the submitting device
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  accepted_at      TEXT,
  ready_at         TEXT,
  served_at        TEXT,
  completed_at     TEXT,
  cancelled_at     TEXT,
  cancel_reason    TEXT,
  UNIQUE (business_date, order_number)
);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_table_session ON orders(table_session_id);
CREATE INDEX idx_orders_business_date ON orders(business_date);
CREATE UNIQUE INDEX ux_orders_client_request
  ON orders(table_session_id, client_request_id) WHERE client_request_id IS NOT NULL;

-- Product name and unit price are snapshotted: later menu edits never rewrite history.
CREATE TABLE order_items (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id             INTEGER NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  product_id           INTEGER REFERENCES products(id) ON DELETE RESTRICT,
  product_name_snapshot TEXT NOT NULL,
  unit_price_tiyin     INTEGER NOT NULL CHECK (unit_price_tiyin >= 0),
  quantity             INTEGER NOT NULL CHECK (quantity > 0),
  line_total_tiyin     INTEGER NOT NULL CHECK (line_total_tiyin >= 0),
  station              TEXT NOT NULL CHECK (station IN ('kitchen','bar','none')),
  note                 TEXT,
  status               TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','preparing','ready','served','cancelled'))
);
CREATE INDEX idx_order_items_order ON order_items(order_id);

CREATE TABLE order_item_options (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  order_item_id      INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  option_id          INTEGER REFERENCES product_options(id) ON DELETE SET NULL,
  group_name_snapshot TEXT NOT NULL,
  option_name_snapshot TEXT NOT NULL,
  price_delta_tiyin  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_order_item_options_item ON order_item_options(order_item_id);

-- --------------------------------------------------------------- kitchen ---
CREATE TABLE kitchen_tickets (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  order_number INTEGER NOT NULL,
  table_id     INTEGER NOT NULL REFERENCES restaurant_tables(id) ON DELETE RESTRICT,
  station      TEXT NOT NULL CHECK (station IN ('kitchen','bar')),
  status       TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','preparing','ready','served','cancelled')),
  created_at   TEXT NOT NULL,
  started_at   TEXT,
  ready_at     TEXT,
  served_at    TEXT,
  updated_at   TEXT NOT NULL
);
CREATE INDEX idx_tickets_station_status ON kitchen_tickets(station, status);
CREATE INDEX idx_tickets_order ON kitchen_tickets(order_id);

CREATE TABLE kitchen_ticket_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id     INTEGER NOT NULL REFERENCES kitchen_tickets(id) ON DELETE CASCADE,
  order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  UNIQUE (ticket_id, order_item_id)
);

-- -------------------------------------------------------------- payments ---
-- Payments are append-only financial records. They are never deleted.
CREATE TABLE payments (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id          INTEGER NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  method            TEXT NOT NULL CHECK (method IN ('cash','card_manual','other')),
  amount_tiyin      INTEGER NOT NULL CHECK (amount_tiyin > 0),
  note              TEXT,
  client_request_id TEXT,
  created_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at        TEXT NOT NULL,
  business_date     TEXT NOT NULL
);
CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_business_date ON payments(business_date);
CREATE UNIQUE INDEX ux_payments_client_request ON payments(client_request_id) WHERE client_request_id IS NOT NULL;

CREATE TABLE refunds (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id   INTEGER NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  amount_tiyin INTEGER NOT NULL CHECK (amount_tiyin > 0),
  reason       TEXT NOT NULL,
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL,
  business_date TEXT NOT NULL
);
CREATE INDEX idx_refunds_payment ON refunds(payment_id);

-- ---------------------------------------------------- settings / ops ------
CREATE TABLE app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE audit_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_label   TEXT NOT NULL,
  actor_role    TEXT NOT NULL,
  action        TEXT NOT NULL,
  entity_type   TEXT NOT NULL,
  entity_id     TEXT,
  details       TEXT,
  ip            TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX idx_audit_created ON audit_logs(created_at);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);

-- DB-backed event log: powers SSE realtime with replay after reconnect.
CREATE TABLE realtime_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  type       TEXT NOT NULL,
  scope      TEXT NOT NULL,     -- 'staff' | 'kitchen' | 'table:<tableId>'
  payload    TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_events_scope_id ON realtime_events(scope, id);
