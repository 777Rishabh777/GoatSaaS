import os
import json
import httpx

def analyze_project_efficiency(project_name: str, budget: float, api_keys: list, subscriptions: list):
    """
    AI Agent that analyzes a project's connected APIs and SaaS subscriptions to provide cost-saving insights.
    """
    prompt = f"""
You are the GOATSaaS Hidden AI Cost Manager.
Analyze the following project connections and subscriptions to determine if the user is wasting money or if they have unused connections.

Project: {project_name}
Budget: ${budget or 'Not Set'}

API Keys:
{json.dumps(api_keys, indent=2)}

SaaS Subscriptions:
{json.dumps(subscriptions, indent=2)}

Provide your response in valid JSON matching this schema:
{{
  "health_score": <int 0-100>,
  "total_monthly_cost": <float>,
  "cost_saving_recommendations": [
     "Suggestion 1", "Suggestion 2"
  ],
  "unused_connections": [
     "API Key or Subscription ID"
  ],
  "roi_analysis": "A short paragraph describing the efficiency of this project."
}}
"""

    api_key = os.getenv("GROQ_API_KEY", "").strip('"' + "'")
    if not api_key or api_key == "MOCK_FREE_GROQ_KEY_UNSET":
        # Fallback mock analysis if no API key
        return {
            "health_score": 85,
            "total_monthly_cost": sum(s.get("amount", 0) for s in subscriptions),
            "cost_saving_recommendations": [
                "Consider downgrading unused APIs.",
                "Consolidate your SaaS tools."
            ],
            "unused_connections": [k.get("name") for k in api_keys if k.get("callsToday") == 0],
            "roi_analysis": "This project is running efficiently, but there are a few unused API keys that could be revoked to tighten security."
        }
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "llama3-8b-8192",
        "messages": [
            {"role": "system", "content": "You are a JSON-only AI cost manager. Only output valid JSON."},
            {"role": "user", "content": prompt}
        ],
        "response_format": {"type": "json_object"}
    }

    try:
        response = httpx.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload, timeout=30.0)
        response.raise_for_status()
        data = response.json()
        content = data["choices"][0]["message"]["content"]
        return json.loads(content)
    except Exception as e:
        print(f"Error calling Groq for project analysis: {e}")
        return {
            "health_score": 50,
            "total_monthly_cost": 0,
            "cost_saving_recommendations": ["AI Analysis failed due to an error."],
            "unused_connections": [],
            "roi_analysis": str(e)
        }
