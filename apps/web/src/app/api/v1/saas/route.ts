import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/apimiddleware";
import { db } from "@/lib/db";
import crypto from "crypto";

export const GET = withApiAuth(async (req, ctx) => {
  const subscriptions = await db.getOrgSubscriptions(ctx.orgId);
  const vendors = await db.getOrgVendors(ctx.orgId);
  const departments = await db.getOrgDepartments(ctx.orgId);
  const teamMembers = await db.getOrgTeamMembers(ctx.orgId);
  const assignments = await db.getOrgLicenseAssignments(ctx.orgId);
  const overview = await db.getSaasOverview(ctx.orgId);
  const upcomingRenewals = await db.getUpcomingRenewals(ctx.orgId);

  return NextResponse.json({
    subscriptions,
    vendors,
    departments,
    teamMembers,
    assignments,
    overview,
    upcomingRenewals,
  });
});

export const POST = withApiAuth(async (req, ctx) => {
  try {
    const body = await req.json();
    const { entity, data } = body;
    const id = `saas_${crypto.randomBytes(8).toString("hex")}`;
    const now = new Date().toISOString();

    if (entity === "subscription") {
      const sub = { ...data, id, orgId: ctx.orgId, createdAt: now, updatedAt: now };
      await db.createSubscription(sub);
      return NextResponse.json({ success: true, record: sub }, { status: 201 });
    } else if (entity === "vendor") {
      const vendor = { ...data, id, orgId: ctx.orgId, createdAt: now, updatedAt: now };
      await db.createVendor(vendor);
      return NextResponse.json({ success: true, record: vendor }, { status: 201 });
    } else if (entity === "department") {
      const dept = { ...data, id, orgId: ctx.orgId, createdAt: now, updatedAt: now };
      await db.createDepartment(dept);
      return NextResponse.json({ success: true, record: dept }, { status: 201 });
    } else if (entity === "teamMember") {
      const member = { ...data, id, orgId: ctx.orgId, createdAt: now, updatedAt: now };
      await db.createTeamMember(member);
      return NextResponse.json({ success: true, record: member }, { status: 201 });
    } else if (entity === "assignment") {
      const assignment = { ...data, id, orgId: ctx.orgId, assignedAt: now };
      await db.createLicenseAssignment(assignment);
      return NextResponse.json({ success: true, record: assignment }, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid entity type" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});

export const PATCH = withApiAuth(async (req, ctx) => {
  try {
    const body = await req.json();
    const { entity, id, data } = body;

    if (entity === "subscription") {
      await db.updateSubscription(id, ctx.orgId, data);
    } else if (entity === "vendor") {
      await db.updateVendor(id, ctx.orgId, data);
    } else if (entity === "department") {
      await db.updateDepartment(id, ctx.orgId, data);
    } else if (entity === "teamMember") {
      await db.updateTeamMember(id, ctx.orgId, data);
    } else if (entity === "assignment") {
      await db.updateLicenseAssignmentStatus(id, ctx.orgId, data.status);
    } else {
      return NextResponse.json({ error: "Invalid entity type" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});

export const DELETE = withApiAuth(async (req, ctx) => {
  try {
    const url = new URL(req.url);
    const entity = url.searchParams.get("entity");
    const id = url.searchParams.get("id");

    if (!entity || !id) return NextResponse.json({ error: "Entity and id required" }, { status: 400 });

    if (entity === "subscription") {
      await db.deleteSubscription(id, ctx.orgId);
    } else if (entity === "vendor") {
      await db.deleteVendor(id, ctx.orgId);
    } else if (entity === "department") {
      await db.deleteDepartment(id, ctx.orgId);
    } else if (entity === "teamMember") {
      await db.deleteTeamMember(id, ctx.orgId);
    } else if (entity === "assignment") {
      await db.deleteLicenseAssignment(id, ctx.orgId);
    } else {
      return NextResponse.json({ error: "Invalid entity type" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
