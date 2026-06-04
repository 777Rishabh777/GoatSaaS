import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const provider = req.headers.get("X-LLM-Provider");
    const apiKey = req.headers.get("X-LLM-Key");

    if (!provider || !apiKey) {
      return NextResponse.json({ success: false, error: "Missing provider or API key" }, { status: 400 });
    }

    if (provider === "gemini") {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Respond with exactly the word 'SUCCESS'." }] }]
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return NextResponse.json({ success: false, error: errorData?.error?.message || "Invalid Gemini API Key" }, { status: 401 });
      }

      return NextResponse.json({ success: true });
    } 
    
    if (provider === "claude") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 10,
          messages: [{ role: "user", content: "Respond with exactly the word 'SUCCESS'." }]
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return NextResponse.json({ success: false, error: errorData?.error?.message || "Invalid Anthropic API Key" }, { status: 401 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Unknown provider" }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
