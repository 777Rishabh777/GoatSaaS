import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("goat-session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload || payload.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await db.getAllUsers();
  return NextResponse.json({ users });
}

export async function PATCH(req: NextRequest) {
  const token = req.cookies.get("goat-session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload || payload.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId, action, plan } = await req.json();

  // Prevent admin from locking themselves out
  if (userId === payload.id && action === "suspend") {
    return NextResponse.json({ error: "Cannot suspend your own account" }, { status: 400 });
  }

  const user = await db.getUserById(userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";

  if (action === "suspend") {
    await db.updateUserStatus(userId, "suspended");
    logAction(payload.id, payload.email, "admin:user_suspended", userId, ip, { targetEmail: user.email });
  }
  if (action === "activate") {
    await db.updateUserStatus(userId, "active");
    logAction(payload.id, payload.email, "admin:user_activated", userId, ip, { targetEmail: user.email });
  }
  if (action === "changePlan" && plan) {
    const prevPlan = user.plan;
    await db.updateUserPlan(userId, plan);
    logAction(payload.id, payload.email, "settings:plan_change", userId, ip, {
      targetEmail: user.email, from: prevPlan, to: plan,
    });
  }

  const updated = await db.getUserById(userId);
  return NextResponse.json({
    success: true,
    user: { id: updated?.id, plan: updated?.plan, status: updated?.status },
  });
}

