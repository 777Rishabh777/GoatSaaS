import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import Stripe from "stripe";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16" as any,
}) : null;

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  if (!stripe || !endpointSecret) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  let event: Stripe.Event;

  try {
    const body = await req.text();
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.client_reference_id;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        
        if (orgId) {
          const expandedSession = await stripe.checkout.sessions.retrieve(session.id, { expand: ['line_items'] });
          const priceId = expandedSession.line_items?.data[0]?.price?.id;
          
          let plan: "free" | "pro" | "enterprise" = "pro";
          if (priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID) {
            plan = "enterprise";
          }
          
          await db.updateOrganizationStripe(orgId, customerId, subscriptionId);
          await db.updateOrganizationPlan(orgId, plan);
        }
        break;
      }
      case "customer.subscription.deleted": {
        // Handle downgrading the plan back to 'free' when a subscription is canceled
        console.log(`Subscription deleted: ${event.data.object.id}`);
        // Requires looking up organization by stripe_customer_id
        break;
      }
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
