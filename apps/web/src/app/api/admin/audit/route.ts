import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { db } from "@/lib/db";

function requireAdmin(req: NextRequest) {
  const token = req.cookies.get("goat-session")?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload || payload.role !== "admin") return null;
  return payload;
}

// GET /api/admin/audit?userId=&action=&startDate=&endDate=&limit=&offset=
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);

  const result = await db.getAuditLogs({
    userId:    searchParams.get("userId") ?? undefined,
    action:    searchParams.get("action") ?? undefined,
    startDate: searchParams.get("startDate") ?? undefined,
    endDate:   searchParams.get("endDate") ?? undefined,
    limit:     parseInt(searchParams.get("limit") ?? "50", 10),
    offset:    parseInt(searchParams.get("offset") ?? "0", 10),
  });

  return NextResponse.json(result);
}
