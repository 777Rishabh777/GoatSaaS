/**
 * API authentication middleware.
 * Wraps Next.js route handlers to require a valid Bearer API key.
 * Usage: export const POST = withApiAuth(async (req, ctx) => { ... });
 */

import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken, validateApiKey, ApiKey } from "./apikeys";
import { incrementQuota } from "./quota";
import { logAction } from "./audit";

export interface ApiAuthContext {
  keyRecord: ApiKey;
  orgId: string;
  userId: string;
  plan: "free" | "pro" | "enterprise";
}

type ApiHandler = (
  req: NextRequest,
  ctx: ApiAuthContext
) => Promise<NextResponse> | NextResponse;

/**
 * Higher-order function: wraps a route handler with API key authentication.
 */
export function withApiAuth(handler: ApiHandler) {
  return async function (req: NextRequest): Promise<NextResponse> {
    const authHeader = req.headers.get("Authorization");
    const rawKey = extractBearerToken(authHeader);

    if (!rawKey) {
      return NextResponse.json(
        {
          error: "Missing API key",
          hint: "Pass your key in the Authorization header: 'Bearer gsk_live_...'",
          docs: "https://goatsaas.com/docs#authentication",
        },
        {
          status: 401,
          headers: {
            "WWW-Authenticate": 'Bearer realm="GOATSaaS API"',
            "X-Error-Code": "MISSING_API_KEY",
          },
        }
      );
    }

    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const validation = await validateApiKey(rawKey, ip);

    if (!validation.valid || !validation.keyRecord) {
      const status = validation.error?.includes("Rate limit") ? 429 : 401;
      const headers: Record<string, string> = { "X-Error-Code": "INVALID_API_KEY" };
      if (status === 429) {
        const match = validation.error?.match(/(\d+)s/);
        headers["Retry-After"] = match?.[1] ?? "60";
        headers["X-RateLimit-Reset"] = String(Date.now() + 60000);
      }
      return NextResponse.json(
        { error: validation.error, docs: "https://goatsaas.com/docs#authentication" },
        { status, headers }
      );
    }

    const { keyRecord } = validation;

    // Increment quota tracker
    incrementQuota(keyRecord.orgId);

    // Log to audit trail (non-blocking)
    logAction(
      keyRecord.userId,
      `api_key:${keyRecord.keyPrefix}`,
      "api:call",
      req.nextUrl.pathname,
      ip,
      { method: req.method, plan: keyRecord.plan }
    );

    const ctx: ApiAuthContext = {
      keyRecord,
      orgId: keyRecord.orgId,
      userId: keyRecord.userId,
      plan: keyRecord.plan,
    };

    try {
      const response = await handler(req, ctx);
      
      // Inject standard API response headers
      response.headers.set("X-RateLimit-Plan", keyRecord.plan);
      response.headers.set("X-API-Version", "v1");
      response.headers.set("X-Request-Id", `req_${Date.now()}`);
      
      return response;
    } catch (err) {
      console.error("[API Auth] Handler error:", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}

/**
 * CORS headers for public API routes.
 */
export const API_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Org-Id",
  "Access-Control-Max-Age": "86400",
};

export function withCors(response: NextResponse): NextResponse {
  Object.entries(API_CORS_HEADERS).forEach(([k, v]) => response.headers.set(k, v));
  return response;
}

/** Handle preflight OPTIONS requests */
export function handleOptions(): NextResponse {
  return new NextResponse(null, { status: 204, headers: API_CORS_HEADERS });
}
