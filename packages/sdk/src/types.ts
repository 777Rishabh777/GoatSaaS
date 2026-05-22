// GOATSaaS SDK — TypeScript Types

export interface GoatSaaSConfig {
  /** Your API key from Settings → API Keys (starts with gsk_live_) */
  apiKey: string;
  /** Base URL of your GOATSaaS instance. Defaults to https://goatsaas.com */
  baseUrl?: string;
  /** Request timeout in milliseconds. Default: 30_000 */
  timeoutMs?: number;
}

export interface NLQueryResponse {
  object: "nl_query.result";
  sql: string;
  query: string;
  model: string;
  org_id: string;
  plan: string;
  timestamp: string;
}

export interface AnomaliesResponse {
  anomalies: AnomalyRecord[];
  org_id: string;
}

export interface AnomalyRecord {
  id: number;
  latency_ms: number;
  threshold_z: number;
  z_score: number;
  message: string;
  timestamp: string;
  resolved: boolean;
}

export interface DBQueryResponse {
  object: "db.query_result";
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
  database: string;
  timestamp: string;
}

export interface TrackEventOptions {
  /** Custom event name, e.g. "user.signup" or "payment.completed" */
  event: string;
  /** Arbitrary metadata to include with the event */
  properties?: Record<string, unknown>;
}

export interface BatchItem {
  event: string;
  properties?: Record<string, unknown>;
  timestamp: string;
}
