import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getAllQuotaStats, getOrgQuota, PLAN_LIMITS } from "@/lib/quota";
import { db } from "@/lib/db";

function requireAdmin(req: NextRequest) {
  const token = req.cookies.get("goat-session")?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload || payload.role !== "admin") return null;
  return payload;
}

// GET /api/admin/quota?days=7
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") ?? "7", 10);

  const stats = getAllQuotaStats(days);
  const allUsers = await db.getAllUsers();

  // Enrich with org name and plan
  const enriched = stats.summary.map(s => {
    const orgUser = allUsers.find(u => u.orgId === s.orgId);
    const plan = orgUser?.plan ?? "free";
    const limit = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS];
    const pct = Math.min(100, Math.round((s.totalCalls / limit) * 100));
    return {
      ...s,
      orgName: orgUser?.orgName ?? s.orgId,
      plan,
      dailyLimit: limit,
      usagePct: pct,
      overLimit: s.totalCalls >= limit,
    };
  });

  return NextResponse.json({
    summary: enriched,
    byOrg: stats.byOrg,
    planLimits: PLAN_LIMITS,
  });
}
