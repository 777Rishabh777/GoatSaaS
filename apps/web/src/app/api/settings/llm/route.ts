import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { handleOptions, API_CORS_HEADERS } from "@/lib/apimiddleware";

// Preflight
export async function OPTIONS() { return handleOptions(); }

export async function GET(req: NextRequest) {
  const token = req.cookies.get("goat-session")?.value;
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const keys = await db.getUserLlmKeys(payload.id);
  
  const mappedKeys = keys.map(k => {
    let maskedKey = "****";
    if (k.apiKey && k.apiKey.length > 8) {
      maskedKey = k.apiKey.slice(0, 4) + "*".repeat(k.apiKey.length - 8) + k.apiKey.slice(-4);
    }
    return {
      provider: k.provider,
      maskedKey
    };
  });

  return NextResponse.json({ keys: mappedKeys }, { headers: API_CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get("goat-session")?.value;
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { provider, apiKey } = await req.json();

  if (!provider || !apiKey) {
    return NextResponse.json({ error: "Provider and API Key are required." }, { status: 400 });
  }

  await db.upsertUserLlmKey(payload.id, provider, apiKey);

  return NextResponse.json({ success: true }, { headers: API_CORS_HEADERS });
}

export async function DELETE(req: NextRequest) {
  const token = req.cookies.get("goat-session")?.value;
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { provider } = await req.json();
  if (!provider) {
    return NextResponse.json({ error: "Provider is required." }, { status: 400 });
  }

  await db.deleteUserLlmKey(payload.id, provider);

  return NextResponse.json({ success: true }, { headers: API_CORS_HEADERS });
}
