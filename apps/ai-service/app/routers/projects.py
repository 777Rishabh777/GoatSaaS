from fastapi import APIRouter, HTTPException
import asyncpg
import os
from dotenv import load_dotenv
from app.agents.project_manager import analyze_project_efficiency

load_dotenv()

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])

@router.get("/{project_id}/ai-analysis")
async def ai_analyze_project(project_id: str):
    """
    Triggers the Hidden AI Agent to analyze a project's cost and connection efficiency.
    """
    if not os.getenv("DATABASE_URL", "").strip('"' + "'"):
        raise HTTPException(status_code=500, detail="DATABASE_URL not configured.")

    try:
        conn = await asyncpg.connect(NeuralRoutingConfig.DATABASE_URL)
        
        # Fetch Project Details
        project = await conn.fetchrow("SELECT * FROM projects WHERE id = $1", project_id)
        if not project:
            await conn.close()
            raise HTTPException(status_code=404, detail="Project not found")

        # Fetch API Keys linked to this project
        api_keys = await conn.fetch("SELECT * FROM api_keys WHERE project_id = $1", project_id)
        api_keys_data = [dict(k) for k in api_keys]
        # Make serializable (dates)
        for k in api_keys_data:
            for field in ['last_used_at', 'revoked_at', 'created_at']:
                if k.get(field): k[field] = str(k[field])

        # Fetch SaaS Subscriptions linked to this project
        subs = await conn.fetch("SELECT * FROM saas_subscriptions WHERE project_id = $1", project_id)
        subs_data = [dict(s) for s in subs]
        for s in subs_data:
            for field in ['renewal_date', 'created_at', 'updated_at']:
                if s.get(field): s[field] = str(s[field])

        await conn.close()

        # Run the AI Agent
        analysis = analyze_project_efficiency(
            project_name=project["name"],
            budget=float(project["budget"]) if project["budget"] else 0.0,
            api_keys=api_keys_data,
            subscriptions=subs_data
        )

        return {"success": True, "analysis": analysis}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
