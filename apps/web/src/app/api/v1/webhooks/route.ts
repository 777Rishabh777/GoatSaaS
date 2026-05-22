import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import {
  registerWebhook, getOrgWebhooks, deleteWebhook,
  testWebhook, getDeliveryLog, SUPPORTED_EVENTS,
} from "@/lib/webhooks";
import { logAction } from "@/lib/audit";
import { handleOptions, API_CORS_HEADERS } from "@/lib/apimiddleware";

export async function OPTIONS() { return handleOptions(); }

/** GET /api/v1/webhooks — list webhooks + delivery log */
export async function GET(req: NextRequest) {
  const token = req.cookies.get("goat-session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = payload.orgId ?? payload.id;
  const webhooks = await getOrgWebhooks(orgId);
  const deliveryLog = getDeliveryLog(orgId, 30);

  return NextResponse.json({
    webhooks,
    deliveryLog,
    supportedEvents: SUPPORTED_EVENTS,
  }, { headers: API_CORS_HEADERS });
}

/** POST /api/v1/webhooks — register a new webhook */
export async function POST(req: NextRequest) {
  const token = req.cookies.get("goat-session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { url, events, label } = await req.json();
  const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const orgId = payload.orgId ?? payload.id;

  if (!url || !url.startsWith("http")) {
    return NextResponse.json({ error: "A valid https:// URL is required" }, { status: 400 });
  }
  if (!events || !Array.isArray(events) || events.length === 0) {
    return NextResponse.json({
      error: "events array required",
      available: SUPPORTED_EVENTS,
    }, { status: 400 });
  }

  const { webhook, rawSecret } = await registerWebhook({
    orgId, url, events, label: label ?? url,
  });

  logAction(payload.id, payload.email, "settings:webhook_created", webhook.id, ip, { url, events: events.join(",") });

  return NextResponse.json({
    success: true,
    webhook,
    // Secret shown ONCE — store it now to verify webhook signatures
    signingSecret: rawSecret,
    warning: "Store this signing secret securely. It will never be shown again.",
    verificationExample: `const valid = crypto.createHmac('sha256', signingSecret).update(rawBody).digest('hex') === signature.slice(7);`,
  }, { headers: API_CORS_HEADERS });
}

/** DELETE /api/v1/webhooks — remove a webhook */
export async function DELETE(req: NextRequest) {
  const token = req.cookies.get("goat-session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { webhookId } = await req.json();
  const orgId = payload.orgId ?? payload.id;
  const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";

  const ok = await deleteWebhook(webhookId, orgId);
  if (!ok) return NextResponse.json({ error: "Webhook not found" }, { status: 404 });

  logAction(payload.id, payload.email, "settings:webhook_deleted", webhookId, ip);
  return NextResponse.json({ success: true }, { headers: API_CORS_HEADERS });
}

/** POST /api/v1/webhooks/test — fire a test payload synchronously */
export async function PATCH(req: NextRequest) {
  const token = req.cookies.get("goat-session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { webhookId } = await req.json();
  const orgId = payload.orgId ?? payload.id;

  try {
    const delivery = await testWebhook(webhookId, orgId);
    return NextResponse.json({ success: delivery.status === "success", delivery }, { headers: API_CORS_HEADERS });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400, headers: API_CORS_HEADERS });
  }
}
