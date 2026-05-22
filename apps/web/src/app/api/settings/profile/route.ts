import { NextRequest, NextResponse } from "next/server";
import { verifyToken, signToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import bcrypt from "bcryptjs";

// POST — update profile (name + email)
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("goat-session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { name, email } = await req.json();

    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }

    const user = await db.getUserById(payload.id);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Check email uniqueness if changed
    if (email.toLowerCase() !== user.email.toLowerCase()) {
      const existing = await db.getUserByEmail(email);
      if (existing) {
        return NextResponse.json({ error: "Email is already taken by another account" }, { status: 409 });
      }
    }

    // Update profile
    await db.updateUserProfile(user.id, name, email);
    
    // Fetch updated user to get new avatar
    const updatedUser = await db.getUserById(user.id);
    if (!updatedUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Audit log
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    logAction(payload.id, payload.email, "settings:profile_update", user.id, ip, { field: "name+email" });

    // Re-issue JWT session cookie
    const newToken = signToken({
      id: updatedUser.id, email: updatedUser.email, name: updatedUser.name, role: updatedUser.role,
      plan: updatedUser.plan, avatar: updatedUser.avatar, orgId: updatedUser.orgId, orgName: updatedUser.orgName, orgRole: updatedUser.orgRole
    });

    const response = NextResponse.json({
      success: true,
      user: { id: updatedUser.id, email: updatedUser.email, name: updatedUser.name, role: updatedUser.role, plan: updatedUser.plan, avatar: updatedUser.avatar, orgId: updatedUser.orgId, orgName: updatedUser.orgName, orgRole: updatedUser.orgRole },
    });

    response.cookies.set("goat-session", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH — change password
export async function PATCH(req: NextRequest) {
  try {
    const token = req.cookies.get("goat-session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "currentPassword and newPassword are required" }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
    }

    const user = await db.getUserById(payload.id);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    // Hash and save new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.updateUserPassword(user.id, hashedPassword);

    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    logAction(payload.id, payload.email, "auth:password_change", user.id, ip);

    return NextResponse.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

