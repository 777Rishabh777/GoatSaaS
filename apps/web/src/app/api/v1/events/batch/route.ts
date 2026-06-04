import { NextRequest, NextResponse } from "next/server";
import { withApiAuth, handleOptions, API_CORS_HEADERS } from "@/lib/apimiddleware";
import { logAction } from "@/lib/audit";
import db from "@/lib/db";

export async function OPTIONS() { return handleOptions(); }

/**
 * POST /api/v1/events/batch
 * Body: { events: Array<{ event: string; properties?: Record<string, any>; timestamp?: string }> }
 * Auth: Bearer gsk_live_...
 *
 * Receives batched events from the SDK client.track() calls.
 * Events are logged to the audit trail and can be forwarded to analytics.
 */
export const POST = withApiAuth(async (req: NextRequest, ctx) => {
  const body = await req.json().catch(() => ({})) as { events?: any[] };
  const { events } = body;

  if (!Array.isArray(events) || events.length === 0) {
    return NextResponse.json(
      { error: "events array is required and must not be empty" },
      { status: 400, headers: API_CORS_HEADERS }
    );
  }

  if (events.length > 100) {
    return NextResponse.json(
      { error: "Maximum 100 events per batch" },
      { status: 400, headers: API_CORS_HEADERS }
    );
  }

  const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
  let accepted = 0;
  let rejected = 0;

  for (const ev of events) {
    if (!ev?.event || typeof ev.event !== "string") { rejected++; continue; }

    // Log each event to audit trail
    logAction(
      ctx.userId,
      `api_key:${ctx.keyRecord.keyPrefix}`,
      "api:call",
      `event:${ev.event}`,
      ip,
      {
        eventName: ev.event,
        orgId: ctx.orgId,
        plan: ctx.plan,
        timestamp: ev.timestamp ?? new Date().toISOString(),
      }
    );

    // Forward to Telemetry DB if it's a latency event
    if (ev.event === "api:latency" || ev.event === "telemetry:latency") {
      const endpoint = ev.properties?.endpoint ?? "/unknown";
      const latencyMs = typeof ev.properties?.latency_ms === "number" ? ev.properties.latency_ms : 0;
      await db.insertTelemetry(ctx.orgId, endpoint, latencyMs, ctx.userId);
    }

    accepted++;
  }

  return NextResponse.json(
    {
      object: "events.batch_result",
      accepted,
      rejected,
      org_id: ctx.orgId,
      timestamp: new Date().toISOString(),
    },
    { headers: API_CORS_HEADERS }
  );
});
