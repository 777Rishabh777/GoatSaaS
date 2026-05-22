import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("goat-session")?.value;
  if (!token) return NextResponse.json({ user: null }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ user: null }, { status: 401 });

  const user = await db.getUserById(payload.id);
  if (!user) return NextResponse.json({ user: null }, { status: 401 });

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      plan: user.plan,
      avatar: user.avatar,
      orgId: user.orgId,
      orgName: user.orgName,
      orgRole: user.orgRole,
    },
  });
}

