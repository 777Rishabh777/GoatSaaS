import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/lib/apimiddleware";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import crypto from "crypto";

export const runtime = "nodejs";

function decodeBase64Url(data: string) {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function extractTextFromPayload(payload: any): string {
  if (!payload) return "";
  const texts: string[] = [];

  const walk = (part: any) => {
    if (!part) return;

    const mimeType = (part.mimeType || "").toLowerCase();
    const bodyData = part.body?.data;

    if (bodyData && (mimeType === "text/plain" || mimeType === "text/html")) {
      texts.push(decodeBase64Url(bodyData));
    }

    if (Array.isArray(part.parts)) {
      for (const p of part.parts) walk(p);
    }
  };

  walk(payload);
  return texts.join("\n\n").slice(0, 60_000);
}

async function gmailFetch(accessToken: string, url: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || `Gmail API error (${res.status})`);
  return json;
}

async function refreshGoogleAccessToken(refreshToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });

  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error_description || "Failed to refresh access token");

  const accessToken: string | undefined = json.access_token;
  const expiresIn: number | undefined = json.expires_in;
  if (!accessToken) throw new Error("Missing access_token from refresh response");

  const expiresAt = typeof expiresIn === "number" ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
  return { accessToken, expiresAt };
}

async function generateWithGemini(apiKey: string, prompt: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );
  if (!res.ok) throw new Error("Failed to generate with Gemini");
  const data: any = await res.json().catch(() => ({}));
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
  return JSON.parse(text);
}

async function generateWithClaude(apiKey: string, prompt: string) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 1500,
      system: "Extract SaaS subscriptions and return ONLY a valid JSON array. No markdown.",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) throw new Error("Failed to generate with Claude");
  const data: any = await res.json().catch(() => ({}));
  const text = data.content?.[0]?.text || "[]";
  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\[[\s\S]*\]/);
  return JSON.parse(jsonMatch ? jsonMatch[0].replace(/```json\n|\n```/g, "") : "[]");
}

function getRedirectUri(req: NextRequest) {
  // Redirect URI must be EXACTLY registered in Google Cloud Console.
  return `${req.nextUrl.origin}/api/v1/saas/gmail-sync`;
}

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action") || "connect";

  const token = req.cookies.get("goat-session")?.value;
  const payload = verifyToken(token);

  if (!payload) {
    return NextResponse.redirect(new URL("/sign-in", req.nextUrl.origin));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET" }, { status: 500 });
  }

  // Callback mode (Google hits this same URL with ?code=...&state=...)
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  if (code) {
    const stateCookie = req.cookies.get("gmail_oauth_state")?.value;
    if (!state || !stateCookie || state !== stateCookie) {
      return NextResponse.json({ error: "Invalid state" }, { status: 400 });
    }

    const redirectUri = getRedirectUri(req);

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });

    const tokenJson: any = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok) {
      return NextResponse.json({ error: tokenJson?.error_description || "Failed to exchange code" }, { status: 400 });
    }

    const accessToken: string | undefined = tokenJson.access_token;
    const refreshToken: string | undefined = tokenJson.refresh_token;
    const expiresIn: number | undefined = tokenJson.expires_in;

    if (!accessToken) {
      return NextResponse.json({ error: "Missing access_token from Google" }, { status: 400 });
    }

    const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const userinfo: any = await userinfoRes.json().catch(() => ({}));

    // If Google didn't return a refresh token (already authorized), keep the existing one.
    let effectiveRefreshToken = refreshToken;
    const existing = await db.getGmailConnectionByUserId(payload.id);
    if (!effectiveRefreshToken && existing?.refreshToken) {
      effectiveRefreshToken = existing.refreshToken;
    }

    if (!effectiveRefreshToken) {
      return NextResponse.json({ error: "No refresh_token received. Re-connect (prompt=consent)." }, { status: 400 });
    }

    const expiresAt = typeof expiresIn === "number" ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
    const orgId = (payload as any).orgId || "org_goatsaas";

    await db.upsertGmailConnection({
      userId: payload.id,
      orgId,
      email: userinfo?.email || payload.email,
      refreshToken: effectiveRefreshToken,
      accessToken,
      expiresAt,
    });

    const res = NextResponse.redirect(new URL("/dashboard?gmail=connected", req.nextUrl.origin));
    res.cookies.set("gmail_oauth_state", "", { path: "/", maxAge: 0 });
    return res;
  }

  // Connect mode
  if (action !== "connect") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const oauthState = crypto.randomBytes(16).toString("hex");
  const redirectUri = getRedirectUri(req);

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set(
    "scope",
    ["openid", "email", "https://www.googleapis.com/auth/gmail.readonly"].join(" ")
  );
  url.searchParams.set("state", oauthState);

  const res = NextResponse.redirect(url.toString());
  res.cookies.set("gmail_oauth_state", oauthState, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });
  return res;
}

export const POST = withApiAuth(async (req, ctx) => {
  try {
    const action = req.nextUrl.searchParams.get("action") || "scan";
    if (action !== "scan") return NextResponse.json({ error: "Unknown action" }, { status: 400 });

    const body = await req.json().catch(() => ({} as any));
    const maxMessages = Math.min(Math.max(Number(body.maxMessages || 10), 1), 25);

    const conn = await db.getGmailConnectionByUserId(ctx.userId);
    if (!conn) {
      return NextResponse.json({ error: "Gmail not connected", connectUrl: "/api/v1/saas/gmail-sync?action=connect" }, { status: 400 });
    }

    // Ensure access token
    let accessToken = conn.accessToken;
    const expiresAtMs = conn.expiresAt ? Date.parse(conn.expiresAt) : null;
    const isExpired = !expiresAtMs || expiresAtMs - Date.now() < 60_000;

    if (!accessToken || isExpired) {
      const refreshed = await refreshGoogleAccessToken(conn.refreshToken);
      accessToken = refreshed.accessToken;
      await db.updateGmailAccessToken(ctx.userId, refreshed.accessToken, refreshed.expiresAt);
    }

    // Fetch recent likely-receipt emails
    const q = "newer_than:365d (receipt OR invoice OR subscription OR renewal OR billed)";
    const list = await gmailFetch(
      accessToken!,
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxMessages}&q=${encodeURIComponent(q)}`
    );

    const ids: string[] = (list.messages || []).map((m: any) => m.id).filter(Boolean);
    if (ids.length === 0) {
      return NextResponse.json({ success: true, imported: 0, subscriptions: [] });
    }

    const texts: string[] = [];
    for (const id of ids.slice(0, maxMessages)) {
      const msg = await gmailFetch(accessToken!, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`);
      const raw = extractTextFromPayload(msg.payload);
      if (raw) texts.push(raw);
    }

    const rawInboxDump = texts.join("\n\n---\n\n").slice(0, 80_000);

    // LLM config (headers first, DB fallback)
    let provider = req.headers.get("X-LLM-Provider")?.toLowerCase() ?? null;
    let apiKey = req.headers.get("X-LLM-Key") ?? null;

    if (!provider || !apiKey) {
      const user = await db.getUserById(ctx.userId);
      provider = provider ?? (user as any)?.llmProvider ?? null;
      apiKey = apiKey ?? (user as any)?.llmApiKey ?? null;
    }

    if (!provider || !apiKey) {
      return NextResponse.json({ error: "Missing LLM Configuration. Go to Settings to configure your API key." }, { status: 400 });
    }

    const prompt = `You will receive raw email text exported from a Gmail inbox.\n\nExtract ONLY SaaS / developer / software subscriptions. Ignore marketing emails.\n\nReturn a JSON array where each item is:\n{\n  "name": string,\n  "amount": number,\n  "currency": "USD" | string,\n  "billingCycle": "monthly" | "annual" | string,\n  "renewalDate": string,\n  "status": "active" | "cancelled" | "trial" | string,\n  "paymentMethod": string | null\n}\n\nOutput ONLY the JSON array.\n\nRaw Emails:\n${rawInboxDump}`;

    let extracted: any = [];
    if (provider === "gemini") extracted = await generateWithGemini(apiKey, prompt);
    else if (provider === "claude") extracted = await generateWithClaude(apiKey, prompt);
    else return NextResponse.json({ error: "Unknown LLM provider" }, { status: 400 });

    if (!Array.isArray(extracted)) extracted = [];

    const now = new Date().toISOString();
    const created: any[] = [];

    for (const sub of extracted) {
      const record = {
        id: `saas_${crypto.randomBytes(8).toString("hex")}`,
        orgId: ctx.orgId,
        projectId: null,
        vendorId: null,
        name: String(sub?.name || "Unknown").slice(0, 200),
        plan: null,
        amount: Number(sub?.amount) || 0,
        currency: String(sub?.currency || "USD").slice(0, 10),
        billingCycle: String(sub?.billingCycle || "monthly").slice(0, 32),
        renewalDate: sub?.renewalDate ? String(sub.renewalDate) : now,
        seatsTotal: 0,
        seatsUsed: 0,
        departmentId: null,
        status: String(sub?.status || "active").slice(0, 32),
        paymentMethod: sub?.paymentMethod ? String(sub.paymentMethod).slice(0, 120) : null,
        notes: "Imported from Gmail scan",
        createdAt: now,
        updatedAt: now,
      };

      await db.createSubscription(record);
      created.push(record);
    }

    return NextResponse.json({ success: true, imported: created.length, subscriptions: created });
  } catch (error: any) {
    console.error("Gmail scan error:", error);
    return NextResponse.json({ error: error.message || "Scan failed" }, { status: 500 });
  }
});
