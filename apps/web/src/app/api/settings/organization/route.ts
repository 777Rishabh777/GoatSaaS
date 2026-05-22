import { NextRequest, NextResponse } from "next/server";
import { verifyToken, signToken, INVITES_DB } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("goat-session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload || !payload.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const users = await db.getUsersByOrgId(payload.orgId);
    const members = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      avatar: u.avatar,
      orgRole: u.orgRole || "member",
      status: u.status,
    }));

    const invites = INVITES_DB.filter((i) => i.orgId === payload.orgId && i.status === "pending").map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      status: i.status,
      createdAt: i.createdAt,
    }));

    return NextResponse.json({
      orgId: payload.orgId,
      orgName: payload.orgName || "My Workspace",
      members,
      invites,
    });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const token = req.cookies.get("goat-session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload || !payload.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { orgName } = await req.json();
    if (!orgName || !orgName.trim()) {
      return NextResponse.json({ error: "Organization name is required" }, { status: 400 });
    }

    const user = await db.getUserById(payload.id);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Validate role permissions
    if (user.orgRole !== "owner" && user.orgRole !== "admin") {
      return NextResponse.json({ error: "Forbidden: Only owners and admins can rename the organization" }, { status: 403 });
    }

    // Rename organization for all members sharing the orgId
    await db.renameOrganization(payload.orgId, orgName.trim());
    
    // We need to fetch the updated user to get the new orgName
    const updatedUser = await db.getUserById(payload.id);
    if (!updatedUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Re-issue JWT session cookie for the active user
    const newToken = signToken({
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
      plan: updatedUser.plan,
      avatar: updatedUser.avatar,
      orgId: updatedUser.orgId,
      orgName: updatedUser.orgName,
      orgRole: updatedUser.orgRole
    });

    const response = NextResponse.json({
      success: true,
      orgName: user.orgName,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        plan: user.plan,
        avatar: user.avatar,
        orgId: user.orgId,
        orgName: user.orgName,
        orgRole: user.orgRole
      }
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
