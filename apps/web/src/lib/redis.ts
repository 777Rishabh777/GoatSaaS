/**
 * Upstash Redis client for feature flags.
 * Falls back to in-memory store if env vars are not set,
 * so the app works locally without Upstash configured.
 */

// ─── In-memory fallback ───────────────────────────────────────────────────────
// Structure: { [orgId]: { [flagName]: boolean } }
const MEM_FLAGS: Record<string, Record<string, boolean>> = {};

// Default flags per plan
const PLAN_DEFAULTS: Record<string, Record<string, boolean>> = {
  free: {
    ai_analyst:    false,
    nl_sql:        true,
    knowledge_base: false,
    telemetry:     false,
    cloud_map:     false,
    rag_upload:    false,
    export_csv:    false,
    export_pdf:    false,
    api_keys:      false,
    onboarding:    true,
  },
  pro: {
    ai_analyst:    true,
    nl_sql:        true,
    knowledge_base: true,
    telemetry:     true,
    cloud_map:     true,
    rag_upload:    true,
    export_csv:    true,
    export_pdf:    true,
    api_keys:      true,
    onboarding:    true,
  },
  enterprise: {
    ai_analyst:    true,
    nl_sql:        true,
    knowledge_base: true,
    telemetry:     true,
    cloud_map:     true,
    rag_upload:    true,
    export_csv:    true,
    export_pdf:    true,
    api_keys:      true,
    onboarding:    true,
  },
};

export const ALL_FLAGS = Object.keys(PLAN_DEFAULTS.free);

// ─── Redis client (optional) ──────────────────────────────────────────────────
let redisClient: any = null;

async function getRedis() {
  if (redisClient) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const { Redis } = await import("@upstash/redis");
    redisClient = new Redis({ url, token });
    return redisClient;
  } catch {
    return null;
  }
}

function orgKey(orgId: string) {
  return `flags:${orgId}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getFlag(orgId: string, flagName: string): Promise<boolean> {
  try {
    const redis = await getRedis();
    if (redis) {
      const val = await redis.hget(orgKey(orgId), flagName);
      if (val !== null && val !== undefined) return Boolean(val);
    }
    // Fallback to memory
    return MEM_FLAGS[orgId]?.[flagName] ?? false;
  } catch {
    return MEM_FLAGS[orgId]?.[flagName] ?? false;
  }
}

export async function setFlag(orgId: string, flagName: string, value: boolean): Promise<void> {
  // Always update memory
  if (!MEM_FLAGS[orgId]) MEM_FLAGS[orgId] = {};
  MEM_FLAGS[orgId][flagName] = value;

  try {
    const redis = await getRedis();
    if (redis) {
      await redis.hset(orgKey(orgId), { [flagName]: value ? "1" : "0" });
    }
  } catch {
    // Memory already updated, swallow Redis error
  }
}

export async function getAllFlags(orgId: string): Promise<Record<string, boolean>> {
  try {
    const redis = await getRedis();
    if (redis) {
      const raw = await redis.hgetall(orgKey(orgId));
      if (raw && Object.keys(raw).length > 0) {
        return Object.fromEntries(
          Object.entries(raw).map(([k, v]) => [k, v === "1" || v === true])
        );
      }
    }
  } catch {}

  return { ...(MEM_FLAGS[orgId] ?? {}) };
}

export async function setFlagsForPlan(orgId: string, plan: "free" | "pro" | "enterprise"): Promise<void> {
  const defaults = PLAN_DEFAULTS[plan] ?? PLAN_DEFAULTS.free;
  for (const [flag, val] of Object.entries(defaults)) {
    await setFlag(orgId, flag, val);
  }
}

export async function getAllFlagsAllOrgs(orgIds: string[]): Promise<Record<string, Record<string, boolean>>> {
  const result: Record<string, Record<string, boolean>> = {};
  for (const orgId of orgIds) {
    result[orgId] = await getAllFlags(orgId);
  }
  return result;
}

export { PLAN_DEFAULTS };
