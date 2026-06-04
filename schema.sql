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
  stripe_customer_id      TEXT,
  stripe_subscription_id  TEXT,
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

  -- User-scoped LLM settings (BYOK). Stored as plaintext for MVP.
  -- NOTE: Treat this as sensitive.
  llm_provider    TEXT,
  llm_api_key     TEXT,

  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── User LLM Keys ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_llm_keys (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider    TEXT NOT NULL,
  api_key     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- ─── Projects ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,                  -- e.g. "prj_001"
  org_id      TEXT NOT NULL REFERENCES organizations(id),
  name        TEXT NOT NULL,
  description TEXT,
  budget      NUMERIC(12, 2),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── API Keys ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organizations(id),
  user_id       TEXT NOT NULL REFERENCES users(id),
  project_id    TEXT REFERENCES projects(id) ON DELETE SET NULL,
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
  expires_at    TIMESTAMPTZ,                     -- Optional expiration date
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

-- ─── Gmail OAuth Connections ───────────────────────────────────────────────────
-- Stores tokens for Gmail scanning per-user. Tokens are stored encrypted-at-rest by the app.
CREATE TABLE IF NOT EXISTS gmail_connections (
  user_id      TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  org_id       TEXT NOT NULL REFERENCES organizations(id),
  email        TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  access_token  TEXT,
  expires_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Telemetry ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS telemetry (
  id          SERIAL PRIMARY KEY,
  org_id      TEXT NOT NULL DEFAULT 'default_org',
  user_id     TEXT REFERENCES users(id),
  endpoint    TEXT NOT NULL,
  latency_ms  INTEGER NOT NULL,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

-- ─── CRM Companies ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_companies (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id),
  name        TEXT NOT NULL,
  website     TEXT,
  industry    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── CRM Contacts ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_contacts (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id),
  company_id  TEXT REFERENCES crm_companies(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
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
  probability INTEGER NOT NULL DEFAULT 50,
  expected_close_date DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── CRM Activities ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_activities (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id),
  contact_id  TEXT REFERENCES crm_contacts(id) ON DELETE CASCADE,
  deal_id     TEXT REFERENCES crm_deals(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('email', 'call', 'meeting', 'note')),
  notes       TEXT NOT NULL,
  metadata    JSONB,
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
  image_url       TEXT,
  sku             TEXT UNIQUE,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── eCommerce Customers ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ecommerce_customers (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL REFERENCES organizations(id),
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  phone           TEXT,
  total_spent     NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── eCommerce Orders ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ecommerce_orders (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL REFERENCES organizations(id),
  customer_id     TEXT NOT NULL REFERENCES ecommerce_customers(id),
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

-- ─── SaaS Departments ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saas_departments (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id),
  name        TEXT NOT NULL,
  budget_monthly NUMERIC(12, 2),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── SaaS Vendors ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saas_vendors (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id),
  name        TEXT NOT NULL,
  website     TEXT,
  category    TEXT,
  renewal_terms TEXT,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── SaaS Subscriptions ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saas_subscriptions (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id),
  project_id  TEXT REFERENCES projects(id) ON DELETE SET NULL,
  vendor_id   TEXT REFERENCES saas_vendors(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  plan        TEXT,
  amount      NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  currency    TEXT NOT NULL DEFAULT 'USD',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual', 'quarterly', 'custom')),
  renewal_date TIMESTAMPTZ NOT NULL,
  seats_total INTEGER NOT NULL DEFAULT 1,
  seats_used  INTEGER NOT NULL DEFAULT 0,
  department_id TEXT REFERENCES saas_departments(id) ON DELETE SET NULL,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trial', 'paused', 'canceled')),
  payment_method TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── SaaS Team Members ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saas_team_members (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  department_id TEXT REFERENCES saas_departments(id) ON DELETE SET NULL,
  role        TEXT,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── SaaS License Assignments ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saas_license_assignments (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL REFERENCES organizations(id),
  subscription_id TEXT NOT NULL REFERENCES saas_subscriptions(id) ON DELETE CASCADE,
  member_id       TEXT NOT NULL REFERENCES saas_team_members(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'revoked')),
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at      TIMESTAMPTZ
);

-- ─── Audire Agents ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audire_agents (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id),
  name        TEXT NOT NULL,
  description TEXT,
  model       TEXT NOT NULL,
  scope       TEXT,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Audire Audits ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audire_audits (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id),
  url         TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  score       INTEGER NOT NULL DEFAULT 0,
  grade       TEXT NOT NULL DEFAULT 'F',
  summary     TEXT NOT NULL,
  signals     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ─── Access, Invites, and Security ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invitations (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL REFERENCES organizations(id),
  email           TEXT NOT NULL,
  role_assigned   TEXT NOT NULL,
  invite_token    TEXT NOT NULL UNIQUE,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sso_connections (
  id                  TEXT PRIMARY KEY,
  org_id              TEXT NOT NULL REFERENCES organizations(id),
  provider            TEXT NOT NULL CHECK (provider IN ('saml', 'google_workspace', 'azure_ad', 'okta')),
  metadata_url        TEXT,
  certificate         TEXT,
  domain_enforcement  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Advanced Billing & Usage Tracking ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS usage_records (
  id              TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES saas_subscriptions(id),
  metric_name     TEXT NOT NULL,
  quantity        INTEGER NOT NULL DEFAULT 1,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id                        TEXT PRIMARY KEY,
  org_id                    TEXT NOT NULL REFERENCES organizations(id),
  gateway_payment_method_id TEXT NOT NULL,
  card_brand                TEXT,
  last_four                 TEXT,
  is_default                BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coupons_and_discounts (
  id                  TEXT PRIMARY KEY,
  code                TEXT NOT NULL UNIQUE,
  discount_percentage NUMERIC(5, 2),
  fixed_amount        NUMERIC(10, 2),
  duration            TEXT NOT NULL CHECK (duration IN ('once', 'repeating', 'forever')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Entitlements & Features ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS plan_features (
  id              TEXT PRIMARY KEY,
  plan_id         TEXT NOT NULL, -- Logical name like 'pro', 'enterprise'
  feature_key     TEXT NOT NULL,
  limit_value     TEXT NOT NULL, -- Stored as string, parsed to int/bool in app
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(plan_id, feature_key)
);

CREATE TABLE IF NOT EXISTS tenant_overrides (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL REFERENCES organizations(id),
  feature_key     TEXT NOT NULL,
  override_value  TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, feature_key)
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
