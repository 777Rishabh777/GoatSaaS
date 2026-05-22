/**
 * GOATSaaS — Database Abstraction Layer
 *
 * Supports two modes:
 *   1. IN-MEMORY (default, zero config) — data lives in RAM, resets on restart
 *   2. NEON POSTGRES (production)      — set DATABASE_URL in .env.local
 *
 * Usage:
 *   import { db } from "@/lib/db";
 *   const user = await db.getUserByEmail("admin@goatsaas.com");
 *   await db.createUser({ ... });
 *
 * To switch to Neon:
 *   1. Go to console.neon.tech → create a free project
 *   2. Copy the connection string
 *   3. Add DATABASE_URL=... to .env.local
 *   4. Run the schema: paste schema.sql into the Neon SQL Editor
 *   Done — this file will automatically use the real DB.
 */

import { USERS_DB, INVITES_DB, type UserPayload } from "./auth";
import { API_KEYS_DB, type ApiKey } from "./apikeys";
import { AUDIT_LOG, type AuditEntry } from "./audit";

// ─── CRM Mock Data ────────────────────────────────────────────────────────────

export interface CrmContact {
  id: string;
  orgId: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  status: "lead" | "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export interface CrmDeal {
  id: string;
  orgId: string;
  contactId: string;
  title: string;
  amount: number;
  stage: "prospecting" | "qualification" | "proposal" | "negotiation" | "won" | "lost";
  expectedCloseDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export const CRM_CONTACTS_DB: CrmContact[] = [];
export const CRM_DEALS_DB: CrmDeal[] = [];

// ─── Logistics Mock Data ──────────────────────────────────────────────────────

export interface LogisticsVehicle {
  id: string;
  orgId: string;
  driverName: string;
  status: "active" | "maintenance" | "offline";
  locationLat: number | null;
  locationLng: number | null;
  lastPing: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LogisticsShipment {
  id: string;
  orgId: string;
  vehicleId: string | null;
  origin: string;
  destination: string;
  status: "pending" | "in_transit" | "delivered" | "delayed";
  estimatedDelivery: string | null;
  createdAt: string;
  updatedAt: string;
}

export const LOGISTICS_VEHICLES_DB: LogisticsVehicle[] = [];
export const LOGISTICS_SHIPMENTS_DB: LogisticsShipment[] = [];

// ─── eCommerce Mock Data ────────────────────────────────────────────────────────

export interface EcommerceProduct {
  id: string;
  orgId: string;
  name: string;
  description: string;
  price: number;
  stockQuantity: number;
  category: string;
  status: "active" | "draft" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface EcommerceOrder {
  id: string;
  orgId: string;
  customerEmail: string;
  totalAmount: number;
  status: "pending" | "paid" | "shipped" | "cancelled";
  paymentStatus: "unpaid" | "paid" | "refunded";
  createdAt: string;
  updatedAt: string;
}

export interface EcommerceOrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  priceAtPurchase: number;
}

export const ECOMMERCE_PRODUCTS_DB: EcommerceProduct[] = [];
export const ECOMMERCE_ORDERS_DB: EcommerceOrder[] = [];
export const ECOMMERCE_ORDER_ITEMS_DB: EcommerceOrderItem[] = [];

// ─── Type definitions ──────────────────────────────────────────────────────────

export type DbUser = UserPayload & {
  password: string;
  createdAt: string;
  lastLogin: string;
  status: string;
};

// ─── Detect DB mode ────────────────────────────────────────────────────────────

const USE_REAL_DB = !!process.env.DATABASE_URL;

// ─── Lazy Neon client (only loaded when DATABASE_URL is set) ───────────────────

let _pgPool: any = null;

async function getPool() {
  if (_pgPool) return _pgPool;
  if (!USE_REAL_DB) throw new Error("DATABASE_URL not set — using in-memory mode");

  // Dynamically import pg only when needed
  const { Pool } = await import("pg");
  _pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // required for Neon
    max: 10,
    idleTimeoutMillis: 30_000,
  });
  return _pgPool;
}

async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const pool = await getPool();
  const result = await pool.query(sql, params);
  return result.rows;
}

// ─── Users ────────────────────────────────────────────────────────────────────

async function getUserByEmail(email: string): Promise<DbUser | null> {
  if (!USE_REAL_DB) {
    return USERS_DB.find(u => u.email.toLowerCase() === email.toLowerCase()) ?? null;
  }
  const rows = await query<DbUser>(
    `SELECT id, email, name, role, plan, password_hash AS password, avatar,
            status, org_id AS "orgId", org_name AS "orgName", org_role AS "orgRole",
            last_login_at::text AS "lastLogin", created_at::text AS "createdAt"
     FROM users WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  return rows[0] ?? null;
}

async function getUserById(id: string): Promise<DbUser | null> {
  if (!USE_REAL_DB) {
    return USERS_DB.find(u => u.id === id) ?? null;
  }
  const rows = await query<DbUser>(
    `SELECT id, email, name, role, plan, password_hash AS password, avatar,
            status, org_id AS "orgId", org_name AS "orgName", org_role AS "orgRole",
            last_login_at::text AS "lastLogin", created_at::text AS "createdAt"
     FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

async function createUser(user: DbUser): Promise<void> {
  if (!USE_REAL_DB) {
    USERS_DB.push(user);
    return;
  }
  await query(
    `INSERT INTO users (id, email, name, role, plan, password_hash, avatar, status, org_id, org_name, org_role)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [user.id, user.email, user.name, user.role, user.plan, user.password,
     user.avatar, user.status, user.orgId, user.orgName, user.orgRole]
  );
}

async function updateUserLogin(id: string): Promise<void> {
  if (!USE_REAL_DB) {
    const user = USERS_DB.find(u => u.id === id);
    if (user) user.lastLogin = new Date().toISOString();
    return;
  }
  await query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [id]);
}

async function updateUserStatus(id: string, status: string): Promise<void> {
  if (!USE_REAL_DB) {
    const user = USERS_DB.find(u => u.id === id);
    if (user) user.status = status;
    return;
  }
  await query(`UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2`, [status, id]);
}

async function updateUserPlan(id: string, plan: string): Promise<void> {
  if (!USE_REAL_DB) {
    const user = USERS_DB.find(u => u.id === id) as any;
    if (user) user.plan = plan;
    return;
  }
  await query(`UPDATE users SET plan = $1, updated_at = NOW() WHERE id = $2`, [plan, id]);
}

async function updateUserProfile(id: string, name: string, email: string): Promise<void> {
  if (!USE_REAL_DB) {
    const user = USERS_DB.find(u => u.id === id);
    if (user) {
      user.name = name;
      user.email = email;
      user.avatar = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return;
  }
  const avatar = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
  await query(
    `UPDATE users SET name = $1, email = $2, avatar = $3, updated_at = NOW() WHERE id = $4`,
    [name, email.toLowerCase(), avatar, id]
  );
}

async function updateUserPassword(id: string, hashedPassword: string): Promise<void> {
  if (!USE_REAL_DB) {
    const user = USERS_DB.find(u => u.id === id);
    if (user) user.password = hashedPassword;
    return;
  }
  await query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [hashedPassword, id]);
}

async function getAllUsers(): Promise<Omit<DbUser, "password">[]> {
  if (!USE_REAL_DB) {
    return USERS_DB.map(({ password: _p, ...rest }) => rest);
  }
  return query<Omit<DbUser, "password">>(
    `SELECT id, email, name, role, plan, avatar, status,
            org_id AS "orgId", org_name AS "orgName", org_role AS "orgRole",
            last_login_at::text AS "lastLogin", created_at::text AS "createdAt"
     FROM users ORDER BY created_at DESC`
  );
}

async function getUsersByOrgId(orgId: string): Promise<Omit<DbUser, "password">[]> {
  if (!USE_REAL_DB) {
    return USERS_DB.filter(u => u.orgId === orgId).map(({ password: _p, ...rest }) => rest);
  }
  return query<Omit<DbUser, "password">>(
    `SELECT id, email, name, role, plan, avatar, status,
            org_id AS "orgId", org_name AS "orgName", org_role AS "orgRole",
            last_login_at::text AS "lastLogin", created_at::text AS "createdAt"
     FROM users WHERE org_id = $1 ORDER BY created_at DESC`,
    [orgId]
  );
}

async function renameOrganization(orgId: string, newName: string): Promise<void> {
  if (!USE_REAL_DB) {
    USERS_DB.forEach(u => {
      if (u.orgId === orgId) u.orgName = newName;
    });
    return;
  }
  // Our schema actually has an 'organizations' table, but the users table also denormalizes org_name.
  // Ideally we should update the organizations table as well, but this keeps parity with in-memory.
  await query(`UPDATE organizations SET name = $1, updated_at = NOW() WHERE id = $2`, [newName, orgId]);
  await query(`UPDATE users SET org_name = $1, updated_at = NOW() WHERE org_id = $2`, [newName, orgId]);
}

// ─── API Keys ──────────────────────────────────────────────────────────────────

async function getApiKeyByHash(hash: string): Promise<ApiKey | null> {
  if (!USE_REAL_DB) {
    return API_KEYS_DB.find(k => k.keyHash === hash && !k.revokedAt) ?? null;
  }
  const rows = await query<ApiKey>(
    `SELECT id, org_id AS "orgId", user_id AS "userId", name, key_hash AS "keyHash",
            key_prefix AS "keyPrefix", key_suffix AS "keySuffix", plan,
            calls_today AS "callsToday", total_calls AS "totalCalls",
            last_used_at::text AS "lastUsedAt", last_used_ip AS "lastUsedIp",
            revoked_at::text AS "revokedAt", created_at::text AS "createdAt"
     FROM api_keys WHERE key_hash = $1 AND revoked_at IS NULL`,
    [hash]
  );
  return rows[0] ?? null;
}

async function createApiKey(key: ApiKey): Promise<void> {
  if (!USE_REAL_DB) {
    API_KEYS_DB.push(key);
    return;
  }
  await query(
    `INSERT INTO api_keys (id, org_id, user_id, name, key_hash, key_prefix, key_suffix, plan)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [key.id, key.orgId, key.userId, key.name, key.keyHash, key.keyPrefix, key.keySuffix, key.plan]
  );
}

async function updateApiKeyUsage(id: string, ip: string): Promise<void> {
  if (!USE_REAL_DB) {
    const key = API_KEYS_DB.find(k => k.id === id);
    if (key) {
      key.lastUsedAt = new Date().toISOString();
      key.lastUsedIp = ip;
      key.callsToday++;
      key.totalCalls++;
    }
    return;
  }
  await query(
    `UPDATE api_keys SET last_used_at = NOW(), last_used_ip = $1,
     calls_today = calls_today + 1, total_calls = total_calls + 1 WHERE id = $2`,
    [ip, id]
  );
}

async function revokeApiKeyById(keyId: string, orgId: string): Promise<boolean> {
  if (!USE_REAL_DB) {
    const key = API_KEYS_DB.find(k => k.id === keyId && k.orgId === orgId);
    if (!key) return false;
    key.revokedAt = new Date().toISOString();
    return true;
  }
  const result = await query(
    `UPDATE api_keys SET revoked_at = NOW() WHERE id = $1 AND org_id = $2 AND revoked_at IS NULL`,
    [keyId, orgId]
  );
  return (result as any).length > 0;
}

async function getOrgApiKeys(orgId: string): Promise<Omit<ApiKey, "keyHash">[]> {
  if (!USE_REAL_DB) {
    return API_KEYS_DB
      .filter(k => k.orgId === orgId)
      .map(({ keyHash: _h, ...rest }) => rest);
  }
  return query<Omit<ApiKey, "keyHash">>(
    `SELECT id, org_id AS "orgId", user_id AS "userId", name,
            key_prefix AS "keyPrefix", key_suffix AS "keySuffix", plan,
            calls_today AS "callsToday", total_calls AS "totalCalls",
            last_used_at::text AS "lastUsedAt", last_used_ip AS "lastUsedIp",
            revoked_at::text AS "revokedAt", created_at::text AS "createdAt"
     FROM api_keys WHERE org_id = $1 ORDER BY created_at DESC`,
    [orgId]
  );
}

// ─── Webhooks ──────────────────────────────────────────────────────────────────

import type { WebhookConfig } from "./webhooks";
import { WEBHOOKS_DB } from "./webhooks";

async function createWebhook(webhook: WebhookConfig): Promise<void> {
  if (!USE_REAL_DB) {
    WEBHOOKS_DB.push(webhook);
    return;
  }
  await query(
    `INSERT INTO webhooks (id, org_id, url, secret, events, enabled, created_at, last_fired_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [webhook.id, webhook.orgId, webhook.url, webhook.secret, webhook.events, webhook.status !== "disabled", webhook.createdAt, webhook.lastFiredAt]
  );
}

async function getOrgWebhooks(orgId: string): Promise<WebhookConfig[]> {
  if (!USE_REAL_DB) {
    return WEBHOOKS_DB.filter(wh => wh.orgId === orgId);
  }
  const rows = await query(
    `SELECT id, org_id AS "orgId", url, secret, events, enabled, created_at::text AS "createdAt", last_fired_at::text AS "lastFiredAt"
     FROM webhooks WHERE org_id = $1 ORDER BY created_at DESC`,
    [orgId]
  );
  return rows.map((r: any) => ({
    ...r,
    status: r.enabled ? "active" : "disabled",
    consecutiveFailures: 0,
    lastStatus: null,
    label: r.url,
  }));
}

async function getWebhookById(id: string): Promise<WebhookConfig | null> {
  if (!USE_REAL_DB) {
    return WEBHOOKS_DB.find(wh => wh.id === id) ?? null;
  }
  const rows = await query(
    `SELECT id, org_id AS "orgId", url, secret, events, enabled, created_at::text AS "createdAt", last_fired_at::text AS "lastFiredAt"
     FROM webhooks WHERE id = $1`,
    [id]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    ...r,
    status: r.enabled ? "active" : "disabled",
    consecutiveFailures: 0,
    lastStatus: null,
    label: r.url,
  };
}

async function deleteWebhookById(id: string, orgId: string): Promise<boolean> {
  if (!USE_REAL_DB) {
    const idx = WEBHOOKS_DB.findIndex(wh => wh.id === id && wh.orgId === orgId);
    if (idx === -1) return false;
    WEBHOOKS_DB.splice(idx, 1);
    return true;
  }
  const result = await query(`DELETE FROM webhooks WHERE id = $1 AND org_id = $2 RETURNING id`, [id, orgId]);
  return result.length > 0;
}

// ─── Audit logs ────────────────────────────────────────────────────────────────

async function writeAuditLog(entry: AuditEntry): Promise<void> {
  if (!USE_REAL_DB) {
    AUDIT_LOG.push(entry);
    // Keep in-memory log at 1000 entries max
    if (AUDIT_LOG.length > 1000) AUDIT_LOG.shift();
    return;
  }
  await query(
    `INSERT INTO audit_logs (timestamp, user_id, user_email, action, target, ip, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [entry.timestamp, entry.userId, entry.userEmail, entry.action,
     entry.target, entry.ip, entry.metadata ? JSON.stringify(entry.metadata) : null]
  ).catch(err => console.error("[Audit] Failed to write log:", err));
}

async function getAuditLogs(opts: {
  userId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}): Promise<{ entries: AuditEntry[]; total: number }> {
  if (!USE_REAL_DB) {
    let entries = [...AUDIT_LOG];
    if (opts.userId) entries = entries.filter(e => e.userId === opts.userId || e.userEmail.includes(opts.userId!));
    if (opts.action) entries = entries.filter(e => e.action.startsWith(opts.action!));
    if (opts.startDate) entries = entries.filter(e => e.timestamp >= opts.startDate!);
    if (opts.endDate) entries = entries.filter(e => e.timestamp <= opts.endDate! + "T23:59:59Z");
    entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const total = entries.length;
    return { entries: entries.slice(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 20)), total };
  }

  const conditions: string[] = [];
  const params: any[] = [];
  let i = 1;

  if (opts.userId) { conditions.push(`(user_id = $${i} OR user_email ILIKE $${i + 1})`); params.push(opts.userId, `%${opts.userId}%`); i += 2; }
  if (opts.action) { conditions.push(`action LIKE $${i}`); params.push(`${opts.action}%`); i++; }
  if (opts.startDate) { conditions.push(`timestamp >= $${i}`); params.push(opts.startDate); i++; }
  if (opts.endDate) { conditions.push(`timestamp <= $${i}::date + interval '1 day'`); params.push(opts.endDate); i++; }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const [countRow] = await query<{ count: string }>(`SELECT COUNT(*) AS count FROM audit_logs ${where}`, params);
  const total = parseInt(countRow?.count ?? "0");

  const entries = await query<AuditEntry>(
    `SELECT id::text, timestamp::text, user_id AS "userId", user_email AS "userEmail",
            action, target, ip, metadata
     FROM audit_logs ${where} ORDER BY timestamp DESC LIMIT $${i} OFFSET $${i + 1}`,
    [...params, opts.limit ?? 20, opts.offset ?? 0]
  );

  return { entries, total };
}

// ─── CRM Operations ────────────────────────────────────────────────────────────

async function createCrmContact(contact: CrmContact): Promise<void> {
  if (!USE_REAL_DB) {
    CRM_CONTACTS_DB.push(contact);
    return;
  }
  await query(
    `INSERT INTO crm_contacts (id, org_id, name, email, phone, company, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [contact.id, contact.orgId, contact.name, contact.email, contact.phone, contact.company, contact.status, contact.createdAt, contact.updatedAt]
  );
}

async function getOrgCrmContacts(orgId: string): Promise<CrmContact[]> {
  if (!USE_REAL_DB) {
    return CRM_CONTACTS_DB.filter(c => c.orgId === orgId);
  }
  return query<CrmContact>(
    `SELECT id, org_id AS "orgId", name, email, phone, company, status,
            created_at::text AS "createdAt", updated_at::text AS "updatedAt"
     FROM crm_contacts WHERE org_id = $1 ORDER BY created_at DESC`,
    [orgId]
  );
}

async function createCrmDeal(deal: CrmDeal): Promise<void> {
  if (!USE_REAL_DB) {
    CRM_DEALS_DB.push(deal);
    return;
  }
  await query(
    `INSERT INTO crm_deals (id, org_id, contact_id, title, amount, stage, expected_close_date, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [deal.id, deal.orgId, deal.contactId, deal.title, deal.amount, deal.stage, deal.expectedCloseDate, deal.createdAt, deal.updatedAt]
  );
}

async function getOrgCrmDeals(orgId: string): Promise<CrmDeal[]> {
  if (!USE_REAL_DB) {
    return CRM_DEALS_DB.filter(d => d.orgId === orgId);
  }
  return query<CrmDeal>(
    `SELECT id, org_id AS "orgId", contact_id AS "contactId", title, amount, stage,
            expected_close_date::text AS "expectedCloseDate", created_at::text AS "createdAt", updated_at::text AS "updatedAt"
     FROM crm_deals WHERE org_id = $1 ORDER BY created_at DESC`,
    [orgId]
  );
}

async function updateCrmDealStage(dealId: string, orgId: string, stage: string): Promise<void> {
  if (!USE_REAL_DB) {
    const deal = CRM_DEALS_DB.find(d => d.id === dealId && d.orgId === orgId);
    if (deal) {
      deal.stage = stage as any;
      deal.updatedAt = new Date().toISOString();
    }
    return;
  }
  await query(`UPDATE crm_deals SET stage = $1, updated_at = NOW() WHERE id = $2 AND org_id = $3`, [stage, dealId, orgId]);
}

// ─── Logistics Operations ──────────────────────────────────────────────────────

async function createLogisticsVehicle(vehicle: LogisticsVehicle): Promise<void> {
  if (!USE_REAL_DB) {
    LOGISTICS_VEHICLES_DB.push(vehicle);
    return;
  }
  await query(
    `INSERT INTO logistics_vehicles (id, org_id, driver_name, status, location_lat, location_lng, last_ping, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [vehicle.id, vehicle.orgId, vehicle.driverName, vehicle.status, vehicle.locationLat, vehicle.locationLng, vehicle.lastPing, vehicle.createdAt, vehicle.updatedAt]
  );
}

async function getOrgLogisticsVehicles(orgId: string): Promise<LogisticsVehicle[]> {
  if (!USE_REAL_DB) {
    return LOGISTICS_VEHICLES_DB.filter(v => v.orgId === orgId);
  }
  return query<LogisticsVehicle>(
    `SELECT id, org_id AS "orgId", driver_name AS "driverName", status,
            location_lat AS "locationLat", location_lng AS "locationLng",
            last_ping::text AS "lastPing", created_at::text AS "createdAt", updated_at::text AS "updatedAt"
     FROM logistics_vehicles WHERE org_id = $1 ORDER BY created_at DESC`,
    [orgId]
  );
}

async function updateLogisticsVehicleStatus(vehicleId: string, orgId: string, status: string, lat?: number, lng?: number): Promise<void> {
  if (!USE_REAL_DB) {
    const vehicle = LOGISTICS_VEHICLES_DB.find(v => v.id === vehicleId && v.orgId === orgId);
    if (vehicle) {
      vehicle.status = status as any;
      if (lat !== undefined) vehicle.locationLat = lat;
      if (lng !== undefined) vehicle.locationLng = lng;
      vehicle.lastPing = new Date().toISOString();
      vehicle.updatedAt = new Date().toISOString();
    }
    return;
  }
  if (lat !== undefined && lng !== undefined) {
    await query(`UPDATE logistics_vehicles SET status = $1, location_lat = $2, location_lng = $3, last_ping = NOW(), updated_at = NOW() WHERE id = $4 AND org_id = $5`, [status, lat, lng, vehicleId, orgId]);
  } else {
    await query(`UPDATE logistics_vehicles SET status = $1, updated_at = NOW() WHERE id = $2 AND org_id = $3`, [status, vehicleId, orgId]);
  }
}

async function createLogisticsShipment(shipment: LogisticsShipment): Promise<void> {
  if (!USE_REAL_DB) {
    LOGISTICS_SHIPMENTS_DB.push(shipment);
    return;
  }
  await query(
    `INSERT INTO logistics_shipments (id, org_id, vehicle_id, origin, destination, status, estimated_delivery, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [shipment.id, shipment.orgId, shipment.vehicleId, shipment.origin, shipment.destination, shipment.status, shipment.estimatedDelivery, shipment.createdAt, shipment.updatedAt]
  );
}

async function getOrgLogisticsShipments(orgId: string): Promise<LogisticsShipment[]> {
  if (!USE_REAL_DB) {
    return LOGISTICS_SHIPMENTS_DB.filter(s => s.orgId === orgId);
  }
  return query<LogisticsShipment>(
    `SELECT id, org_id AS "orgId", vehicle_id AS "vehicleId", origin, destination, status,
            estimated_delivery::text AS "estimatedDelivery", created_at::text AS "createdAt", updated_at::text AS "updatedAt"
     FROM logistics_shipments WHERE org_id = $1 ORDER BY created_at DESC`,
    [orgId]
  );
}

async function updateLogisticsShipmentStatus(shipmentId: string, orgId: string, status: string): Promise<void> {
  if (!USE_REAL_DB) {
    const shipment = LOGISTICS_SHIPMENTS_DB.find(s => s.id === shipmentId && s.orgId === orgId);
    if (shipment) {
      shipment.status = status as any;
      shipment.updatedAt = new Date().toISOString();
    }
    return;
  }
  await query(`UPDATE logistics_shipments SET status = $1, updated_at = NOW() WHERE id = $2 AND org_id = $3`, [status, shipmentId, orgId]);
}

// ─── eCommerce Operations ────────────────────────────────────────────────────────

async function createEcommerceProduct(product: EcommerceProduct): Promise<void> {
  if (!USE_REAL_DB) {
    ECOMMERCE_PRODUCTS_DB.push(product);
    return;
  }
  await query(
    `INSERT INTO ecommerce_products (id, org_id, name, description, price, stock_quantity, category, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [product.id, product.orgId, product.name, product.description, product.price, product.stockQuantity, product.category, product.status, product.createdAt, product.updatedAt]
  );
}

async function getOrgEcommerceProducts(orgId: string): Promise<EcommerceProduct[]> {
  if (!USE_REAL_DB) {
    return ECOMMERCE_PRODUCTS_DB.filter(p => p.orgId === orgId);
  }
  return query<EcommerceProduct>(
    `SELECT id, org_id AS "orgId", name, description, price, stock_quantity AS "stockQuantity", category, status,
            created_at::text AS "createdAt", updated_at::text AS "updatedAt"
     FROM ecommerce_products WHERE org_id = $1 ORDER BY created_at DESC`,
    [orgId]
  );
}

async function updateEcommerceProduct(productId: string, orgId: string, updates: Partial<EcommerceProduct>): Promise<void> {
  if (!USE_REAL_DB) {
    const product = ECOMMERCE_PRODUCTS_DB.find(p => p.id === productId && p.orgId === orgId);
    if (product) {
      if (updates.name) product.name = updates.name;
      if (updates.price !== undefined) product.price = updates.price;
      if (updates.stockQuantity !== undefined) product.stockQuantity = updates.stockQuantity;
      if (updates.status) product.status = updates.status;
      product.updatedAt = new Date().toISOString();
    }
    return;
  }
  
  // Real DB update for common fields
  const fields = [];
  const values = [];
  let idx = 1;
  
  if (updates.name) { fields.push(`name = $${idx++}`); values.push(updates.name); }
  if (updates.price !== undefined) { fields.push(`price = $${idx++}`); values.push(updates.price); }
  if (updates.stockQuantity !== undefined) { fields.push(`stock_quantity = $${idx++}`); values.push(updates.stockQuantity); }
  if (updates.status) { fields.push(`status = $${idx++}`); values.push(updates.status); }
  
  if (fields.length > 0) {
    fields.push(`updated_at = NOW()`);
    values.push(productId, orgId);
    await query(`UPDATE ecommerce_products SET ${fields.join(', ')} WHERE id = $${idx++} AND org_id = $${idx}`, values);
  }
}

async function createEcommerceOrder(order: EcommerceOrder, items: EcommerceOrderItem[]): Promise<void> {
  if (!USE_REAL_DB) {
    ECOMMERCE_ORDERS_DB.push(order);
    items.forEach(i => ECOMMERCE_ORDER_ITEMS_DB.push(i));
    return;
  }
  
  // Need transaction
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO ecommerce_orders (id, org_id, customer_email, total_amount, status, payment_status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [order.id, order.orgId, order.customerEmail, order.totalAmount, order.status, order.paymentStatus, order.createdAt, order.updatedAt]
    );
    
    for (const item of items) {
      await client.query(
        `INSERT INTO ecommerce_order_items (id, order_id, product_id, quantity, price_at_purchase)
         VALUES ($1, $2, $3, $4, $5)`,
        [item.id, item.orderId, item.productId, item.quantity, item.priceAtPurchase]
      );
      // Decrement stock
      await client.query(
        `UPDATE ecommerce_products SET stock_quantity = stock_quantity - $1 WHERE id = $2`,
        [item.quantity, item.productId]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function getOrgEcommerceOrders(orgId: string): Promise<any[]> {
  if (!USE_REAL_DB) {
    return ECOMMERCE_ORDERS_DB.filter(o => o.orgId === orgId).map(order => ({
      ...order,
      items: ECOMMERCE_ORDER_ITEMS_DB.filter(i => i.orderId === order.id).map(i => ({
        ...i,
        productName: ECOMMERCE_PRODUCTS_DB.find(p => p.id === i.productId)?.name || "Unknown Product"
      }))
    }));
  }
  
  const orders = await query<EcommerceOrder>(
    `SELECT id, org_id AS "orgId", customer_email AS "customerEmail", total_amount AS "totalAmount", status, payment_status AS "paymentStatus",
            created_at::text AS "createdAt", updated_at::text AS "updatedAt"
     FROM ecommerce_orders WHERE org_id = $1 ORDER BY created_at DESC`,
    [orgId]
  );
  
  // For simplicity, N+1 query here since it's a dashboard (or could use json_agg)
  for (const order of orders) {
    const items = await query(
      `SELECT i.id, i.order_id AS "orderId", i.product_id AS "productId", i.quantity, i.price_at_purchase AS "priceAtPurchase",
              p.name AS "productName"
       FROM ecommerce_order_items i
       JOIN ecommerce_products p ON p.id = i.product_id
       WHERE i.order_id = $1`,
      [order.id]
    );
    (order as any).items = items;
  }
  
  return orders;
}

async function updateEcommerceOrderStatus(orderId: string, orgId: string, status: string, paymentStatus?: string): Promise<void> {
  if (!USE_REAL_DB) {
    const order = ECOMMERCE_ORDERS_DB.find(o => o.id === orderId && o.orgId === orgId);
    if (order) {
      order.status = status as any;
      if (paymentStatus) order.paymentStatus = paymentStatus as any;
      order.updatedAt = new Date().toISOString();
    }
    return;
  }
  if (paymentStatus) {
    await query(`UPDATE ecommerce_orders SET status = $1, payment_status = $2, updated_at = NOW() WHERE id = $3 AND org_id = $4`, [status, paymentStatus, orderId, orgId]);
  } else {
    await query(`UPDATE ecommerce_orders SET status = $1, updated_at = NOW() WHERE id = $2 AND org_id = $3`, [status, orderId, orgId]);
  }
}

// ─── Exported DB interface ─────────────────────────────────────────────────────

export const db = {
  // Users
  getUserByEmail,
  getUserById,
  createUser,
  updateUserLogin,
  updateUserStatus,
  updateUserPlan,
  updateUserProfile,
  updateUserPassword,
  getAllUsers,
  getUsersByOrgId,
  renameOrganization,

  // API Keys
  getApiKeyByHash,
  createApiKey,
  updateApiKeyUsage,
  revokeApiKeyById,
  getOrgApiKeys,

  // Webhooks
  createWebhook,
  getOrgWebhooksDb: getOrgWebhooks,
  deleteWebhookById,
  getWebhookById,

  // Audit
  writeAuditLog,
  getAuditLogs,

  // CRM
  createCrmContact,
  getOrgCrmContacts,
  createCrmDeal,
  getOrgCrmDeals,
  updateCrmDealStage,

  // Logistics
  createLogisticsVehicle,
  getOrgLogisticsVehicles,
  updateLogisticsVehicleStatus,
  createLogisticsShipment,
  getOrgLogisticsShipments,
  updateLogisticsShipmentStatus,

  // eCommerce
  createEcommerceProduct,
  getOrgEcommerceProducts,
  updateEcommerceProduct,
  createEcommerceOrder,
  getOrgEcommerceOrders,
  updateEcommerceOrderStatus,

  // DB mode info
  isRealDb: USE_REAL_DB,
};

export default db;
