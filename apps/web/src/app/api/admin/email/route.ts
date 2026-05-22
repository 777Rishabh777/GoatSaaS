import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendBroadcastEmail, getEmailHistory } from "@/lib/email";
import { logAction } from "@/lib/audit";

function requireAdmin(req: NextRequest) {
  const token = req.cookies.get("goat-session")?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload || payload.role !== "admin") return null;
  return payload;
}

// GET /api/admin/email — get email send history
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ history: getEmailHistory() });
}

// POST /api/admin/email — send a broadcast email
export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { subject, body, segment } = await req.json();

  if (!subject?.trim() || !body?.trim() || !segment) {
    return NextResponse.json({ error: "subject, body, and segment are required" }, { status: 400 });
  }

  // Get recipient emails for the segment
  const allUsers = await db.getAllUsers();
  const segmentMap: Record<string, string[]> = {
    all:        allUsers.filter(u => u.status !== "suspended").map(u => u.email),
    free:       allUsers.filter(u => u.plan === "free" && u.status !== "suspended").map(u => u.email),
    pro:        allUsers.filter(u => u.plan === "pro" && u.status !== "suspended").map(u => u.email),
    enterprise: allUsers.filter(u => u.plan === "enterprise" && u.status !== "suspended").map(u => u.email),
  };

  const recipients = segmentMap[segment] ?? [];
  if (recipients.length === 0) {
    return NextResponse.json({ error: "No recipients found for this segment" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";

  const result = await sendBroadcastEmail({
    subject,
    body,
    segment: segment as "all" | "free" | "pro" | "enterprise",
    sentBy: admin.email,
    recipientEmails: recipients,
  });

  logAction(admin.id, admin.email, "admin:email_broadcast", segment, ip, {
    subject,
    recipientCount: recipients.length,
    recordId: result.recordId,
  });

  return NextResponse.json({
    success: result.success,
    recipientCount: recipients.length,
    recordId: result.recordId,
    error: result.error,
  });
}
