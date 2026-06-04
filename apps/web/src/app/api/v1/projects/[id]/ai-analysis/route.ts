import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/apimiddleware";
import { db } from "@/lib/db";

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
      system: "You are a JSON-only AI cost manager. Only output valid JSON.",
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!res.ok) throw new Error("Failed to generate with Claude");
  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  // Extract JSON from markdown block if present
  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/{[\s\S]*}/);
  return JSON.parse(jsonMatch ? jsonMatch[0].replace(/```json\n|\n```/g, "") : "{}");
}

export const GET = withApiAuth(async (req, ctx, params) => {
  try {
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

    const projectId = params?.id;
    if (!projectId) return NextResponse.json({ error: "Project ID missing" }, { status: 400 });

    const orgProjects = await db.getProjectsByOrg(ctx.orgId);
    const project = orgProjects.find((p: any) => p.id === projectId);
    
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const subscriptions = await db.getOrgSubscriptions(ctx.orgId);
    const projectSubs = subscriptions.filter(s => s.projectId === projectId);
    const apiKeys = await db.getOrgApiKeys(ctx.orgId);
    const projectKeys = apiKeys.filter(k => k.projectId === projectId);

    const prompt = `
You are the GOATSaaS Hidden AI Cost Manager.
Analyze the following project connections and subscriptions to determine if the user is wasting money or if they have unused connections.

Project: ${project.name}
Budget: $${project.budget || 'Not Set'}

API Keys:
${JSON.stringify(projectKeys, null, 2)}

SaaS Subscriptions:
${JSON.stringify(projectSubs, null, 2)}

Provide your response in valid JSON matching exactly this schema:
{
  "health_score": <int 0-100>,
  "total_monthly_cost": <float>,
  "cost_saving_recommendations": [
     "Suggestion 1", "Suggestion 2"
  ],
  "unused_connections": [
     "API Key or Subscription ID"
  ],
  "roi_analysis": "A short paragraph describing the efficiency of this project."
}
`;

    let analysis;
    if (provider === "gemini") {
      analysis = await generateWithGemini(apiKey, prompt);
    } else if (provider === "claude") {
      analysis = await generateWithClaude(apiKey, prompt);
    } else {
      throw new Error("Unknown provider");
    }

    // fallback mapping if AI missed fields
    analysis = {
      health_score: analysis.health_score || 85,
      total_monthly_cost: analysis.total_monthly_cost || 0,
      cost_saving_recommendations: analysis.cost_saving_recommendations || [],
      unused_connections: analysis.unused_connections || [],
      roi_analysis: analysis.roi_analysis || "Analysis completed."
    };

    return NextResponse.json({ success: true, analysis });
  } catch (error: any) {
    console.error("AI Analysis Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
