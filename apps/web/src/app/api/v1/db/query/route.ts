import { NextRequest, NextResponse } from "next/server";
import { withApiAuth, handleOptions, API_CORS_HEADERS } from "@/lib/apimiddleware";
import { runExternalQuery, getConnection } from "@/lib/dbconnector";

export async function OPTIONS() { return handleOptions(); }

/**
 * POST /api/v1/db/query
 * Body: { sql: string }
 * Auth: Bearer gsk_live_...
 * Runs a read-only SQL query against the org's connected external database.
 */
export const POST = withApiAuth(async (req, ctx) => {
  const body = await req.json().catch(() => ({}));
  const { sql } = body as { sql?: string };

  if (!sql?.trim()) {
    return NextResponse.json(
      { error: "sql field is required" },
      { status: 400, headers: API_CORS_HEADERS }
    );
  }

  const conn = getConnection(ctx.orgId);
  if (!conn || conn.status !== "connected") {
    return NextResponse.json(
      {
        error: "No database connected",
        hint: "Connect a Postgres database in Settings → Database Connections first.",
        docs: "https://goatsaas.com/docs#database-connector",
      },
      { status: 400, headers: API_CORS_HEADERS }
    );
  }

  try {
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const result = await runExternalQuery(ctx.orgId, sql, ctx.userId, ip);

    return NextResponse.json(
      {
        object: "db.query_result",
        columns: result.columns,
        rows: result.rows,
        rowCount: result.rowCount,
        durationMs: result.durationMs,
        database: conn.label,
        timestamp: new Date().toISOString(),
      },
      { headers: API_CORS_HEADERS }
    );
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 400, headers: API_CORS_HEADERS }
    );
  }
});
