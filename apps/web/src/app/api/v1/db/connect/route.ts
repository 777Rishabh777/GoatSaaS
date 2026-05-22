import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { testConnection, getConnection, removeConnection, validateUri } from "@/lib/dbconnector";
import { logAction } from "@/lib/audit";
import { handleOptions, API_CORS_HEADERS } from "@/lib/apimiddleware";

export async function OPTIONS() { return handleOptions(); }

/** GET /api/v1/db/connect — returns connection status & table list for the org */
export async function GET(req: NextRequest) {
  const token = req.cookies.get("goat-session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = payload.orgId ?? payload.id;
  const conn = getConnection(orgId);

  return NextResponse.json({
    connected: conn?.status === "connected",
    connection: conn,
  }, { headers: API_CORS_HEADERS });
}

/** POST /api/v1/db/connect — connect a new external DB */
export async function POST(req: NextRequest) {
  const token = req.cookies.get("goat-session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { uri, label } = await req.json();
  const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const orgId = payload.orgId ?? payload.id;

  if (!uri) return NextResponse.json({ error: "uri is required" }, { status: 400 });

  // Validate before attempting connection
  const uriCheck = validateUri(uri);
  if (!uriCheck.valid) {
    return NextResponse.json({ error: uriCheck.reason }, { status: 400 });
  }

  const result = await testConnection(orgId, uri, label ?? "External Database");

  if (result.success) {
    logAction(payload.id, payload.email, "settings:db_connected", orgId, ip, {
      label, tables: result.tables.length,
    });
    return NextResponse.json({
      success: true,
      tables: result.tables,
      tableCount: result.tables.length,
      message: `Connected successfully. Found ${result.tables.length} tables.`,
    }, { headers: API_CORS_HEADERS });
  } else {
    return NextResponse.json({
      success: false,
      error: result.error,
      hint: "Check that your connection string is correct and the database allows external connections.",
    }, { status: 400, headers: API_CORS_HEADERS });
  }
}

/** DELETE /api/v1/db/connect — remove the connected database */
export async function DELETE(req: NextRequest) {
  const token = req.cookies.get("goat-session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = payload.orgId ?? payload.id;
  const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";

  removeConnection(orgId);
  logAction(payload.id, payload.email, "settings:db_disconnected", orgId, ip);
  return NextResponse.json({ success: true }, { headers: API_CORS_HEADERS });
}
