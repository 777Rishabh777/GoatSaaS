import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { signToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";

/**
 * POST /api/auth/admin-login
 *
 * Separate admin login endpoint.
 * Only succeeds if the user's role is "admin".
 * All attempts (success or failure) are audit-logged.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const user = await db.getUserByEmail(email);

    // Log failed attempt (no user found)
    if (!user) {
      logAction("unknown", email, "admin:login_failed", "user_not_found", ip, {
        reason: "email_not_found",
      });
      // Generic error — don't reveal if email exists
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Check password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      logAction(user.id, user.email, "admin:login_failed", "wrong_password", ip, {
        reason: "wrong_password",
      });
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // CRITICAL: Only allow users with role === "admin"
    if (user.role !== "admin") {
      logAction(user.id, user.email, "admin:login_denied", "not_admin_role", ip, {
        actualRole: user.role,
      });
      return NextResponse.json(
        { error: "Access denied. Admin privileges required." },
        { status: 403 }
      );
    }

    // Check account status
    if (user.status === "suspended") {
      return NextResponse.json(
        { error: "Account suspended. Contact support." },
        { status: 403 }
      );
    }

    // Success — update last login
    await db.updateUserLogin(user.id);

    // Log successful admin login
    logAction(user.id, user.email, "admin:login_success", "/admin", ip, {
      name: user.name,
    });

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
      sameSite: "strict", // Stricter than user login
      maxAge: 4 * 60 * 60, // 4 hours (shorter session for admin)
      path: "/",
    });

    return response;
  } catch (err) {
    logAction("unknown", "unknown", "admin:login_error", "server_error", ip, {
      error: String(err),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
