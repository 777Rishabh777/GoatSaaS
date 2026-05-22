-- ============================================================
-- GOATSaaS — Neon PostgreSQL Schema
-- Run this in your Neon SQL Editor (console.neon.tech)
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Organizations ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id          TEXT PRIMARY KEY,                  -- e.g. "org_goatsaas"
  name        TEXT NOT NULL,
  plan        TEXT NOT NULL DEFAULT 'free'       CHECK (plan IN ('free', 'pro', 'enterprise')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Users ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,              -- e.g. "usr_001"
  email           TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'user'  CHECK (role IN ('user', 'admin')),
  plan            TEXT NOT NULL DEFAULT 'free'  CHECK (plan IN ('free', 'pro', 'enterprise')),
  password_hash   TEXT NOT NULL,
  avatar          TEXT,                          -- initials like "RD"
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
  org_id          TEXT REFERENCES organizations(id),
  org_name        TEXT,
  org_role        TEXT DEFAULT 'member'         CHECK (org_role IN ('owner', 'admin', 'member')),
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── API Keys ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organizations(id),
  user_id       TEXT NOT NULL REFERENCES users(id),
  name          TEXT NOT NULL,
  key_hash      TEXT NOT NULL UNIQUE,            -- SHA-256 of raw key — never store raw
  key_prefix    TEXT NOT NULL,                   -- "gsk_live_xxxx" — shown in UI
  key_suffix    TEXT NOT NULL,                   -- last 4 chars
  plan          TEXT NOT NULL DEFAULT 'free'    CHECK (plan IN ('free', 'pro', 'enterprise')),
  calls_today   INTEGER NOT NULL DEFAULT 0,
  total_calls   BIGINT NOT NULL DEFAULT 0,
  last_used_at  TIMESTAMPTZ,
  last_used_ip  TEXT,
  revoked_at    TIMESTAMPTZ,                     -- NULL = active
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Audit Logs ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id     TEXT NOT NULL,
  user_email  TEXT NOT NULL,
  action      TEXT NOT NULL,                    -- e.g. "auth:login", "admin:flag_toggle"
  target      TEXT,                             -- what was acted on
  ip          TEXT,
  metadata    JSONB                             -- extra structured data
);

-- Index for fast filtering by user, action, and date
CREATE INDEX IF NOT EXISTS idx_audit_user_id   ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action     ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp  ON audit_logs(timestamp DESC);

-- ─── Feature Flags ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feature_flags (
  org_id      TEXT NOT NULL REFERENCES organizations(id),
  flag_name   TEXT NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, flag_name)
);

-- ─── Webhooks ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhooks (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id),
  url         TEXT NOT NULL,
  secret      TEXT NOT NULL,                    -- for HMAC verification
  events      TEXT[] NOT NULL,                  -- e.g. ['api.key_created', 'quota.exceeded']
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_fired_at TIMESTAMPTZ
);

-- ─── AI Quota Daily Counters ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quota_daily (
  org_id      TEXT NOT NULL REFERENCES organizations(id),
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  groq_calls  INTEGER NOT NULL DEFAULT 0,
  gemini_calls INTEGER NOT NULL DEFAULT 0,
  ollama_calls INTEGER NOT NULL DEFAULT 0,
  total_calls  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (org_id, date)
);

-- ─── Email Broadcast History ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_broadcasts (
  id              TEXT PRIMARY KEY,
  subject         TEXT NOT NULL,
  body            TEXT NOT NULL,
  segment         TEXT NOT NULL DEFAULT 'all',
  recipient_count INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'sent',
  sent_by         TEXT NOT NULL,                -- user_id
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Seed: Default admin user ──────────────────────────────────────────────────
-- Password: "password" (bcrypt hash)
INSERT INTO organizations (id, name, plan) VALUES
  ('org_goatsaas', 'GOATSaaS Inc.', 'enterprise')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, name, role, plan, password_hash, avatar, org_id, org_name, org_role) VALUES
  (
    'usr_admin_001',
    'admin@goatsaas.com',
    'Super Admin',
    'admin',
    'enterprise',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'SA',
    'org_goatsaas',
    'GOATSaaS Inc.',
    'owner'
  )
ON CONFLICT (id) DO NOTHING;

-- ─── CRM Contacts ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_contacts (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
  company     TEXT,
  status      TEXT NOT NULL DEFAULT 'lead' CHECK (status IN ('lead', 'active', 'inactive')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── CRM Deals ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_deals (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id),
  contact_id  TEXT NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  amount      NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  stage       TEXT NOT NULL DEFAULT 'prospecting' CHECK (stage IN ('prospecting', 'qualification', 'proposal', 'negotiation', 'won', 'lost')),
  expected_close_date DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── CRM Activities ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_activities (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id),
  contact_id  TEXT NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('email', 'call', 'meeting', 'note')),
  notes       TEXT NOT NULL,
  date        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Logistics Fleet ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS logistics_vehicles (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id),
  driver_name TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('active', 'maintenance', 'offline')),
  location_lat NUMERIC(10, 6),
  location_lng NUMERIC(10, 6),
  last_ping   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Logistics Shipments ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS logistics_shipments (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id),
  vehicle_id  TEXT REFERENCES logistics_vehicles(id) ON DELETE SET NULL,
  origin      TEXT NOT NULL,
  destination TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'delivered', 'delayed')),
  estimated_delivery TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── eCommerce Products ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ecommerce_products (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL REFERENCES organizations(id),
  name            TEXT NOT NULL,
  description     TEXT,
  price           NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  stock_quantity  INTEGER NOT NULL DEFAULT 0,
  category        TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── eCommerce Orders ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ecommerce_orders (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL REFERENCES organizations(id),
  customer_email  TEXT NOT NULL,
  total_amount    NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'shipped', 'cancelled')),
  payment_status  TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── eCommerce Order Items ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ecommerce_order_items (
  id                TEXT PRIMARY KEY,
  order_id          TEXT NOT NULL REFERENCES ecommerce_orders(id) ON DELETE CASCADE,
  product_id        TEXT NOT NULL REFERENCES ecommerce_products(id),
  quantity          INTEGER NOT NULL DEFAULT 1,
  price_at_purchase NUMERIC(12, 2) NOT NULL
);

-- ─── Useful views ─────────────────────────────────────────────────────────────

-- Active (non-revoked) API keys
CREATE OR REPLACE VIEW active_api_keys AS
  SELECT * FROM api_keys WHERE revoked_at IS NULL;

-- Today's quota by org
CREATE OR REPLACE VIEW quota_today AS
  SELECT * FROM quota_daily WHERE date = CURRENT_DATE;

-- Recent audit log (last 1000 entries)
CREATE OR REPLACE VIEW recent_audit AS
  SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 1000;
