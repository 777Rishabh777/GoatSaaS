import { NextRequest, NextResponse } from "next/server";
import { withApiAuth, handleOptions, API_CORS_HEADERS } from "@/lib/apimiddleware";

export async function OPTIONS() { return handleOptions(); }

/**
 * GET /api/v1/me
 * Auth: Bearer gsk_live_...
 *
 * Returns information about the API key and organization.
 * Useful for SDK users to verify their key is working.
 */
export const GET = withApiAuth(async (_req: NextRequest, ctx) => {
  return NextResponse.json(
    {
      object: "api_key.info",
      key_id: ctx.keyRecord.id,
      key_name: ctx.keyRecord.name,
      key_prefix: ctx.keyRecord.keyPrefix,
      org_id: ctx.orgId,
      plan: ctx.plan,
      usage: {
        calls_today: ctx.keyRecord.callsToday,
        total_calls: ctx.keyRecord.totalCalls,
        last_used_at: ctx.keyRecord.lastUsedAt,
      },
      timestamp: new Date().toISOString(),
    },
    { headers: API_CORS_HEADERS }
  );
});
