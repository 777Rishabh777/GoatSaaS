import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/apimiddleware";
import { db } from "@/lib/db";

async function generateWithGemini(apiKey: string, prompt: string) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "text/plain" }
    })
  });
  if (!res.ok) throw new Error("Failed to generate with Gemini");
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
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
      system: "You are a database expert. You must output only raw SQL code. No markdown, no explanations.",
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!res.ok) throw new Error("Failed to generate with Claude");
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

export const POST = withApiAuth(async (req, ctx) => {
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

    const { natural_query, database_schema_context } = await req.json();

    const prompt = `
Generate a PostgreSQL query based on the following natural language request:
"${natural_query}"

Use this database schema context:
${database_schema_context}

Output ONLY the raw SQL query. Do not include markdown formatting like \`\`\`sql. No explanations.
`;

    let sql = "";
    if (provider === "gemini") {
      sql = await generateWithGemini(apiKey, prompt);
    } else if (provider === "claude") {
      sql = await generateWithClaude(apiKey, prompt);
    } else {
      throw new Error("Unknown provider");
    }

    // Clean up any accidental markdown
    sql = sql.replace(/```sql\n?/gi, "").replace(/```\n?/g, "").trim();

    return NextResponse.json({ success: true, sql });
  } catch (error: any) {
    console.error("NL->SQL Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
