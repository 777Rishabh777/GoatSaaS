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

export interface CrmCompany {
  id: string;
  orgId: string;
  name: string;
  website: string | null;
  industry: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CrmContact {
  id: string;
  orgId: string;
  companyId: string | null;
  name: string;
  email: string;
  phone: string;
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
  probability: number;
  expectedCloseDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CrmActivity {
  id: string;
  orgId: string;
  contactId: string | null;
  dealId: string | null;
  type: "email" | "call" | "meeting" | "note";
  notes: string;
  metadata: Record<string, any> | null;
  date: string;
}

export const CRM_COMPANIES_DB: CrmCompany[] = [];
export const CRM_CONTACTS_DB: CrmContact[] = [];
export const CRM_DEALS_DB: CrmDeal[] = [];
export const CRM_ACTIVITIES_DB: CrmActivity[] = [];

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
  imageUrl?: string | null;
  sku?: string | null;
  status: "active" | "draft" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface EcommerceCustomer {
  id: string;
  orgId: string;
  name: string;
  email: string;
  phone: string | null;
  totalSpent: number;
  createdAt: string;
  updatedAt: string;
}

export interface EcommerceOrder {
  id: string;
  orgId: string;
  customerId: string;
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
export const ECOMMERCE_CUSTOMERS_DB: EcommerceCustomer[] = [];
export const ECOMMERCE_ORDERS_DB: EcommerceOrder[] = [];
export const ECOMMERCE_ORDER_ITEMS_DB: EcommerceOrderItem[] = [];

// ─── Type definitions ──────────────────────────────────────────────────────────

export type DbUser = UserPayload & {
  password: string;
  createdAt: string;
  lastLogin: string;
  status: string;
  llmProvider?: string | null;
  llmApiKey?: string | null;
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
            llm_provider AS "llmProvider", llm_api_key AS "llmApiKey",
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
            llm_provider AS "llmProvider", llm_api_key AS "llmApiKey",
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

async function updateUserLlmSettings(id: string, provider: string, apiKey: string): Promise<void> {
  if (!USE_REAL_DB) {
    const user = USERS_DB.find(u => u.id === id) as any;
    if (user) {
      user.llmProvider = provider;
      user.llmApiKey = apiKey;
    }
    return;
  }
  await query(`UPDATE users SET llm_provider = $1, llm_api_key = $2, updated_at = NOW() WHERE id = $3`, [provider, apiKey, id]);
}

// ─── User LLM Keys (Multiple Providers) ───────────────────────────────────────

export interface UserLlmKey {
  id: string;
  userId: string;
  provider: string;
  apiKey: string;
  createdAt: string;
  updatedAt: string;
}

export const USER_LLM_KEYS_DB: UserLlmKey[] = [];

async function getUserLlmKeys(userId: string): Promise<UserLlmKey[]> {
  if (!USE_REAL_DB) {
    return USER_LLM_KEYS_DB.filter(k => k.userId === userId);
  }
  return query<UserLlmKey>(
    `SELECT id, user_id AS "userId", provider, api_key AS "apiKey",
            created_at::text AS "createdAt", updated_at::text AS "updatedAt"
     FROM user_llm_keys WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
}

async function upsertUserLlmKey(userId: string, provider: string, apiKey: string): Promise<void> {
  if (!USE_REAL_DB) {
    const existing = USER_LLM_KEYS_DB.find(k => k.userId === userId && k.provider === provider);
    if (existing) {
      existing.apiKey = apiKey;
      existing.updatedAt = new Date().toISOString();
    } else {
      USER_LLM_KEYS_DB.push({
        id: `llmkey_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userId,
        provider,
        apiKey,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    return;
  }
  await query(
    `INSERT INTO user_llm_keys (id, user_id, provider, api_key)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, provider) DO UPDATE SET api_key = EXCLUDED.api_key, updated_at = NOW()`,
    [`llmkey_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, userId, provider, apiKey]
  );
}

async function deleteUserLlmKey(userId: string, provider: string): Promise<void> {
  if (!USE_REAL_DB) {
    const idx = USER_LLM_KEYS_DB.findIndex(k => k.userId === userId && k.provider === provider);
    if (idx !== -1) USER_LLM_KEYS_DB.splice(idx, 1);
    return;
  }
  await query(`DELETE FROM user_llm_keys WHERE user_id = $1 AND provider = $2`, [userId, provider]);
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
            llm_provider AS "llmProvider", llm_api_key AS "llmApiKey",
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
            llm_provider AS "llmProvider", llm_api_key AS "llmApiKey",
            last_login_at::text AS "lastLogin", created_at::text AS "createdAt"
     FROM users WHERE org_id = $1 ORDER BY created_at DESC`,
    [orgId]
  );
}

async function createOrganization(
  orgId: string,
  name: string,
  plan: "free" | "pro" | "enterprise" = "free"
): Promise<void> {
  if (!USE_REAL_DB) {
    // In-memory mode stores org details denormalized on users only.
    return;
  }
  await query(
    `INSERT INTO organizations (id, name, plan)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING`,
    [orgId, name, plan]
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
  await query(`UPDATE organizations SET name = $1, updated_at = NOW() WHERE id = $2`, [newName, orgId]);
  await query(`UPDATE users SET org_name = $1, updated_at = NOW() WHERE org_id = $2`, [newName, orgId]);
}

export interface DbOrganization {
  id: string;
  name: string;
  plan: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  createdAt: string;
  updatedAt: string;
}

async function getOrganizationById(id: string): Promise<DbOrganization | null> {
  if (!USE_REAL_DB) return null;
  const rows = await query<DbOrganization>(
    `SELECT id, name, plan, 
            stripe_customer_id AS "stripeCustomerId", 
            stripe_subscription_id AS "stripeSubscriptionId",
            created_at::text AS "createdAt", updated_at::text AS "updatedAt"
     FROM organizations WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

async function updateOrganizationStripe(id: string, customerId: string, subscriptionId: string | null): Promise<void> {
  if (!USE_REAL_DB) return;
  await query(
    `UPDATE organizations SET stripe_customer_id = $1, stripe_subscription_id = $2, updated_at = NOW() WHERE id = $3`,
    [customerId, subscriptionId, id]
  );
}

async function updateOrganizationPlan(id: string, plan: "free" | "pro" | "enterprise"): Promise<void> {
  if (!USE_REAL_DB) {
    USERS_DB.forEach(u => {
      if (u.orgId === id) u.plan = plan;
    });
    return;
  }
  await query(`UPDATE organizations SET plan = $1, updated_at = NOW() WHERE id = $2`, [plan, id]);
  await query(`UPDATE users SET plan = $1, updated_at = NOW() WHERE org_id = $2`, [plan, id]);
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
            revoked_at::text AS "revokedAt", expires_at::text AS "expiresAt", created_at::text AS "createdAt"
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
    `INSERT INTO api_keys (id, org_id, user_id, name, key_hash, key_prefix, key_suffix, plan, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [key.id, key.orgId, key.userId, key.name, key.keyHash, key.keyPrefix, key.keySuffix, key.plan, key.expiresAt]
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
            revoked_at::text AS "revokedAt", expires_at::text AS "expiresAt", created_at::text AS "createdAt"
     FROM api_keys WHERE org_id = $1 ORDER BY created_at DESC`,
    [orgId]
  );
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  budget: number | null;
  createdAt: string;
  updatedAt: string;
}

export const PROJECTS_DB: Project[] = [];

async function getProjectsByOrg(orgId: string): Promise<Project[]> {
  if (!USE_REAL_DB) {
    return PROJECTS_DB.filter(p => p.orgId === orgId);
  }
  return query<Project>(
    `SELECT id, org_id AS "orgId", name, description, budget,
            created_at::text AS "createdAt", updated_at::text AS "updatedAt"
     FROM projects WHERE org_id = $1 ORDER BY created_at DESC`,
    [orgId]
  );
}

async function createProject(project: Project): Promise<void> {
  if (!USE_REAL_DB) {
    PROJECTS_DB.push(project);
    return;
  }
  await query(
    `INSERT INTO projects (id, org_id, name, description, budget, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
    [project.id, project.orgId, project.name, project.description, project.budget]
  );
}

// ─── SaaS ─────────────────────────────────────────────────────────────────────

export interface SaasSubscription {
  id: string;
  orgId: string;
  projectId: string | null;
  vendorId: string | null;
  name: string;
  plan: string | null;
  amount: number;
  currency: string;
  billingCycle: string;
  renewalDate: string;
  seatsTotal: number;
  seatsUsed: number;
  departmentId: string | null;
  status: string;
  paymentMethod: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaasVendor {
  id: string;
  orgId: string;
  name: string;
  website: string | null;
  category: string | null;
  renewalTerms: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaasDepartment {
  id: string;
  orgId: string;
  name: string;
  budgetMonthly: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaasTeamMember {
  id: string;
  orgId: string;
  name: string;
  email: string;
  departmentId: string | null;
  role: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaasLicenseAssignment {
  id: string;
  orgId: string;
  subscriptionId: string;
  memberId: string;
  status: string;
  assignedAt: string;
  revokedAt: string | null;
}

export const SAAS_SUBSCRIPTIONS_DB: SaasSubscription[] = [];
export const SAAS_VENDORS_DB: SaasVendor[] = [];
export const SAAS_DEPARTMENTS_DB: SaasDepartment[] = [];
export const SAAS_TEAM_MEMBERS_DB: SaasTeamMember[] = [];
export const SAAS_LICENSE_ASSIGNMENTS_DB: SaasLicenseAssignment[] = [];

async function getOrgSubscriptions(orgId: string): Promise<SaasSubscription[]> {
  if (!USE_REAL_DB) return SAAS_SUBSCRIPTIONS_DB.filter(s => s.orgId === orgId);

  return query<SaasSubscription>(
    `SELECT id, org_id AS "orgId", project_id AS "projectId", vendor_id AS "vendorId",
            name, plan, amount, currency, billing_cycle AS "billingCycle",
            renewal_date::text AS "renewalDate",
            seats_total AS "seatsTotal", seats_used AS "seatsUsed",
            department_id AS "departmentId", status,
            payment_method AS "paymentMethod", notes,
            created_at::text AS "createdAt", updated_at::text AS "updatedAt"
     FROM saas_subscriptions WHERE org_id = $1 ORDER BY created_at DESC`,
    [orgId]
  );
}

async function createSubscription(sub: SaasSubscription): Promise<void> {
  if (!USE_REAL_DB) {
    SAAS_SUBSCRIPTIONS_DB.push(sub);
    return;
  }

  await query(
    `INSERT INTO saas_subscriptions (
        id, org_id, project_id, vendor_id, name, plan, amount, currency, billing_cycle,
        renewal_date, seats_total, seats_used, department_id, status, payment_method, notes,
        created_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,
        $10,$11,$12,$13,$14,$15,$16,
        NOW(), NOW()
      )`,
    [
      sub.id,
      sub.orgId,
      sub.projectId,
      sub.vendorId,
      sub.name,
      sub.plan,
      sub.amount,
      sub.currency,
      sub.billingCycle,
      sub.renewalDate,
      sub.seatsTotal,
      sub.seatsUsed,
      sub.departmentId,
      sub.status,
      sub.paymentMethod,
      sub.notes,
    ]
  );
}

async function updateSubscription(id: string, orgId: string, data: Partial<SaasSubscription>): Promise<void> {
  if (!USE_REAL_DB) {
    const idx = SAAS_SUBSCRIPTIONS_DB.findIndex(s => s.id === id && s.orgId === orgId);
    if (idx === -1) return;
    SAAS_SUBSCRIPTIONS_DB[idx] = { ...SAAS_SUBSCRIPTIONS_DB[idx], ...data, updatedAt: new Date().toISOString() } as any;
    return;
  }

  const mapping: Record<string, string> = {
    projectId: "project_id",
    vendorId: "vendor_id",
    name: "name",
    plan: "plan",
    amount: "amount",
    currency: "currency",
    billingCycle: "billing_cycle",
    renewalDate: "renewal_date",
    seatsTotal: "seats_total",
    seatsUsed: "seats_used",
    departmentId: "department_id",
    status: "status",
    paymentMethod: "payment_method",
    notes: "notes",
  };

  const sets: string[] = [];
  const params: any[] = [];
  let i = 1;

  for (const [key, col] of Object.entries(mapping)) {
    const val = (data as any)[key];
    if (val === undefined) continue;
    sets.push(`${col} = $${i++}`);
    params.push(val);
  }

  if (sets.length === 0) return;

  params.push(id, orgId);
  await query(
    `UPDATE saas_subscriptions SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${i++} AND org_id = $${i++}`,
    params
  );
}

async function deleteSubscription(id: string, orgId: string): Promise<void> {
  if (!USE_REAL_DB) {
    const idx = SAAS_SUBSCRIPTIONS_DB.findIndex(s => s.id === id && s.orgId === orgId);
    if (idx !== -1) SAAS_SUBSCRIPTIONS_DB.splice(idx, 1);
    return;
  }
  await query(`DELETE FROM saas_subscriptions WHERE id = $1 AND org_id = $2`, [id, orgId]);
}

async function getOrgVendors(orgId: string): Promise<SaasVendor[]> {
  if (!USE_REAL_DB) return SAAS_VENDORS_DB.filter(v => v.orgId === orgId);
  return query<SaasVendor>(
    `SELECT id, org_id AS "orgId", name, website, category, renewal_terms AS "renewalTerms",
            status, created_at::text AS "createdAt", updated_at::text AS "updatedAt"
     FROM saas_vendors WHERE org_id = $1 ORDER BY created_at DESC`,
    [orgId]
  );
}

async function createVendor(v: SaasVendor): Promise<void> {
  if (!USE_REAL_DB) {
    SAAS_VENDORS_DB.push(v);
    return;
  }
  await query(
    `INSERT INTO saas_vendors (id, org_id, name, website, category, renewal_terms, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())`,
    [v.id, v.orgId, v.name, v.website, v.category, v.renewalTerms, v.status]
  );
}

async function updateVendor(id: string, orgId: string, data: Partial<SaasVendor>): Promise<void> {
  if (!USE_REAL_DB) {
    const idx = SAAS_VENDORS_DB.findIndex(v => v.id === id && v.orgId === orgId);
    if (idx === -1) return;
    SAAS_VENDORS_DB[idx] = { ...SAAS_VENDORS_DB[idx], ...data, updatedAt: new Date().toISOString() } as any;
    return;
  }

  const mapping: Record<string, string> = {
    name: "name",
    website: "website",
    category: "category",
    renewalTerms: "renewal_terms",
    status: "status",
  };

  const sets: string[] = [];
  const params: any[] = [];
  let i = 1;
  for (const [key, col] of Object.entries(mapping)) {
    const val = (data as any)[key];
    if (val === undefined) continue;
    sets.push(`${col} = $${i++}`);
    params.push(val);
  }
  if (sets.length === 0) return;

  params.push(id, orgId);
  await query(
    `UPDATE saas_vendors SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${i++} AND org_id = $${i++}`,
    params
  );
}

async function deleteVendor(id: string, orgId: string): Promise<void> {
  if (!USE_REAL_DB) {
    const idx = SAAS_VENDORS_DB.findIndex(v => v.id === id && v.orgId === orgId);
    if (idx !== -1) SAAS_VENDORS_DB.splice(idx, 1);
    return;
  }
  await query(`DELETE FROM saas_vendors WHERE id = $1 AND org_id = $2`, [id, orgId]);
}

async function getOrgDepartments(orgId: string): Promise<SaasDepartment[]> {
  if (!USE_REAL_DB) return SAAS_DEPARTMENTS_DB.filter(d => d.orgId === orgId);
  return query<SaasDepartment>(
    `SELECT id, org_id AS "orgId", name, budget_monthly AS "budgetMonthly",
            created_at::text AS "createdAt", updated_at::text AS "updatedAt"
     FROM saas_departments WHERE org_id = $1 ORDER BY created_at DESC`,
    [orgId]
  );
}

async function createDepartment(d: SaasDepartment): Promise<void> {
  if (!USE_REAL_DB) {
    SAAS_DEPARTMENTS_DB.push(d);
    return;
  }
  await query(
    `INSERT INTO saas_departments (id, org_id, name, budget_monthly, created_at, updated_at)
     VALUES ($1,$2,$3,$4,NOW(),NOW())`,
    [d.id, d.orgId, d.name, d.budgetMonthly]
  );
}

async function updateDepartment(id: string, orgId: string, data: Partial<SaasDepartment>): Promise<void> {
  if (!USE_REAL_DB) {
    const idx = SAAS_DEPARTMENTS_DB.findIndex(d => d.id === id && d.orgId === orgId);
    if (idx === -1) return;
    SAAS_DEPARTMENTS_DB[idx] = { ...SAAS_DEPARTMENTS_DB[idx], ...data, updatedAt: new Date().toISOString() } as any;
    return;
  }

  const mapping: Record<string, string> = {
    name: "name",
    budgetMonthly: "budget_monthly",
  };

  const sets: string[] = [];
  const params: any[] = [];
  let i = 1;
  for (const [key, col] of Object.entries(mapping)) {
    const val = (data as any)[key];
    if (val === undefined) continue;
    sets.push(`${col} = $${i++}`);
    params.push(val);
  }
  if (sets.length === 0) return;

  params.push(id, orgId);
  await query(
    `UPDATE saas_departments SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${i++} AND org_id = $${i++}`,
    params
  );
}

async function deleteDepartment(id: string, orgId: string): Promise<void> {
  if (!USE_REAL_DB) {
    const idx = SAAS_DEPARTMENTS_DB.findIndex(d => d.id === id && d.orgId === orgId);
    if (idx !== -1) SAAS_DEPARTMENTS_DB.splice(idx, 1);
    return;
  }
  await query(`DELETE FROM saas_departments WHERE id = $1 AND org_id = $2`, [id, orgId]);
}

async function getOrgTeamMembers(orgId: string): Promise<SaasTeamMember[]> {
  if (!USE_REAL_DB) return SAAS_TEAM_MEMBERS_DB.filter(m => m.orgId === orgId);
  return query<SaasTeamMember>(
    `SELECT id, org_id AS "orgId", name, email, department_id AS "departmentId",
            role, status, created_at::text AS "createdAt", updated_at::text AS "updatedAt"
     FROM saas_team_members WHERE org_id = $1 ORDER BY created_at DESC`,
    [orgId]
  );
}

async function createTeamMember(m: SaasTeamMember): Promise<void> {
  if (!USE_REAL_DB) {
    SAAS_TEAM_MEMBERS_DB.push(m);
    return;
  }
  await query(
    `INSERT INTO saas_team_members (id, org_id, name, email, department_id, role, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())`,
    [m.id, m.orgId, m.name, m.email, m.departmentId, m.role, m.status]
  );
}

async function updateTeamMember(id: string, orgId: string, data: Partial<SaasTeamMember>): Promise<void> {
  if (!USE_REAL_DB) {
    const idx = SAAS_TEAM_MEMBERS_DB.findIndex(m => m.id === id && m.orgId === orgId);
    if (idx === -1) return;
    SAAS_TEAM_MEMBERS_DB[idx] = { ...SAAS_TEAM_MEMBERS_DB[idx], ...data, updatedAt: new Date().toISOString() } as any;
    return;
  }

  const mapping: Record<string, string> = {
    name: "name",
    email: "email",
    departmentId: "department_id",
    role: "role",
    status: "status",
  };

  const sets: string[] = [];
  const params: any[] = [];
  let i = 1;
  for (const [key, col] of Object.entries(mapping)) {
    const val = (data as any)[key];
    if (val === undefined) continue;
    sets.push(`${col} = $${i++}`);
    params.push(val);
  }
  if (sets.length === 0) return;

  params.push(id, orgId);
  await query(
    `UPDATE saas_team_members SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${i++} AND org_id = $${i++}`,
    params
  );
}

async function deleteTeamMember(id: string, orgId: string): Promise<void> {
  if (!USE_REAL_DB) {
    const idx = SAAS_TEAM_MEMBERS_DB.findIndex(m => m.id === id && m.orgId === orgId);
    if (idx !== -1) SAAS_TEAM_MEMBERS_DB.splice(idx, 1);
    return;
  }
  await query(`DELETE FROM saas_team_members WHERE id = $1 AND org_id = $2`, [id, orgId]);
}

async function getOrgLicenseAssignments(orgId: string): Promise<SaasLicenseAssignment[]> {
  if (!USE_REAL_DB) return SAAS_LICENSE_ASSIGNMENTS_DB.filter(a => a.orgId === orgId);
  return query<SaasLicenseAssignment>(
    `SELECT id, org_id AS "orgId", subscription_id AS "subscriptionId", member_id AS "memberId",
            status, assigned_at::text AS "assignedAt", revoked_at::text AS "revokedAt"
     FROM saas_license_assignments WHERE org_id = $1 ORDER BY assigned_at DESC`,
    [orgId]
  );
}

async function createLicenseAssignment(a: SaasLicenseAssignment): Promise<void> {
  if (!USE_REAL_DB) {
    SAAS_LICENSE_ASSIGNMENTS_DB.push(a);
    return;
  }
  await query(
    `INSERT INTO saas_license_assignments (id, org_id, subscription_id, member_id, status, assigned_at, revoked_at)
     VALUES ($1,$2,$3,$4,$5,NOW(),$6)`,
    [a.id, a.orgId, a.subscriptionId, a.memberId, a.status, a.revokedAt]
  );
}

async function updateLicenseAssignmentStatus(id: string, orgId: string, status: string): Promise<void> {
  if (!USE_REAL_DB) {
    const idx = SAAS_LICENSE_ASSIGNMENTS_DB.findIndex(a => a.id === id && a.orgId === orgId);
    if (idx === -1) return;
    SAAS_LICENSE_ASSIGNMENTS_DB[idx] = {
      ...SAAS_LICENSE_ASSIGNMENTS_DB[idx],
      status,
      revokedAt: status === "revoked" ? new Date().toISOString() : null,
    };
    return;
  }
  await query(
    `UPDATE saas_license_assignments
     SET status = $1, revoked_at = CASE WHEN $1 = 'revoked' THEN NOW() ELSE NULL END
     WHERE id = $2 AND org_id = $3`,
    [status, id, orgId]
  );
}

async function deleteLicenseAssignment(id: string, orgId: string): Promise<void> {
  if (!USE_REAL_DB) {
    const idx = SAAS_LICENSE_ASSIGNMENTS_DB.findIndex(a => a.id === id && a.orgId === orgId);
    if (idx !== -1) SAAS_LICENSE_ASSIGNMENTS_DB.splice(idx, 1);
    return;
  }
  await query(`DELETE FROM saas_license_assignments WHERE id = $1 AND org_id = $2`, [id, orgId]);
}

async function getSaasOverview(orgId: string): Promise<{ totalMonthlySpend: number; activeSubscriptions: number; upcomingRenewals: number; unusedSeats: number; }> {
  if (!USE_REAL_DB) {
    const subs = SAAS_SUBSCRIPTIONS_DB.filter(s => s.orgId === orgId);
    const active = subs.filter(s => s.status === "active");
    const totalMonthlySpend = active.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
    const activeSubscriptions = active.length;
    const upcomingRenewals = active.filter(s => {
      const d = new Date(s.renewalDate).getTime();
      return d <= Date.now() + 30 * 86400000;
    }).length;
    const unusedSeats = active.reduce((acc, s) => acc + Math.max((s.seatsTotal || 0) - (s.seatsUsed || 0), 0), 0);
    return { totalMonthlySpend, activeSubscriptions, upcomingRenewals, unusedSeats };
  }

  const rows = await query<any>(
    `SELECT
      COALESCE(SUM(CASE WHEN status = 'active' THEN amount ELSE 0 END), 0) AS "totalMonthlySpend",
      COUNT(*) FILTER (WHERE status = 'active') AS "activeSubscriptions",
      COUNT(*) FILTER (WHERE status = 'active' AND renewal_date <= NOW() + INTERVAL '30 days') AS "upcomingRenewals",
      COALESCE(SUM(CASE WHEN status = 'active' THEN GREATEST(seats_total - seats_used, 0) ELSE 0 END), 0) AS "unusedSeats"
     FROM saas_subscriptions WHERE org_id = $1`,
    [orgId]
  );

  const r = rows[0] || {};
  return {
    totalMonthlySpend: Number(r.totalMonthlySpend) || 0,
    activeSubscriptions: Number(r.activeSubscriptions) || 0,
    upcomingRenewals: Number(r.upcomingRenewals) || 0,
    unusedSeats: Number(r.unusedSeats) || 0,
  };
}

async function getUpcomingRenewals(orgId: string): Promise<SaasSubscription[]> {
  if (!USE_REAL_DB) {
    return SAAS_SUBSCRIPTIONS_DB
      .filter(s => s.orgId === orgId && s.status === "active")
      .sort((a, b) => new Date(a.renewalDate).getTime() - new Date(b.renewalDate).getTime())
      .slice(0, 20);
  }

  return query<SaasSubscription>(
    `SELECT id, org_id AS "orgId", project_id AS "projectId", vendor_id AS "vendorId",
            name, plan, amount, currency, billing_cycle AS "billingCycle",
            renewal_date::text AS "renewalDate",
            seats_total AS "seatsTotal", seats_used AS "seatsUsed",
            department_id AS "departmentId", status,
            payment_method AS "paymentMethod", notes,
            created_at::text AS "createdAt", updated_at::text AS "updatedAt"
     FROM saas_subscriptions
     WHERE org_id = $1 AND status = 'active' AND renewal_date <= NOW() + INTERVAL '30 days'
     ORDER BY renewal_date ASC
     LIMIT 20`,
    [orgId]
  );
}

// ─── Gmail Connections ─────────────────────────────────────────────────────────

export interface GmailConnection {
  userId: string;
  orgId: string;
  email: string;
  refreshToken: string;
  accessToken: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const GMAIL_CONNECTIONS_DB: GmailConnection[] = [];

// ─── Audire Interfaces & DBs ───────────────────────────────────────────────────

export interface AudireAgent {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  model: string;
  scope: string | null;
  status: "active" | "paused";
  createdAt: string;
  updatedAt: string;
}

export interface AudireAudit {
  id: string;
  orgId: string;
  url: string;
  status: "queued" | "running" | "completed" | "failed";
  score: number;
  grade: string;
  summary: string;
  signals: any | null;
  createdAt: string;
  completedAt: string | null;
}

export const AUDIRE_AGENTS_DB: AudireAgent[] = [];
export const AUDIRE_AUDITS_DB: AudireAudit[] = [];


async function upsertGmailConnection(conn: Omit<GmailConnection, "createdAt" | "updatedAt">): Promise<void> {
  const now = new Date().toISOString();
  if (!USE_REAL_DB) {
    const idx = GMAIL_CONNECTIONS_DB.findIndex(c => c.userId === conn.userId);
    const next: GmailConnection = { ...conn, createdAt: idx === -1 ? now : GMAIL_CONNECTIONS_DB[idx].createdAt, updatedAt: now };
    if (idx === -1) GMAIL_CONNECTIONS_DB.push(next);
    else GMAIL_CONNECTIONS_DB[idx] = next;
    return;
  }

  await query(
    `INSERT INTO gmail_connections (user_id, org_id, email, refresh_token, access_token, expires_at, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET org_id = EXCLUDED.org_id,
                   email = EXCLUDED.email,
                   refresh_token = EXCLUDED.refresh_token,
                   access_token = EXCLUDED.access_token,
                   expires_at = EXCLUDED.expires_at,
                   updated_at = NOW()`,
    [conn.userId, conn.orgId, conn.email, conn.refreshToken, conn.accessToken, conn.expiresAt]
  );
}

async function getGmailConnectionByUserId(userId: string): Promise<GmailConnection | null> {
  if (!USE_REAL_DB) {
    return GMAIL_CONNECTIONS_DB.find(c => c.userId === userId) ?? null;
  }

  const rows = await query<GmailConnection>(
    `SELECT user_id AS "userId", org_id AS "orgId", email,
            refresh_token AS "refreshToken", access_token AS "accessToken",
            expires_at::text AS "expiresAt",
            created_at::text AS "createdAt", updated_at::text AS "updatedAt"
     FROM gmail_connections WHERE user_id = $1`,
    [userId]
  );

  return rows[0] ?? null;
}

async function updateGmailAccessToken(userId: string, accessToken: string, expiresAt: string | null): Promise<void> {
  if (!USE_REAL_DB) {
    const idx = GMAIL_CONNECTIONS_DB.findIndex(c => c.userId === userId);
    if (idx === -1) return;
    GMAIL_CONNECTIONS_DB[idx] = { ...GMAIL_CONNECTIONS_DB[idx], accessToken, expiresAt, updatedAt: new Date().toISOString() };
    return;
  }

  await query(
    `UPDATE gmail_connections SET access_token = $1, expires_at = $2, updated_at = NOW() WHERE user_id = $3`,
    [accessToken, expiresAt, userId]
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

async function createCrmCompany(company: CrmCompany): Promise<void> {
  if (!USE_REAL_DB) {
    CRM_COMPANIES_DB.push(company);
    return;
  }
  await query(
    `INSERT INTO crm_companies (id, org_id, name, website, industry, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [company.id, company.orgId, company.name, company.website, company.industry, company.createdAt, company.updatedAt]
  );
}

async function getOrgCrmCompanies(orgId: string): Promise<CrmCompany[]> {
  if (!USE_REAL_DB) {
    return CRM_COMPANIES_DB.filter(c => c.orgId === orgId);
  }
  return query<CrmCompany>(
    `SELECT id, org_id AS "orgId", name, website, industry,
            created_at::text AS "createdAt", updated_at::text AS "updatedAt"
     FROM crm_companies WHERE org_id = $1 ORDER BY created_at DESC`,
    [orgId]
  );
}

async function createCrmContact(contact: CrmContact): Promise<void> {
  if (!USE_REAL_DB) {
    CRM_CONTACTS_DB.push(contact);
    return;
  }
  await query(
    `INSERT INTO crm_contacts (id, org_id, company_id, name, email, phone, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [contact.id, contact.orgId, contact.companyId, contact.name, contact.email, contact.phone, contact.status, contact.createdAt, contact.updatedAt]
  );
}

async function getOrgCrmContacts(orgId: string): Promise<CrmContact[]> {
  if (!USE_REAL_DB) {
    return CRM_CONTACTS_DB.filter(c => c.orgId === orgId);
  }
  return query<CrmContact>(
    `SELECT id, org_id AS "orgId", company_id AS "companyId", name, email, phone, status,
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
    `INSERT INTO crm_deals (id, org_id, contact_id, title, amount, stage, probability, expected_close_date, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [deal.id, deal.orgId, deal.contactId, deal.title, deal.amount, deal.stage, deal.probability, deal.expectedCloseDate, deal.createdAt, deal.updatedAt]
  );
}

async function getOrgCrmDeals(orgId: string): Promise<CrmDeal[]> {
  if (!USE_REAL_DB) {
    return CRM_DEALS_DB.filter(d => d.orgId === orgId);
  }
  return query<CrmDeal>(
    `SELECT id, org_id AS "orgId", contact_id AS "contactId", title, amount, stage, probability,
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

async function createCrmActivity(activity: CrmActivity): Promise<void> {
  if (!USE_REAL_DB) {
    CRM_ACTIVITIES_DB.push(activity);
    return;
  }
  await query(
    `INSERT INTO crm_activities (id, org_id, contact_id, deal_id, type, notes, metadata, date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [activity.id, activity.orgId, activity.contactId, activity.dealId, activity.type, activity.notes, activity.metadata, activity.date]
  );
}

async function getOrgCrmActivities(orgId: string): Promise<CrmActivity[]> {
  if (!USE_REAL_DB) {
    return CRM_ACTIVITIES_DB.filter(a => a.orgId === orgId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
  return query<CrmActivity>(
    `SELECT id, org_id AS "orgId", contact_id AS "contactId", deal_id AS "dealId",
            type, notes, metadata, date::text AS date
     FROM crm_activities WHERE org_id = $1 ORDER BY date DESC`,
    [orgId]
  );
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
    `INSERT INTO ecommerce_products (id, org_id, name, description, price, stock_quantity, category, image_url, sku, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [product.id, product.orgId, product.name, product.description, product.price, product.stockQuantity, product.category, product.imageUrl || null, product.sku || null, product.status, product.createdAt, product.updatedAt]
  );
}

async function getOrgEcommerceProducts(orgId: string): Promise<EcommerceProduct[]> {
  if (!USE_REAL_DB) {
    return ECOMMERCE_PRODUCTS_DB.filter(p => p.orgId === orgId);
  }
  return query<EcommerceProduct>(
    `SELECT id, org_id AS "orgId", name, description, price, stock_quantity AS "stockQuantity", category, image_url AS "imageUrl", sku, status,
            created_at::text AS "createdAt", updated_at::text AS "updatedAt"
     FROM ecommerce_products WHERE org_id = $1 ORDER BY created_at DESC`,
    [orgId]
  );
}

async function updateEcommerceProduct(productId: string, orgId: string, updates: Partial<EcommerceProduct>): Promise<void> {
  if (!USE_REAL_DB) {
    const product = ECOMMERCE_PRODUCTS_DB.find(p => p.id === productId && p.orgId === orgId);
    if (product) {
      if (updates.name !== undefined) product.name = updates.name;
      if (updates.description !== undefined) product.description = updates.description;
      if (updates.price !== undefined) product.price = updates.price;
      if (updates.stockQuantity !== undefined) product.stockQuantity = updates.stockQuantity;
      if (updates.category !== undefined) product.category = updates.category;
      if (updates.imageUrl !== undefined) product.imageUrl = updates.imageUrl;
      if (updates.sku !== undefined) product.sku = updates.sku;
      if (updates.status !== undefined) product.status = updates.status;
      product.updatedAt = new Date().toISOString();
    }
    return;
  }
  
  // Real DB update for common fields
  const fields = [];
  const values = [];
  let idx = 1;
  
  if (updates.name !== undefined) { fields.push(`name = $${idx++}`); values.push(updates.name); }
  if (updates.description !== undefined) { fields.push(`description = $${idx++}`); values.push(updates.description); }
  if (updates.price !== undefined) { fields.push(`price = $${idx++}`); values.push(updates.price); }
  if (updates.stockQuantity !== undefined) { fields.push(`stock_quantity = $${idx++}`); values.push(updates.stockQuantity); }
  if (updates.category !== undefined) { fields.push(`category = $${idx++}`); values.push(updates.category); }
  if (updates.imageUrl !== undefined) { fields.push(`image_url = $${idx++}`); values.push(updates.imageUrl); }
  if (updates.sku !== undefined) { fields.push(`sku = $${idx++}`); values.push(updates.sku); }
  if (updates.status !== undefined) { fields.push(`status = $${idx++}`); values.push(updates.status); }
  
  if (fields.length > 0) {
    fields.push(`updated_at = NOW()`);
    values.push(productId, orgId);
    await query(`UPDATE ecommerce_products SET ${fields.join(', ')} WHERE id = $${idx++} AND org_id = $${idx}`, values);
  }
}

async function createEcommerceCustomer(customer: EcommerceCustomer): Promise<void> {
  if (!USE_REAL_DB) {
    ECOMMERCE_CUSTOMERS_DB.push(customer);
    return;
  }
  await query(
    `INSERT INTO ecommerce_customers (id, org_id, name, email, phone, total_spent, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [customer.id, customer.orgId, customer.name, customer.email, customer.phone, customer.totalSpent, customer.createdAt, customer.updatedAt]
  );
}

async function getOrgEcommerceCustomers(orgId: string): Promise<EcommerceCustomer[]> {
  if (!USE_REAL_DB) {
    return ECOMMERCE_CUSTOMERS_DB.filter(c => c.orgId === orgId);
  }
  return query<EcommerceCustomer>(
    `SELECT id, org_id AS "orgId", name, email, phone, total_spent AS "totalSpent",
            created_at::text AS "createdAt", updated_at::text AS "updatedAt"
     FROM ecommerce_customers WHERE org_id = $1 ORDER BY created_at DESC`,
    [orgId]
  );
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
      `INSERT INTO ecommerce_orders (id, org_id, customer_id, total_amount, status, payment_status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [order.id, order.orgId, order.customerId, order.totalAmount, order.status, order.paymentStatus, order.createdAt, order.updatedAt]
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
    `SELECT id, org_id AS "orgId", customer_id AS "customerId", total_amount AS "totalAmount", status, payment_status AS "paymentStatus",
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

// ─── Dashboard Stats ────────────────────────────────────────────────────────

async function getDashboardStats(orgId: string) {
  let revenueData: any[] = [];
  let aiUsageData: any[] = [];
  let stats: any[] = [];
  let recentActivity: any[] = [];

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  if (!USE_REAL_DB) {
    // In-memory mock calculation
    const orders = ECOMMERCE_ORDERS_DB.filter(o => o.orgId === orgId);
    let totalRevenue = 0;
    orders.forEach(o => totalRevenue += o.totalAmount);
    
    // Fill last 7 months
    for(let i=6; i>=0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const mName = monthNames[d.getMonth()];
      const monthOrders = orders.filter(o => new Date(o.createdAt).getMonth() === d.getMonth());
      const rev = monthOrders.reduce((acc, curr) => acc + curr.totalAmount, 0);
      revenueData.push({ month: mName, revenue: rev, users: Math.floor(rev/50) + 10 });
    }

    aiUsageData = [
      { day: "Mon", calls: 1240 }, { day: "Tue", calls: 1890 },
      { day: "Wed", calls: 2300 }, { day: "Thu", calls: 1750 },
      { day: "Fri", calls: 2890 }, { day: "Sat", calls: 890 },
      { day: "Sun", calls: 650 },
    ];

    const activeUsers = USERS_DB.filter(u => u.orgId === orgId).length || 1;

    stats = [
      { label: "Total Revenue", value: `$${totalRevenue.toLocaleString()}`, delta: "+10.4%", up: true, icon: "💰", color: "emerald" },
      { label: "Active Users", value: activeUsers.toString(), delta: "+8.2%", up: true, icon: "👥", color: "purple" },
      { label: "AI API Calls", value: "14,400/day", delta: "Free tier", up: true, icon: "🤖", color: "blue" },
      { label: "System Uptime", value: "99.98%", delta: "+0.01%", up: true, icon: "⚡", color: "amber" },
    ];

    const logs = AUDIT_LOG.filter(a => a.userId === orgId || a.userEmail.includes("@")).slice(0, 5);
    recentActivity = logs.map(l => ({
      user: l.userEmail,
      action: l.action,
      time: new Date(l.timestamp).toLocaleTimeString(),
      type: l.action.includes("sql") ? "sql" : "ai"
    }));
  } else {
    // Real DB queries
    try {
      const ordersResult = await query(`SELECT DATE_TRUNC('month', created_at) as month, SUM(total_amount) as rev FROM ecommerce_orders WHERE org_id = $1 GROUP BY month ORDER BY month ASC LIMIT 7`, [orgId]);
      
      for(let i=6; i>=0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const mName = monthNames[d.getMonth()];
        const found = ordersResult.find((r: any) => new Date(r.month).getMonth() === d.getMonth());
        const rev = found ? parseFloat(found.rev) : 0;
        revenueData.push({ month: mName, revenue: rev, users: Math.floor(rev/50) + 10 });
      }

      const totalRevRow = await query(`SELECT SUM(total_amount) as total FROM ecommerce_orders WHERE org_id = $1`, [orgId]);
      const totalRev = totalRevRow[0]?.total ? parseFloat(totalRevRow[0].total) : 0;

      const usersResult = await query(`SELECT COUNT(*) as cnt FROM users WHERE org_id = $1`, [orgId]);
      const activeUsers = parseInt((usersResult[0] as any)?.cnt || "1");

      aiUsageData = [
        { day: "Mon", calls: 1240 }, { day: "Tue", calls: 1890 },
        { day: "Wed", calls: 2300 }, { day: "Thu", calls: 1750 },
        { day: "Fri", calls: 2890 }, { day: "Sat", calls: 890 },
        { day: "Sun", calls: 650 },
      ];

      stats = [
        { label: "Total Revenue", value: `$${totalRev.toLocaleString()}`, delta: "+10.4%", up: true, icon: "💰", color: "emerald" },
        { label: "Active Users", value: activeUsers.toString(), delta: "+8.2%", up: true, icon: "👥", color: "purple" },
        { label: "AI API Calls", value: "14,400/day", delta: "Free tier", up: true, icon: "🤖", color: "blue" },
        { label: "System Uptime", value: "99.98%", delta: "+0.01%", up: true, icon: "⚡", color: "amber" },
      ];

      const logs = await query(`SELECT user_email, action, timestamp FROM audit_logs WHERE user_id = $1 OR user_email ILIKE $2 ORDER BY timestamp DESC LIMIT 5`, [orgId, `%@%`]);
      recentActivity = logs.map((l: any) => ({
        user: l.user_email,
        action: l.action,
        time: new Date(l.timestamp).toLocaleTimeString(),
        type: l.action.includes("sql") ? "sql" : "ai"
      }));
    } catch (e) {
      console.error("Error fetching dashboard stats:", e);
    }
  }

  if (recentActivity.length === 0) {
    recentActivity = [
      { user: "System", action: "Dashboard initialized", time: "Just now", type: "system" }
    ];
  }

  return { revenueData, aiUsageData, stats, recentActivity };
}

// ─── Audire Operations ─────────────────────────────────────────────────────────

async function createAudireAgent(agent: any): Promise<void> {
  if (!USE_REAL_DB) {
    AUDIRE_AGENTS_DB.push(agent);
    return;
  }
  await query(
    `INSERT INTO audire_agents (id, org_id, name, description, model, scope, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
    [agent.id, agent.orgId, agent.name, agent.description, agent.model, agent.scope, agent.status]
  );
}

async function getOrgAudireAgents(orgId: string): Promise<any[]> {
  if (!USE_REAL_DB) {
    return AUDIRE_AGENTS_DB.filter(a => a.orgId === orgId);
  }
  return query<any>(
    `SELECT id, org_id AS "orgId", name, description, model, scope, status,
            created_at::text AS "createdAt", updated_at::text AS "updatedAt"
     FROM audire_agents WHERE org_id = $1 ORDER BY created_at DESC`,
    [orgId]
  );
}

async function updateAudireAgent(id: string, orgId: string, updates: Partial<any>): Promise<void> {
  if (!USE_REAL_DB) {
    const agent = AUDIRE_AGENTS_DB.find(a => a.id === id && a.orgId === orgId);
    if (agent) {
      Object.assign(agent, updates);
      agent.updatedAt = new Date().toISOString();
    }
    return;
  }

  const fields = [];
  const values = [];
  let idx = 1;

  if (updates.name !== undefined) { fields.push(`name = $${idx++}`); values.push(updates.name); }
  if (updates.description !== undefined) { fields.push(`description = $${idx++}`); values.push(updates.description); }
  if (updates.model !== undefined) { fields.push(`model = $${idx++}`); values.push(updates.model); }
  if (updates.scope !== undefined) { fields.push(`scope = $${idx++}`); values.push(updates.scope); }
  if (updates.status !== undefined) { fields.push(`status = $${idx++}`); values.push(updates.status); }

  if (fields.length > 0) {
    fields.push(`updated_at = NOW()`);
    values.push(id, orgId);
    await query(`UPDATE audire_agents SET ${fields.join(', ')} WHERE id = $${idx++} AND org_id = $${idx}`, values);
  }
}

async function deleteAudireAgent(id: string, orgId: string): Promise<void> {
  if (!USE_REAL_DB) {
    const idx = AUDIRE_AGENTS_DB.findIndex(a => a.id === id && a.orgId === orgId);
    if (idx !== -1) AUDIRE_AGENTS_DB.splice(idx, 1);
    return;
  }
  await query(`DELETE FROM audire_agents WHERE id = $1 AND org_id = $2`, [id, orgId]);
}

async function createAudireAudit(audit: any): Promise<void> {
  if (!USE_REAL_DB) {
    AUDIRE_AUDITS_DB.push(audit);
    return;
  }
  await query(
    `INSERT INTO audire_audits (id, org_id, url, status, score, grade, summary, signals, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
    [audit.id, audit.orgId, audit.url, audit.status, audit.score, audit.grade, audit.summary, audit.signals ? JSON.stringify(audit.signals) : null]
  );
}

async function getOrgAudireAudits(orgId: string): Promise<any[]> {
  if (!USE_REAL_DB) {
    return AUDIRE_AUDITS_DB.filter(a => a.orgId === orgId);
  }
  return query<any>(
    `SELECT id, org_id AS "orgId", url, status, score, grade, summary, signals,
            created_at::text AS "createdAt", completed_at::text AS "completedAt"
     FROM audire_audits WHERE org_id = $1 ORDER BY created_at DESC`,
    [orgId]
  );
}

async function updateAudireAudit(id: string, orgId: string, updates: Partial<any>): Promise<void> {
  if (!USE_REAL_DB) {
    const audit = AUDIRE_AUDITS_DB.find(a => a.id === id && a.orgId === orgId);
    if (audit) {
      Object.assign(audit, updates);
    }
    return;
  }

  const fields = [];
  const values = [];
  let idx = 1;

  if (updates.status !== undefined) { fields.push(`status = $${idx++}`); values.push(updates.status); }
  if (updates.score !== undefined) { fields.push(`score = $${idx++}`); values.push(updates.score); }
  if (updates.grade !== undefined) { fields.push(`grade = $${idx++}`); values.push(updates.grade); }
  if (updates.summary !== undefined) { fields.push(`summary = $${idx++}`); values.push(updates.summary); }
  if (updates.signals !== undefined) { fields.push(`signals = $${idx++}`); values.push(updates.signals ? JSON.stringify(updates.signals) : null); }
  if (updates.completedAt !== undefined) { fields.push(`completed_at = $${idx++}`); values.push(updates.completedAt); }

  if (fields.length > 0) {
    values.push(id, orgId);
    await query(`UPDATE audire_audits SET ${fields.join(', ')} WHERE id = $${idx++} AND org_id = $${idx}`, values);
  }
}

// ─── Advanced SaaS Data Interfaces ─────────────────────────────────────────────

export interface Invitation {
  id: string;
  orgId: string;
  email: string;
  roleAssigned: string;
  inviteToken: string;
  status: "pending" | "accepted" | "expired";
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SsoConnection {
  id: string;
  orgId: string;
  provider: "saml" | "google_workspace" | "azure_ad" | "okta";
  metadataUrl: string | null;
  certificate: string | null;
  domainEnforcement: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UsageRecord {
  id: string;
  subscriptionId: string;
  metricName: string;
  quantity: number;
  timestamp: string;
}

export interface PaymentMethod {
  id: string;
  orgId: string;
  gatewayPaymentMethodId: string;
  cardBrand: string | null;
  lastFour: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CouponAndDiscount {
  id: string;
  code: string;
  discountPercentage: number | null;
  fixedAmount: number | null;
  duration: "once" | "repeating" | "forever";
  createdAt: string;
}

export interface PlanFeature {
  id: string;
  planId: string;
  featureKey: string;
  limitValue: string;
  createdAt: string;
  updatedAt: string;
}

export interface TenantOverride {
  id: string;
  orgId: string;
  featureKey: string;
  overrideValue: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Mock DB Arrays for Advanced SaaS Features ────────────────────────────────
export const INVITATIONS_DB: Invitation[] = [];
export const SSO_CONNECTIONS_DB: SsoConnection[] = [];
export const USAGE_RECORDS_DB: UsageRecord[] = [];
export const PAYMENT_METHODS_DB: PaymentMethod[] = [];
export const COUPONS_AND_DISCOUNTS_DB: CouponAndDiscount[] = [];
export const PLAN_FEATURES_DB: PlanFeature[] = [];
export const TENANT_OVERRIDES_DB: TenantOverride[] = [];

// ─── Telemetry ─────────────────────────────────────────────────────────────
export const TELEMETRY_DB: { org_id: string; user_id?: string | null; endpoint: string; latency_ms: number; timestamp: string }[] = [];

export async function insertTelemetry(orgId: string, endpoint: string, latencyMs: number, userId?: string | null) {
  if (!USE_REAL_DB) {
    TELEMETRY_DB.push({ org_id: orgId, user_id: userId, endpoint, latency_ms: latencyMs, timestamp: new Date().toISOString() });
    return;
  }
  await query(
    `INSERT INTO telemetry (org_id, user_id, endpoint, latency_ms) VALUES ($1, $2, $3, $4)`,
    [orgId, userId || null, endpoint, latencyMs]
  );
}

// ─── Exported DB interface ─────────────────────────────────────────────────────

export const db = {
  getDashboardStats,
  // Users
  getUserByEmail,
  getUserById,
  createUser,
  updateUserLogin,
  updateUserLlmSettings,
  getUserLlmKeys,
  upsertUserLlmKey,
  deleteUserLlmKey,
  updateUserStatus,
  updateUserPlan,
  updateUserProfile,
  updateUserPassword,
  getAllUsers,
  getUsersByOrgId,
  createOrganization,
  renameOrganization,
  getOrganizationById,
  updateOrganizationStripe,
  updateOrganizationPlan,

  // Projects
  getProjectsByOrg,
  createProject,

  // SaaS
  getOrgSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  getOrgVendors,
  createVendor,
  updateVendor,
  deleteVendor,
  getOrgDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getOrgTeamMembers,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
  getOrgLicenseAssignments,
  createLicenseAssignment,
  updateLicenseAssignmentStatus,
  deleteLicenseAssignment,
  getSaasOverview,
  getUpcomingRenewals,

  // Gmail
  upsertGmailConnection,
  getGmailConnectionByUserId,
  updateGmailAccessToken,

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

  // Telemetry
  insertTelemetry,

  // CRM
  createCrmCompany,
  getOrgCrmCompanies,
  createCrmContact,
  getOrgCrmContacts,
  createCrmDeal,
  getOrgCrmDeals,
  updateCrmDealStage,
  createCrmActivity,
  getOrgCrmActivities,

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
  createEcommerceCustomer,
  getOrgEcommerceCustomers,
  createEcommerceOrder,
  getOrgEcommerceOrders,
  updateEcommerceOrderStatus,

  // Audire
  createAudireAudit,
  getOrgAudireAudits,
  updateAudireAudit,
  createAudireAgent,
  getOrgAudireAgents,
  updateAudireAgent,
  deleteAudireAgent,

  // DB mode info
  isRealDb: USE_REAL_DB,
};

export default db;
