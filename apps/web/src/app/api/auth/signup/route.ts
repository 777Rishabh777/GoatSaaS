import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { signToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
  try {
    const { email, password, name } = await req.json();

    if (!email || !password || !name) {
      return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const existing = await db.getUserByEmail(email);
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
    const now = new Date().toISOString();
    const orgId = `org_${Date.now()}`;

    const newUser = {
      id: `usr_${Date.now()}`,
      email: email.toLowerCase(),
      name,
      role: "user" as const,
      plan: "free" as const,
      password: hashedPassword,
      createdAt: now,
      lastLogin: now,
      status: "active",
      avatar: initials,
      orgId,
      orgName: `${name}'s Workspace`,
      orgRole: "owner" as const,
    };

    await db.createUser(newUser);
    logAction(newUser.id, newUser.email, "auth:signup", newUser.id, ip, { plan: "free" });

    const token = signToken({
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      plan: newUser.plan,
      avatar: newUser.avatar,
      orgId: newUser.orgId,
      orgName: newUser.orgName,
      orgRole: newUser.orgRole,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        plan: newUser.plan,
        avatar: newUser.avatar,
        orgId: newUser.orgId,
        orgName: newUser.orgName,
        orgRole: newUser.orgRole,
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
    console.error("[Signup]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

