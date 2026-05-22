/**
 * External database connector.
 * Lets customers connect their own Postgres database to GOATSaaS.
 * Queries run against THEIR data, not our demo DB.
 */

import { logAction } from "./audit";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DbConnection {
  orgId: string;
  uri: string;                  // encrypted ideally — store raw for demo
  label: string;                // "Acme Corp Production DB"
  connectedAt: string;
  lastQueriedAt: string | null;
  tableCount: number;
  tables: string[];
  status: "connected" | "error" | "untested";
  lastError: string | null;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
}

// ─── In-memory store ──────────────────────────────────────────────────────────
// In production: store encrypted URI in Postgres, load per-request

const DB_CONNECTIONS: Map<string, DbConnection> = new Map();

// ─── SQL safety guard ─────────────────────────────────────────────────────────

const DANGEROUS_PATTERNS = [
  /\bDROP\b/i, /\bTRUNCATE\b/i,
  /\bDELETE\b(?!.*\bWHERE\b)/i,   // DELETE without WHERE
  /\bUPDATE\b(?!.*\bWHERE\b)/i,   // UPDATE without WHERE
  /\bALTER\b/i, /\bCREATE\b/i,
  /\bGRANT\b/i, /\bREVOKE\b/i,
  /\bINSERT\b/i,                   // read-only mode for now
];

export function isSqlSafe(sql: string): { safe: boolean; reason?: string } {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(sql)) {
      return { safe: false, reason: `Blocked pattern detected: ${pattern.toString()}` };
    }
  }
  return { safe: true };
}

// ─── URI validation ───────────────────────────────────────────────────────────

export function validateUri(uri: string): { valid: boolean; reason?: string } {
  if (!uri.startsWith("postgresql://") && !uri.startsWith("postgres://")) {
    return { valid: false, reason: "URI must start with postgresql:// or postgres://" };
  }
  try {
    const u = new URL(uri);
    if (!u.hostname) return { valid: false, reason: "Missing host in URI" };
    if (!u.pathname || u.pathname === "/") return { valid: false, reason: "Missing database name in URI" };
    return { valid: true };
  } catch {
    return { valid: false, reason: "URI is not parseable as a URL" };
  }
}

// ─── Connection test (dynamic import of pg) ───────────────────────────────────

export async function testConnection(
  orgId: string,
  uri: string,
  label: string
): Promise<{ success: boolean; tables: string[]; error?: string }> {
  const uriCheck = validateUri(uri);
  if (!uriCheck.valid) return { success: false, tables: [], error: uriCheck.reason };

  try {
    // Dynamically import pg so it doesn't crash if not installed
    const { Client } = await import("pg").catch(() => {
      throw new Error("pg package not installed. Run: npm install pg");
    });

    const client = new Client({ connectionString: uri, connectionTimeoutMillis: 5000 });
    await client.connect();

    const res = await client.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
    );
    const tables = res.rows.map(r => r.tablename);
    await client.end();

    const conn: DbConnection = {
      orgId,
      uri,
      label,
      connectedAt: new Date().toISOString(),
      lastQueriedAt: null,
      tableCount: tables.length,
      tables,
      status: "connected",
      lastError: null,
    };
    DB_CONNECTIONS.set(orgId, conn);

    return { success: true, tables };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const existing = DB_CONNECTIONS.get(orgId);
    if (existing) {
      existing.status = "error";
      existing.lastError = msg;
    }
    return { success: false, tables: [], error: msg };
  }
}

// ─── Run query ────────────────────────────────────────────────────────────────

export async function runExternalQuery(
  orgId: string,
  sql: string,
  userId: string,
  ip: string
): Promise<QueryResult> {
  const conn = DB_CONNECTIONS.get(orgId);
  if (!conn || conn.status !== "connected") {
    throw new Error("No connected database for this organization. Connect one in Settings → Database.");
  }

  const safety = isSqlSafe(sql);
  if (!safety.safe) {
    throw new Error(`Query blocked: ${safety.reason}`);
  }

  const { Client } = await import("pg");
  const client = new Client({ connectionString: conn.uri, connectionTimeoutMillis: 8000 });
  await client.connect();

  const start = Date.now();
  const result = await client.query(sql);
  const durationMs = Date.now() - start;
  await client.end();

  conn.lastQueriedAt = new Date().toISOString();

  // Audit log
  logAction(userId, `org:${orgId}`, "api:external_query", sql.slice(0, 80), ip, { rows: result.rowCount ?? 0, ms: durationMs });

  const columns = result.fields.map(f => f.name);
  const rows = result.rows.map(row => {
    const normalized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      normalized[k] = v instanceof Date ? v.toISOString() : v;
    }
    return normalized;
  });

  return { columns, rows, rowCount: result.rowCount ?? rows.length, durationMs };
}

// ─── Accessors ────────────────────────────────────────────────────────────────

export function getConnection(orgId: string): Omit<DbConnection, "uri"> | null {
  const conn = DB_CONNECTIONS.get(orgId);
  if (!conn) return null;
  // Never expose the URI in API responses
  const { uri: _u, ...safe } = conn;
  return safe;
}

export function removeConnection(orgId: string): boolean {
  return DB_CONNECTIONS.delete(orgId);
}
