import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/apimiddleware";
import { db } from "@/lib/db";
import crypto from "crypto";

export const GET = withApiAuth(async (req, ctx) => {
  const orders = await db.getOrgEcommerceOrders(ctx.orgId);
  return NextResponse.json({ orders });
});

export const POST = withApiAuth(async (req, ctx) => {
  try {
    const body = await req.json();
    if (!body.customerId || !body.items || !body.items.length) {
      return NextResponse.json({ error: "Customer ID and items are required" }, { status: 400 });
    }

    let totalAmount = 0;
    const orderItems = body.items.map((item: any) => {
      totalAmount += item.priceAtPurchase * item.quantity;
      return {
        id: `line_${crypto.randomBytes(8).toString("hex")}`,
        orderId: "", // filled below
        productId: item.productId,
        quantity: item.quantity,
        priceAtPurchase: item.priceAtPurchase,
      };
    });

    const orderId = `ord_${crypto.randomBytes(8).toString("hex")}`;
    const order = {
      id: orderId,
      orgId: ctx.orgId,
      customerId: body.customerId,
      totalAmount,
      status: body.status || "pending",
      paymentStatus: body.paymentStatus || "unpaid",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    orderItems.forEach((i: any) => i.orderId = orderId);

    await db.createEcommerceOrder(order as any, orderItems);
    return NextResponse.json({ success: true, order, items: orderItems }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});

export const PATCH = withApiAuth(async (req, ctx) => {
  try {
    const body = await req.json();
    if (!body.orderId || !body.status) {
      return NextResponse.json({ error: "orderId and status are required" }, { status: 400 });
    }
    
    await db.updateEcommerceOrderStatus(body.orderId, ctx.orgId, body.status, body.paymentStatus);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
