/**
 * API authentication middleware.
 * Wraps Next.js route handlers to require a valid Bearer API key.
 * Usage: export const POST = withApiAuth(async (req, ctx) => { ... });
 */

import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken, validateApiKey, ApiKey } from "./apikeys";
import { incrementQuota } from "./quota";
import { logAction } from "./audit";
import { verifyToken } from "./auth";

export interface ApiAuthContext {
  keyRecord: ApiKey;
  orgId: string;
  userId: string;
  plan: "free" | "pro" | "enterprise";
}

type ApiHandler = (
  req: NextRequest,
  ctx: ApiAuthContext,
  ...args: any[]
) => Promise<NextResponse> | NextResponse;

/**
 * Higher-order function: wraps a route handler with API key authentication.
 */
export function withApiAuth(handler: ApiHandler) {
  return async function (req: NextRequest, ...args: any[]): Promise<NextResponse> {
    const authHeader = req.headers.get("Authorization");
    const rawKey = extractBearerToken(authHeader);

    let keyRecord: ApiKey | null = null;
    let orgId = "";
    let userId = "";
    let plan: "free" | "pro" | "enterprise" = "free";

    if (!rawKey) {
      // Fallback: check for browser session cookie
      const token = req.cookies.get("goat-session")?.value;
      const userPayload = verifyToken(token);
      
      if (userPayload) {
        orgId = userPayload.orgId || "org_goatsaas";
        userId = userPayload.id;
        plan = userPayload.plan || "free";
        keyRecord = {
          id: "session_key",
          orgId,
          userId,
          name: "Session Auth",
          keyHash: "",
          keyPrefix: "session",
          keySuffix: "",
          plan,
          createdAt: new Date().toISOString(),
          lastUsedAt: new Date().toISOString(),
          lastUsedIp: "127.0.0.1",
          revokedAt: null,
          expiresAt: null,
          callsToday: 0,
          totalCalls: 0,
        };
      } else {
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
    } else {
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

      keyRecord = validation.keyRecord;
      orgId = keyRecord.orgId;
      userId = keyRecord.userId;
      plan = keyRecord.plan;

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
    }

    const ctx: ApiAuthContext = {
      keyRecord: keyRecord!,
      orgId,
      userId,
      plan,
    };

    try {
      const response = await handler(req, ctx, ...args);
      
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
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Org-Id, X-LLM-Provider, X-LLM-Key",
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
