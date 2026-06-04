import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/apimiddleware";
import { db } from "@/lib/db";
import crypto from "crypto";

export const GET = withApiAuth(async (req, ctx) => {
  const customers = await db.getOrgEcommerceCustomers(ctx.orgId);
  return NextResponse.json({ customers });
});

export const POST = withApiAuth(async (req, ctx) => {
  try {
    const body = await req.json();
    if (!body.name || !body.email) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }

    const customer = {
      id: `cust_${crypto.randomBytes(8).toString("hex")}`,
      orgId: ctx.orgId,
      name: body.name,
      email: body.email,
      phone: body.phone || null,
      totalSpent: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.createEcommerceCustomer(customer as any);
    return NextResponse.json({ success: true, customer }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
