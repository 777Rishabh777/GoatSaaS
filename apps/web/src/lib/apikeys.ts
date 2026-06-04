/**
 * API Key system for GOATSaaS.
 * Keys look like: gsk_live_<32 hex chars>
 * They are hashed before storage (show raw key only once, like Stripe).
 */

import crypto from "crypto";
import { logAction } from "./audit";
import { incrementQuota, checkQuotaExceeded, PLAN_LIMITS } from "./quota";
import { db } from "./db";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApiKey {
  id: string;
  orgId: string;
  projectId?: string | null;
  userId: string;
  name: string;
  keyHash: string;       // SHA-256 of the raw key — never stored raw
  keyPrefix: string;     // "gsk_live_abc1" — shown in UI
  keySuffix: string;     // last 4 chars — shown in UI for recognition
  plan: "free" | "pro" | "enterprise";
  createdAt: string;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  revokedAt: string | null;
  expiresAt: string | null;
  callsToday: number;
  totalCalls: number;
}

export interface ApiKeyValidation {
  valid: boolean;
  keyRecord?: ApiKey;
  error?: string;
}

// ─── In-memory store (Exported for db.ts abstraction) ──────────────────────────

export const API_KEYS_DB: ApiKey[] = [
  // Pre-seeded demo key for admin — raw value is "gsk_live_demo_key_for_testing_only"
  {
    id: "key_demo_001",
    orgId: "org_goatsaas",
    userId: "usr_001",
    name: "Demo Key (pre-seeded)",
    keyHash: crypto.createHash("sha256").update("gsk_live_demo_key_for_testing_only").digest("hex"),
    keyPrefix: "gsk_live_demo",
    keySuffix: "only",
    plan: "pro",
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    lastUsedAt: new Date(Date.now() - 3600000).toISOString(),
    lastUsedIp: "103.21.58.12",
    revokedAt: null,
    expiresAt: null,
    callsToday: 412,
    totalCalls: 2840,
  },
];

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Per-minute request counts per key
const RATE_COUNTERS: Map<string, { count: number; resetAt: number }> = new Map();

const RATE_LIMITS: Record<string, number> = {
  free: 10,        // 10 req/min
  pro: 120,        // 120 req/min
  enterprise: 600, // 600 req/min
};

function checkRateLimit(keyId: string, plan: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const windowMs = 60_000;
  const limit = RATE_LIMITS[plan] ?? 10;

  const counter = RATE_COUNTERS.get(keyId);
  if (!counter || now > counter.resetAt) {
    RATE_COUNTERS.set(keyId, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (counter.count >= limit) {
    return { allowed: false, retryAfter: Math.ceil((counter.resetAt - now) / 1000) };
  }

  counter.count++;
  return { allowed: true };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a new API key. Returns the raw key (shown ONCE) and the stored record.
 */
export async function generateApiKey(opts: {
  userId: string;
  orgId: string;
  projectId?: string | null;
  name: string;
  plan: "free" | "pro" | "enterprise";
}): Promise<{ rawKey: string; record: ApiKey }> {
  const rawKey = `gsk_live_${crypto.randomBytes(16).toString("hex")}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 13); // "gsk_live_xxxx"
  const keySuffix = rawKey.slice(-4);

  const record: ApiKey = {
    id: `key_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
    orgId: opts.orgId,
    projectId: opts.projectId,
    userId: opts.userId,
    name: opts.name,
    keyHash,
    keyPrefix,
    keySuffix,
    plan: opts.plan,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    lastUsedIp: null,
    revokedAt: null,
    expiresAt: null,
    callsToday: 0,
    totalCalls: 0,
  };

  await db.createApiKey(record);
  return { rawKey, record };
}

/**
 * Validate a Bearer token from an API request.
 * Checks: exists, not revoked, rate limit, daily quota.
 */
export async function validateApiKey(rawKey: string, ip?: string): Promise<ApiKeyValidation> {
  if (!rawKey || !rawKey.startsWith("gsk_live_")) {
    return { valid: false, error: "Invalid API key format. Keys must start with gsk_live_" };
  }

  const hash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const record = await db.getApiKeyByHash(hash);

  if (!record) {
    return { valid: false, error: "API key not found or has been revoked." };
  }

  // Rate limit check
  const rateCheck = checkRateLimit(record.id, record.plan);
  if (!rateCheck.allowed) {
    return { valid: false, error: `Rate limit exceeded. Retry after ${rateCheck.retryAfter}s.` };
  }

  // Daily quota check
  if (checkQuotaExceeded(record.orgId, record.plan)) {
    const limit = PLAN_LIMITS[record.plan as keyof typeof PLAN_LIMITS];
    return { valid: false, error: `Daily quota of ${limit} API calls exceeded. Upgrade your plan.` };
  }

  // Update usage stats
  await db.updateApiKeyUsage(record.id, ip ?? "127.0.0.1");
  incrementQuota(record.orgId);

  return { valid: true, keyRecord: record };
}

/**
 * Get all active (non-revoked) keys for an org.
 */
export async function getOrgKeys(orgId: string): Promise<Omit<ApiKey, "keyHash">[]> {
  return db.getOrgApiKeys(orgId);
}

/**
 * Revoke a key by ID. Only the owning org can revoke.
 */
export async function revokeApiKey(keyId: string, orgId: string): Promise<boolean> {
  return db.revokeApiKeyById(keyId, orgId);
}

/**
 * Extract Bearer token from Authorization header.
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}
