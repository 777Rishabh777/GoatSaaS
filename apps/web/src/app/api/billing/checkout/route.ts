import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { db } from "@/lib/db";
import Stripe from "stripe";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16" as any,
}) : null;

export async function POST(req: NextRequest) {
  const token = req.cookies.get("goat-session")?.value;
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { plan_id } = await req.json();
  if (!plan_id || !["pro", "enterprise"].includes(plan_id)) {
    return NextResponse.json({ error: "Invalid plan ID" }, { status: 400 });
  }

  const user = await db.getUserById(payload.id);
  if (!user || !user.orgId) {
    return NextResponse.json({ error: "User or Organization not found" }, { status: 404 });
  }

  const orgId = user.orgId;

  // Mock Mode: If Stripe isn't configured, just upgrade immediately
  if (!stripe) {
    await db.updateOrganizationPlan(orgId, plan_id as "free" | "pro" | "enterprise");
    return NextResponse.json({ url: "/dashboard?success=true" });
  }

  const priceId = plan_id === "pro" 
    ? process.env.STRIPE_PRO_PRICE_ID 
    : process.env.STRIPE_ENTERPRISE_PRICE_ID;

  if (!priceId) {
    return NextResponse.json({ error: `Stripe Price ID not configured for ${plan_id} plan.` }, { status: 500 });
  }

  try {
    const org = await db.getOrganizationById(orgId);
    let customerId = org?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: org?.name || user.orgName || "Organization",
        metadata: {
          orgId: orgId,
          userId: user.id
        }
      });
      customerId = customer.id;
      await db.updateOrganizationStripe(orgId, customerId, null);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${req.nextUrl.origin}/dashboard?success=true`,
      cancel_url: `${req.nextUrl.origin}/dashboard?canceled=true`,
      client_reference_id: orgId,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
