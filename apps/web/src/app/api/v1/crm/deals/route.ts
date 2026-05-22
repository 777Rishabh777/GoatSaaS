import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/apimiddleware";
import { db } from "@/lib/db";
import crypto from "crypto";

export const GET = withApiAuth(async (req, ctx) => {
  const deals = await db.getOrgCrmDeals(ctx.orgId);
  return NextResponse.json({ deals });
});

export const POST = withApiAuth(async (req, ctx) => {
  try {
    const body = await req.json();
    if (!body.title || !body.contactId) {
      return NextResponse.json({ error: "Title and contactId are required" }, { status: 400 });
    }

    const deal = {
      id: `deal_${crypto.randomBytes(8).toString("hex")}`,
      orgId: ctx.orgId,
      contactId: body.contactId,
      title: body.title,
      amount: Number(body.amount) || 0,
      stage: body.stage || "prospecting",
      expectedCloseDate: body.expectedCloseDate || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.createCrmDeal(deal as any);
    return NextResponse.json({ success: true, deal }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});

export const PATCH = withApiAuth(async (req, ctx) => {
  try {
    const body = await req.json();
    if (!body.dealId || !body.stage) {
      return NextResponse.json({ error: "dealId and stage are required" }, { status: 400 });
    }
    
    await db.updateCrmDealStage(body.dealId, ctx.orgId, body.stage);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
