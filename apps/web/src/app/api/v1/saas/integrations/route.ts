import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/apimiddleware";
import { db } from "@/lib/db";
import crypto from "crypto";

// Simulated Live SaaS API Integration Endpoint
export const POST = withApiAuth(async (req, ctx) => {
  try {
    const orgId = ctx.orgId;
    const body = await req.json();
    const { platform, apiKey } = body;

    if (!platform || !apiKey) {
      return NextResponse.json({ error: "Platform and API Key are required." }, { status: 400 });
    }

    // Simulate API verification and data fetching delay
    await new Promise((r) => setTimeout(r, 1500));

    // Generate upcoming dates based on platform
    const now = new Date();
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const createdDate = now.toISOString();
    let newSub: any = {
      id: `saas_${crypto.randomBytes(8).toString("hex")}`,
      orgId,
      currency: "USD",
      billingCycle: "monthly",
      renewalDate: nextMonth.toISOString(),
      status: "active",
      createdAt: createdDate,
      updatedAt: createdDate,
      seatsTotal: 1,
      seatsUsed: 1,
    };

    if (platform === "aws") {
      newSub.name = "AWS (Amazon Web Services)";
      newSub.amount = 350.25; // Simulated usage cost
      newSub.paymentMethod = "Invoice / Linked Card";
    } else if (platform === "vercel") {
      newSub.name = "Vercel Pro";
      newSub.amount = 20.00; 
      newSub.paymentMethod = "Stripe stored card";
    } else if (platform === "stripe") {
      newSub.name = "Stripe Billing/Tax";
      newSub.amount = 49.00;
      newSub.paymentMethod = "Deducted from balance";
    } else {
      newSub.name = `${platform} API Connection`;
      newSub.amount = 15.00;
      newSub.paymentMethod = "API Billing";
    }

    await db.createSubscription(newSub);

    return NextResponse.json({ success: true, record: newSub });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
