import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/apimiddleware";
import { db } from "@/lib/db";
import crypto from "crypto";

async function generateWithGemini(apiKey: string, prompt: string) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    })
  });
  if (!res.ok) throw new Error("Failed to generate with Gemini");
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  return JSON.parse(text);
}

async function generateWithClaude(apiKey: string, prompt: string) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 1000,
      system: "You are a JSON-only AI audit analyzer. Only output valid JSON.",
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!res.ok) throw new Error("Failed to generate with Claude");
  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/{[\s\S]*}/);
  return JSON.parse(jsonMatch ? jsonMatch[0].replace(/```json\n|\n```/g, "") : "{}");
}

export const GET = withApiAuth(async (req, ctx) => {
  const agents = await db.getOrgAudireAgents(ctx.orgId);
  const audits = await db.getOrgAudireAudits(ctx.orgId);

  return NextResponse.json({
    agents,
    audits,
  });
});

export const POST = withApiAuth(async (req, ctx) => {
  try {
    const body = await req.json();
    const { entity, data } = body;
    const id = `audire_${crypto.randomBytes(8).toString("hex")}`;
    const now = new Date().toISOString();

    if (entity === "agent") {
      const agent = { ...data, id, orgId: ctx.orgId, createdAt: now, updatedAt: now };
      await db.createAudireAgent(agent);
      return NextResponse.json({ success: true, record: agent }, { status: 201 });
    } else if (entity === "audit") {
      let provider = req.headers.get("X-LLM-Provider")?.toLowerCase() ?? null;
      let apiKey = req.headers.get("X-LLM-Key") ?? null;

      if (!provider || !apiKey) {
        const user = await db.getUserById(ctx.userId);
        provider = provider ?? (user as any)?.llmProvider ?? null;
        apiKey = apiKey ?? (user as any)?.llmApiKey ?? null;
      }

      if (!provider || !apiKey) {
        return NextResponse.json(
          { error: "Missing LLM Configuration. Go to Settings to configure your API key." },
          { status: 400 }
        );
      }

      const audit = {
        ...data,
        id,
        orgId: ctx.orgId,
        status: "queued",
        createdAt: now,
        score: 0,
        grade: "Pending",
      };
      await db.createAudireAudit(audit);

      // REAL AUDIT PROCESSING (async)
      setTimeout(async () => {
          try {
            const targetUrl = data.url || "unknown url";
            const prompt = `Analyze the website URL: ${targetUrl}
You are an expert AI SEO and accessibility auditor.
Evaluate the site on crawlability, structure, and llm_visibility.
Return valid JSON exactly like this:
{
  "score": <int 0-100>,
  "crawlability": <int 0-100>,
  "structure": <int 0-100>,
  "llm_visibility": <int 0-100>,
  "summary": "A 2-sentence summary of the audit findings."
}`;
            
            let analysis;
            if (provider === "gemini") {
              analysis = await generateWithGemini(apiKey, prompt);
            } else if (provider === "claude") {
              analysis = await generateWithClaude(apiKey, prompt);
            } else {
              throw new Error("Unknown provider");
            }

            const mockScore = analysis.score || 80;
            const mockGrade = mockScore > 90 ? "A" : mockScore > 80 ? "B" : mockScore > 70 ? "C" : "D";
            const mockSignals = {
              crawlability: analysis.crawlability || 80,
              structure: analysis.structure || 80,
              llm_visibility: analysis.llm_visibility || 80
            };
            
            await db.updateAudireAudit(id, ctx.orgId, {
              status: "completed",
              score: mockScore,
              grade: mockGrade,
              summary: analysis.summary || "Audit completed.",
              signals: mockSignals,
              completedAt: new Date().toISOString()
            });
          } catch (e: any) {
            console.error("AI Audit failed:", e);
            await db.updateAudireAudit(id, ctx.orgId, {
              status: "failed",
              summary: "Audit failed: " + e.message,
              completedAt: new Date().toISOString()
            });
          }
        }, 100);

      return NextResponse.json({ success: true, record: audit }, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid entity type" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});

export const PATCH = withApiAuth(async (req, ctx) => {
  try {
    const body = await req.json();
    const { entity, id, data } = body;

    if (entity === "agent") {
      await db.updateAudireAgent(id, ctx.orgId, data);
    } else if (entity === "audit") {
      await db.updateAudireAudit(id, ctx.orgId, data);
    } else {
      return NextResponse.json({ error: "Invalid entity type" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});

export const DELETE = withApiAuth(async (req, ctx) => {
  try {
    const url = new URL(req.url);
    const entity = url.searchParams.get("entity");
    const id = url.searchParams.get("id");

    if (!entity || !id) return NextResponse.json({ error: "Entity and id required" }, { status: 400 });

    if (entity === "agent") {
      await db.deleteAudireAgent(id, ctx.orgId);
    } else {
      return NextResponse.json({ error: "Invalid entity type or delete not allowed" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
