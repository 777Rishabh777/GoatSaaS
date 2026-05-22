/**
 * GOATSaaS JavaScript/TypeScript SDK
 *
 * Installation:
 *   npm install goatsaas
 *
 * Usage:
 *   import GoatSaaS from 'goatsaas';
 *   const client = new GoatSaaS({ apiKey: 'gsk_live_...' });
 *   const result = await client.query('show top 10 users by revenue');
 */

import type {
  GoatSaaSConfig,
  NLQueryResponse,
  AnomaliesResponse,
  DBQueryResponse,
  TrackEventOptions,
  BatchItem,
} from "./types";

const DEFAULT_BASE_URL = "https://goatsaas.com";
const DEFAULT_TIMEOUT_MS = 30_000;
const BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 1_000;

export class GoatSaaS {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  // Event batching
  private _batch: BatchItem[] = [];
  private _flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: GoatSaaSConfig) {
    if (!config.apiKey) {
      throw new Error("GoatSaaS: apiKey is required. Get one at Settings → API Keys.");
    }
    if (!config.apiKey.startsWith("gsk_live_")) {
      console.warn("GoatSaaS: apiKey should start with gsk_live_. Make sure you're using a real key.");
    }
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  // ─── Core fetch helper ──────────────────────────────────────────────────────

  private async _fetch<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!res.ok) {
        let errDetail = "";
        try {
          const errJson = await res.json();
          errDetail = errJson.error ?? errJson.detail ?? "";
        } catch {
          errDetail = await res.text();
        }
        throw new Error(`GoatSaaS API error ${res.status}: ${errDetail}`);
      }

      return res.json() as Promise<T>;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ─── NL → SQL ──────────────────────────────────────────────────────────────

  /**
   * Translate a natural language question into SQL and optionally execute it
   * against your connected external database.
   *
   * @param query  Plain-English question, e.g. "show top 10 users by revenue"
   * @param model  AI model to use: "groq" | "gemini" | "ollama" (default: "groq")
   *
   * @example
   * const { sql } = await client.query("show revenue by country");
   * console.log(sql); // SELECT country, SUM(amount) FROM orders GROUP BY country
   */
  async query(
    query: string,
    model: "groq" | "gemini" | "ollama" = "groq"
  ): Promise<NLQueryResponse> {
    if (!query?.trim()) throw new Error("GoatSaaS: query cannot be empty");
    return this._fetch<NLQueryResponse>("POST", "/api/v1/nl-query", { query, model });
  }

  // ─── External DB query ────────────────────────────────────────────────────

  /**
   * Run a raw SQL query against your connected external Postgres database.
   * Only read-only (SELECT) queries are permitted.
   *
   * @param sql  SQL query string
   *
   * @example
   * const { rows, columns } = await client.sql("SELECT * FROM users LIMIT 5");
   */
  async sql(sql: string): Promise<DBQueryResponse> {
    if (!sql?.trim()) throw new Error("GoatSaaS: sql cannot be empty");
    return this._fetch<DBQueryResponse>("POST", "/api/v1/db/query", { sql });
  }

  // ─── Anomaly alerts ────────────────────────────────────────────────────────

  /**
   * Retrieve the latest system anomaly alerts for your organization.
   *
   * @example
   * const { anomalies } = await client.alerts();
   * anomalies.forEach(a => console.log(a.message));
   */
  async alerts(): Promise<AnomaliesResponse> {
    return this._fetch<AnomaliesResponse>("GET", "/api/v1/anomalies");
  }

  // ─── Event tracking ────────────────────────────────────────────────────────

  /**
   * Track a custom event. Events are batched and flushed every 1s or 10 events,
   * whichever comes first.
   *
   * @param event       Event name, e.g. "user.signup"
   * @param properties  Optional metadata
   *
   * @example
   * client.track("user.signup", { plan: "pro", country: "US" });
   */
  track(event: string, properties?: Record<string, unknown>): void {
    if (!event?.trim()) throw new Error("GoatSaaS: event name cannot be empty");

    this._batch.push({
      event,
      properties,
      timestamp: new Date().toISOString(),
    });

    if (this._batch.length >= BATCH_SIZE) {
      this._flush();
    } else if (!this._flushTimer) {
      this._flushTimer = setTimeout(() => this._flush(), FLUSH_INTERVAL_MS);
    }
  }

  private _flush(): void {
    if (this._flushTimer) {
      clearTimeout(this._flushTimer);
      this._flushTimer = null;
    }
    if (this._batch.length === 0) return;

    const payload = this._batch.splice(0);

    // Fire-and-forget — don't block calling code
    this._fetch("POST", "/api/v1/events/batch", { events: payload }).catch(() => {
      // Silently fail — track() should never throw
    });
  }

  /**
   * Flush all pending track() events immediately. Call this before process exit.
   *
   * @example
   * process.on("beforeExit", () => client.flush());
   */
  flush(): void {
    this._flush();
  }
}

export default GoatSaaS;
export type {
  GoatSaaSConfig,
  NLQueryResponse,
  AnomaliesResponse,
  DBQueryResponse,
  TrackEventOptions,
  BatchItem,
};
