import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAllFlags, setFlag, setFlagsForPlan, getAllFlagsAllOrgs, ALL_FLAGS, PLAN_DEFAULTS } from "@/lib/redis";
import { logAction } from "@/lib/audit";

function requireAdmin(req: NextRequest) {
  const token = req.cookies.get("goat-session")?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload || payload.role !== "admin") return null;
  return payload;
}

// GET /api/admin/flags — return all flags for all orgs + plan defaults
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const allUsers = await db.getAllUsers();
  
  // Get unique org IDs from users
  const orgIds = [...new Set(allUsers.map(u => u.orgId).filter(Boolean))] as string[];
  const allFlags = await getAllFlagsAllOrgs(orgIds);

  // Fill in missing flags with plan defaults
  for (const orgId of orgIds) {
    const orgUsers = allUsers.filter(u => u.orgId === orgId);
    const plan = orgUsers[0]?.plan ?? "free";
    const defaults = PLAN_DEFAULTS[plan as keyof typeof PLAN_DEFAULTS];
    for (const flag of ALL_FLAGS) {
      if (allFlags[orgId]?.[flag] === undefined) {
        allFlags[orgId] = allFlags[orgId] ?? {};
        allFlags[orgId][flag] = defaults[flag] ?? false;
      }
    }
  }

  return NextResponse.json({ flags: allFlags, allFlags: ALL_FLAGS, planDefaults: PLAN_DEFAULTS, orgIds });
}

// POST /api/admin/flags — set a specific flag for an org
export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { orgId, flagName, value } = await req.json();
  if (!orgId || !flagName || typeof value !== "boolean") {
    return NextResponse.json({ error: "orgId, flagName, and value (boolean) required" }, { status: 400 });
  }

  await setFlag(orgId, flagName, value);

  const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
  logAction(admin.id, admin.email, "admin:flag_toggled", `${flagName}:${orgId}`, ip, {
    flag: flagName,
    value,
    orgId,
  });

  return NextResponse.json({ success: true });
}

// PATCH /api/admin/flags — reset an org to plan defaults
export async function PATCH(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { orgId, plan } = await req.json();
  if (!orgId || !plan) {
    return NextResponse.json({ error: "orgId and plan required" }, { status: 400 });
  }

  await setFlagsForPlan(orgId, plan as "free" | "pro" | "enterprise");

  const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
  logAction(admin.id, admin.email, "admin:flag_toggled", `reset:${orgId}:${plan}`, ip, { orgId, plan });

  return NextResponse.json({ success: true });
}
