import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { signToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const user = await db.getUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      logAction(user.id, user.email, "auth:failed_login", "wrong_password", ip);
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (user.status === "suspended") {
      return NextResponse.json({ error: "Account suspended. Contact support." }, { status: 403 });
    }

    // Update last login
    await db.updateUserLogin(user.id);
    logAction(user.id, user.email, "auth:login", "session", ip);

    const token = signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      plan: user.plan,
      avatar: user.avatar,
      orgId: user.orgId,
      orgName: user.orgName,
      orgRole: user.orgRole,
    });

    const response = NextResponse.json({
      success: true,
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

    response.cookies.set("goat-session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("[Login]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

