import { NextRequest, NextResponse } from "next/server";
import { withApiAuth, handleOptions, API_CORS_HEADERS } from "@/lib/apimiddleware";

export async function OPTIONS() { return handleOptions(); }

/**
 * POST /api/v1/nl-query
 * Body: { query: string, model?: "groq" | "gemini" | "ollama", stream?: boolean }
 * Auth: Bearer gsk_live_...
 *
 * Forwards to the Python AI service and returns streaming SSE or JSON.
 */
export const POST = withApiAuth(async (req, ctx) => {
  const body = await req.json().catch(() => ({}));
  const { query, model = "groq", stream = false } = body as {
    query?: string;
    model?: string;
    stream?: boolean;
  };

  if (!query?.trim()) {
    return NextResponse.json(
      { error: "query field is required", example: { query: "show top 10 users by revenue" } },
      { status: 400, headers: API_CORS_HEADERS }
    );
  }

  // Plan gating: free plan gets non-streaming only
  const streamingAllowed = ctx.plan !== "free" || !stream;

  const aiServiceUrl = process.env.AI_SERVICE_URL ?? "http://localhost:8000";

  try {
    const aiRes = await fetch(`${aiServiceUrl}/api/v1/ai/natural-sql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Org-Id": ctx.orgId,
      },
      body: JSON.stringify({
        natural_query: query,
        database_schema_context:
          "users(id, email, plan, created_at), orders(id, user_id, amount, status, created_at), events(id, user_id, name, properties, timestamp)",
        model: model === "groq" ? "groq" : model,
      }),
    });

    if (!aiRes.ok) {
      return NextResponse.json(
        { error: "AI service error", detail: `Status ${aiRes.status}` },
        { status: 502, headers: API_CORS_HEADERS }
      );
    }

    if (stream && streamingAllowed && aiRes.headers.get("content-type")?.includes("text/event-stream")) {
      // Pass through SSE stream
      return new NextResponse(aiRes.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          ...API_CORS_HEADERS,
        },
      });
    }

    // Buffer the stream and return JSON for non-streaming clients
    const text = await aiRes.text();
    // Extract content from SSE chunks
    const sql = text
      .split("\n")
      .filter(l => l.startsWith("data:"))
      .map(l => {
        try {
          const d = JSON.parse(l.slice(5).trim());
          return d?.choices?.[0]?.delta?.content ?? "";
        } catch {
          return "";
        }
      })
      .join("")
      .replace(/^\[Inference Model:.*?\]\n\n/, "")
      .trim();

    return NextResponse.json(
      {
        object: "nl_query.result",
        sql,
        query,
        model,
        org_id: ctx.orgId,
        plan: ctx.plan,
        timestamp: new Date().toISOString(),
      },
      { headers: API_CORS_HEADERS }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to reach AI service", detail: String(err) },
      { status: 502, headers: API_CORS_HEADERS }
    );
  }
});
