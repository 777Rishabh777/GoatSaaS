import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { generateApiKey, getOrgKeys, revokeApiKey } from "@/lib/apikeys";
import { logAction } from "@/lib/audit";
import { fireWebhook } from "@/lib/webhooks";
import { handleOptions, API_CORS_HEADERS } from "@/lib/apimiddleware";

// Preflight
export async function OPTIONS() { return handleOptions(); }

export async function GET(req: NextRequest) {
  const token = req.cookies.get("goat-session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const keys = await getOrgKeys(payload.orgId ?? payload.id);
  return NextResponse.json({ keys }, { headers: API_CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get("goat-session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Key name is required" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const orgId = payload.orgId ?? payload.id;

  const { rawKey, record } = await generateApiKey({
    userId: payload.id,
    orgId,
    name: name.trim(),
    plan: payload.plan as any,
  });

  logAction(payload.id, payload.email, "api:key_created", record.id, ip, { name: record.name });
  await fireWebhook(orgId, "api.key_created", { keyId: record.id, name: record.name });

  const { keyHash: _h, ...safeRecord } = record;

  return NextResponse.json({
    success: true,
    // rawKey shown ONCE — not stored, not retrievable again
    rawKey,
    record: safeRecord,
    warning: "Store this key securely. It will never be shown again.",
  }, { headers: API_CORS_HEADERS });
}

export async function DELETE(req: NextRequest) {
  const token = req.cookies.get("goat-session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { keyId } = await req.json();
  const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const orgId = payload.orgId ?? payload.id;

  const ok = await revokeApiKey(keyId, orgId);
  if (!ok) return NextResponse.json({ error: "Key not found" }, { status: 404 });

  logAction(payload.id, payload.email, "api:key_revoked", keyId, ip);
  return NextResponse.json({ success: true }, { headers: API_CORS_HEADERS });
}
