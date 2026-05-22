/**
 * Append-only audit log.
 * Stores in memory (and optionally could be persisted to DB).
 * For SOC2: every write must be immutable — no update/delete operations.
 */

export type AuditAction =
  | "auth:login"
  | "auth:logout"
  | "auth:signup"
  | "auth:password_change"
  | "auth:failed_login"
  | "settings:profile_update"
  | "settings:org_rename"
  | "settings:invite_sent"
  | "settings:invite_revoked"
  | "settings:member_removed"
  | "settings:plan_change"
  | "settings:apikey_generated"
  | "settings:apikey_deleted"
  | "settings:db_connected"
  | "settings:db_disconnected"
  | "settings:webhook_created"
  | "settings:webhook_deleted"
  | "admin:user_suspended"
  | "admin:user_activated"
  | "admin:flag_toggled"
  | "admin:email_broadcast"
  | "admin:anomaly_config"
  | "billing:checkout_started"
  | "billing:plan_upgraded"
  | "ai:query"
  | "ai:rag_upload"
  | "api:call"
  | "api:key_created"
  | "api:key_revoked"
  | "api:external_query"
  | "telemetry:export";

export interface AuditEntry {
  id: string;
  timestamp: string;    // ISO 8601 UTC
  userId: string;
  userEmail: string;
  action: AuditAction;
  target: string;       // what was affected (user id, org name, flag name, etc.)
  ip: string;
  metadata?: Record<string, string | number | boolean>;
}

// Global in-memory append-only log (exported for db.ts abstraction layer)
// In production: replace with INSERT INTO audit_log (...) VALUES (...)
export const AUDIT_LOG: AuditEntry[] = [];

let _counter = 1;

export function logAction(
  userId: string,
  userEmail: string,
  action: AuditAction,
  target: string,
  ip: string,
  metadata?: Record<string, string | number | boolean>
): AuditEntry {
  const entry: AuditEntry = {
    id: `aud_${Date.now()}_${_counter++}`,
    timestamp: new Date().toISOString(),
    userId,
    userEmail,
    action,
    target,
    ip,
    metadata,
  };

  // Dynamic import avoids circular dependency with db.ts
  import("./db").then(({ db }) => {
    db.writeAuditLog(entry).catch(console.error);
  }).catch(console.error);

  return entry;
}

export function getAuditLog(opts: {
  userId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}): { entries: AuditEntry[]; total: number } {
  let filtered = [...AUDIT_LOG];

  if (opts.userId) {
    filtered = filtered.filter(e => e.userId === opts.userId || e.userEmail.includes(opts.userId!));
  }
  if (opts.action) {
    filtered = filtered.filter(e => e.action.includes(opts.action!));
  }
  if (opts.startDate) {
    filtered = filtered.filter(e => e.timestamp >= opts.startDate!);
  }
  if (opts.endDate) {
    filtered = filtered.filter(e => e.timestamp <= opts.endDate! + "T23:59:59Z");
  }

  // Most recent first
  filtered.reverse();

  const total = filtered.length;
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;

  return {
    entries: filtered.slice(offset, offset + limit),
    total,
  };
}

// Pre-populate with realistic seed data for demo
(function seedAuditLog() {
  const now = Date.now();
  const HOUR = 3600000;

  const seeds: Omit<AuditEntry, "id">[] = [
    { timestamp: new Date(now - 2 * HOUR).toISOString(), userId: "usr_001", userEmail: "rishabh@goatsaas.com", action: "auth:login", target: "session", ip: "103.21.58.12", metadata: { browser: "Chrome 124" } },
    { timestamp: new Date(now - 1.8 * HOUR).toISOString(), userId: "usr_001", userEmail: "rishabh@goatsaas.com", action: "ai:query", target: "groq/llama-3", ip: "103.21.58.12", metadata: { model: "groq", tokens: 420 } },
    { timestamp: new Date(now - 1.5 * HOUR).toISOString(), userId: "usr_002", userEmail: "jane@acmecorp.com", action: "auth:login", target: "session", ip: "52.18.44.201", metadata: { browser: "Safari 17" } },
    { timestamp: new Date(now - 1.2 * HOUR).toISOString(), userId: "usr_admin_001", userEmail: "admin@goatsaas.com", action: "admin:user_suspended", target: "usr_004", ip: "127.0.0.1", metadata: { reason: "payment_failed" } },
    { timestamp: new Date(now - HOUR).toISOString(), userId: "usr_001", userEmail: "rishabh@goatsaas.com", action: "settings:profile_update", target: "usr_001", ip: "103.21.58.12", metadata: { field: "name" } },
    { timestamp: new Date(now - 0.8 * HOUR).toISOString(), userId: "usr_002", userEmail: "jane@acmecorp.com", action: "settings:invite_sent", target: "newmember@acmecorp.com", ip: "52.18.44.201" },
    { timestamp: new Date(now - 0.5 * HOUR).toISOString(), userId: "usr_003", userEmail: "mike@startupxyz.io", action: "billing:checkout_started", target: "pro_plan", ip: "91.108.4.55", metadata: { plan: "pro" } },
    { timestamp: new Date(now - 0.3 * HOUR).toISOString(), userId: "usr_admin_001", userEmail: "admin@goatsaas.com", action: "admin:flag_toggled", target: "ai_analyst:org_startup", ip: "127.0.0.1", metadata: { flag: "ai_analyst", value: false } },
    { timestamp: new Date(now - 0.1 * HOUR).toISOString(), userId: "usr_001", userEmail: "rishabh@goatsaas.com", action: "ai:rag_upload", target: "q3_report.pdf", ip: "103.21.58.12", metadata: { fileSize: 204800, chunks: 42 } },
    { timestamp: new Date(now - 5 * 60000).toISOString(), userId: "usr_002", userEmail: "jane@acmecorp.com", action: "ai:query", target: "gemini/pro", ip: "52.18.44.201", metadata: { model: "gemini", tokens: 1240 } },
  ];

  for (const s of seeds) {
    AUDIT_LOG.push({ id: `aud_seed_${_counter++}`, ...s });
  }
})();
