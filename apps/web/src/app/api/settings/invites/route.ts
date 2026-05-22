import { NextRequest, NextResponse } from "next/server";
import { verifyToken, USERS_DB, INVITES_DB, Invite } from "@/lib/auth";
import { sendInviteEmail } from "@/lib/email";
import { logAction } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("goat-session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload || !payload.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Validate active user role in org
    const user = USERS_DB.find((u) => u.id === payload.id);
    if (!user || (user.orgRole !== "owner" && user.orgRole !== "admin")) {
      return NextResponse.json({ error: "Forbidden: Only owners and admins can invite members" }, { status: 403 });
    }

    const { email, role } = await req.json();

    if (!email || !email.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const targetRole = role === "admin" ? "admin" : "member";

    // Check if user is already a member
    const isMember = USERS_DB.some((u) => u.orgId === payload.orgId && u.email.toLowerCase() === cleanEmail);
    if (isMember) {
      return NextResponse.json({ error: "User is already a member of this organization" }, { status: 400 });
    }

    // Check if user already has an active pending invite
    const hasInvite = INVITES_DB.some(
      (i) => i.orgId === payload.orgId && i.email.toLowerCase() === cleanEmail && i.status === "pending"
    );
    if (hasInvite) {
      return NextResponse.json({ error: "An active invitation for this email already exists" }, { status: 400 });
    }

    // Create the invite
    const newInvite: Invite = {
      id: `inv_${Date.now()}`,
      email: cleanEmail,
      orgId: payload.orgId,
      role: targetRole,
      status: "pending",
      invitedBy: payload.id,
      createdAt: new Date().toISOString(),
    };

    INVITES_DB.push(newInvite);

    // Send invite email (fire-and-forget)
    sendInviteEmail({
      toEmail: cleanEmail,
      orgName: payload.orgName ?? "your organization",
      inviterName: user.name,
      role: targetRole,
      inviteId: newInvite.id,
    }).catch(() => {});

    // Audit log
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    logAction(payload.id, payload.email, "settings:invite_sent", cleanEmail, ip, {
      orgId: payload.orgId,
      role: targetRole,
    });

    return NextResponse.json({ success: true, invite: newInvite });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get("goat-session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload || !payload.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Validate active user role in org
    const user = USERS_DB.find((u) => u.id === payload.id);
    if (!user || (user.orgRole !== "owner" && user.orgRole !== "admin")) {
      return NextResponse.json({ error: "Forbidden: Only owners and admins can manage invitations" }, { status: 403 });
    }

    const { inviteId } = await req.json();
    if (!inviteId) {
      return NextResponse.json({ error: "Invite ID is required" }, { status: 400 });
    }

    const invite = INVITES_DB.find((i) => i.id === inviteId);
    if (!invite) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    if (invite.orgId !== payload.orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    invite.status = "revoked";

    const ip2 = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    logAction(payload.id, payload.email, "settings:invite_revoked", invite.email, ip2);

    return NextResponse.json({ success: true, inviteId });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
