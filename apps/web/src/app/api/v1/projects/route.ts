import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("goat-session")?.value;
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const projects = await db.getProjectsByOrg(payload.orgId);
    const subscriptions = await db.getOrgSubscriptions(payload.orgId);

    const projectsWithSaas = projects.map(proj => {
      const saas = subscriptions.filter(sub => sub.projectId === proj.id);
      return { ...proj, saas };
    });

    return NextResponse.json({ projects: projectsWithSaas });
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get("goat-session")?.value;
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, description, budget } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const newProject = {
      id: `prj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      orgId: payload.orgId,
      name,
      description: description || null,
      budget: budget || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.createProject(newProject);
    return NextResponse.json({ success: true, project: newProject });
  } catch (error) {
    console.error("Failed to create project:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
