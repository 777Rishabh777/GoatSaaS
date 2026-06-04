import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withApiAuth } from "@/lib/apimiddleware";

export const GET = withApiAuth(async (req, ctx) => {
  const activities = await db.getOrgCrmActivities(ctx.orgId);
  return NextResponse.json({ activities });
});

export const POST = withApiAuth(async (req, ctx) => {
  const body = await req.json();
  const { contactId, dealId, type, notes, metadata } = body;

  if (!notes || !type) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const activityId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  await db.createCrmActivity({
    id: activityId,
    orgId: ctx.orgId,
    contactId: contactId || null,
    dealId: dealId || null,
    type,
    notes,
    metadata: metadata || null,
    date: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, activityId });
});
