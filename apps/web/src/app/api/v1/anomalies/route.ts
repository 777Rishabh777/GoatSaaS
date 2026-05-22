import { NextRequest, NextResponse } from "next/server";
import { withApiAuth, handleOptions, API_CORS_HEADERS } from "@/lib/apimiddleware";

export async function OPTIONS() { return handleOptions(); }

/** GET /api/v1/anomalies — latest anomaly alerts for the org */
export const GET = withApiAuth(async (_req, ctx) => {
  const aiServiceUrl = process.env.AI_SERVICE_URL ?? "http://localhost:8000";

  try {
    const res = await fetch(`${aiServiceUrl}/api/v1/anomalies/alerts`, {
      headers: { "X-Org-Id": ctx.orgId },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "AI service unavailable", anomalies: [] },
        { status: 200, headers: API_CORS_HEADERS }
      );
    }

    const data = await res.json();
    return NextResponse.json({ anomalies: data, org_id: ctx.orgId }, { headers: API_CORS_HEADERS });
  } catch {
    return NextResponse.json(
      { error: "Could not reach anomaly service", anomalies: [] },
      { status: 200, headers: API_CORS_HEADERS }
    );
  }
});
