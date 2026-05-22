/**
 * Webhook delivery system for GOATSaaS.
 * Sends HMAC-SHA256 signed HTTP POST to customer URLs when events fire.
 * Events: anomaly.detected, quota.exceeded, user.created, plan.changed
 */

import crypto from "crypto";
import { logAction } from "./audit";

// ─── Types ────────────────────────────────────────────────────────────────────

export type WebhookEvent =
  | "anomaly.detected"
  | "quota.exceeded"
  | "user.created"
  | "plan.changed"
  | "api.key_created"
  | "test.ping";

export interface WebhookConfig {
  id: string;
  orgId: string;
  url: string;
  secret: string;           // HMAC signing secret — shown once at creation
  events: WebhookEvent[];
  label: string;
  createdAt: string;
  lastFiredAt: string | null;
  lastStatus: number | null;
  consecutiveFailures: number;
  status: "active" | "failing" | "disabled";
}

export interface WebhookDelivery {
  webhookId: string;
  event: WebhookEvent;
  payload: unknown;
  status: "success" | "failed";
  httpStatus: number | null;
  durationMs: number;
  timestamp: string;
  error?: string;
}

// ─── In-memory store ──────────────────────────────────────────────────────────

export const WEBHOOKS_DB: WebhookConfig[] = [];
const DELIVERY_LOG: WebhookDelivery[] = [];  // Last 200 entries

// ─── Signature helper ─────────────────────────────────────────────────────────

export function signPayload(secret: string, payload: string): string {
  return "sha256=" + crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifySignature(secret: string, payload: string, header: string): boolean {
  const expected = signPayload(secret, payload);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(header));
  } catch {
    return false;
  }
}

// ─── Delivery engine ──────────────────────────────────────────────────────────

async function deliver(
  wh: WebhookConfig,
  event: WebhookEvent,
  payload: unknown,
  attempt = 1
): Promise<WebhookDelivery> {
  const body = JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    organization: wh.orgId,
    data: payload,
  });

  const signature = signPayload(wh.secret, body);
  const start = Date.now();

  const delivery: WebhookDelivery = {
    webhookId: wh.id,
    event,
    payload,
    status: "failed",
    httpStatus: null,
    durationMs: 0,
    timestamp: new Date().toISOString(),
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(wh.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GOATSaaS-Signature": signature,
        "X-GOATSaaS-Event": event,
        "X-GOATSaaS-Delivery": `dlv_${Date.now()}`,
        "User-Agent": "GOATSaaS-Webhooks/1.0",
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    delivery.durationMs = Date.now() - start;
    delivery.httpStatus = res.status;

    if (res.ok) {
      delivery.status = "success";
      wh.lastFiredAt = new Date().toISOString();
      wh.lastStatus = res.status;
      wh.consecutiveFailures = 0;
      wh.status = "active";
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err: unknown) {
    delivery.durationMs = Date.now() - start;
    delivery.error = err instanceof Error ? err.message : String(err);
    delivery.status = "failed";
    wh.consecutiveFailures++;
    wh.lastStatus = delivery.httpStatus;

    // Retry up to 3 times with exponential backoff
    if (attempt < 3) {
      const backoffMs = attempt * 2000; // 2s, 4s
      await new Promise(r => setTimeout(r, backoffMs));
      return deliver(wh, event, payload, attempt + 1);
    }

    if (wh.consecutiveFailures >= 5) {
      wh.status = "failing";
    }
  }

  // Keep last 200 deliveries
  DELIVERY_LOG.unshift(delivery);
  if (DELIVERY_LOG.length > 200) DELIVERY_LOG.pop();

  return delivery;
}

// ─── Public API ───────────────────────────────────────────────────────────────

import { db } from "./db";

/**
 * Fire an event to all subscribed webhooks for an org.
 * Non-blocking — fires and forgets in background.
 */
export async function fireWebhook(orgId: string, event: WebhookEvent, payload: unknown): Promise<void> {
  const hooks = await db.getOrgWebhooksDb(orgId);
  const activeHooks = hooks.filter(
    wh => wh.status !== "disabled" && wh.events.includes(event)
  );

  if (activeHooks.length === 0) return;

  // Fire all in parallel, non-blocking
  Promise.allSettled(activeHooks.map(wh => deliver(wh, event, payload)));
}

/**
 * Fire a test ping to a specific webhook synchronously (for UI feedback).
 */
export async function testWebhook(webhookId: string, orgId: string): Promise<WebhookDelivery> {
  const wh = await db.getWebhookById(webhookId);
  if (!wh || wh.orgId !== orgId) throw new Error("Webhook not found");

  return deliver(wh, "test.ping", {
    message: "This is a test webhook from GOATSaaS. Your endpoint is working correctly!",
    timestamp: new Date().toISOString(),
  });
}

export async function registerWebhook(opts: {
  orgId: string;
  url: string;
  events: WebhookEvent[];
  label: string;
}): Promise<{ webhook: Omit<WebhookConfig, "secret">; rawSecret: string }> {
  const rawSecret = `whsec_${crypto.randomBytes(20).toString("hex")}`;

  const webhook: WebhookConfig = {
    id: `wh_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
    orgId: opts.orgId,
    url: opts.url,
    secret: rawSecret,
    events: opts.events,
    label: opts.label,
    createdAt: new Date().toISOString(),
    lastFiredAt: null,
    lastStatus: null,
    consecutiveFailures: 0,
    status: "active",
  };

  await db.createWebhook(webhook);

  const { secret: _s, ...safeWebhook } = webhook;
  return { webhook: safeWebhook, rawSecret };
}

export async function getOrgWebhooks(orgId: string): Promise<Omit<WebhookConfig, "secret">[]> {
  const hooks = await db.getOrgWebhooksDb(orgId);
  return hooks.map(({ secret: _s, ...rest }) => rest);
}

export async function deleteWebhook(id: string, orgId: string): Promise<boolean> {
  return db.deleteWebhookById(id, orgId);
}

export function getDeliveryLog(orgId: string, limit = 50): WebhookDelivery[] {
  const orgHookIds = new Set(WEBHOOKS_DB.filter(w => w.orgId === orgId).map(w => w.id));
  return DELIVERY_LOG
    .filter(d => orgHookIds.has(d.webhookId))
    .slice(0, limit);
}

export const SUPPORTED_EVENTS: WebhookEvent[] = [
  "anomaly.detected",
  "quota.exceeded",
  "user.created",
  "plan.changed",
  "api.key_created",
  "test.ping",
];
