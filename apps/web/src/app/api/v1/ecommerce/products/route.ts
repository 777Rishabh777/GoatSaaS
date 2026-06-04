import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/apimiddleware";
import { db } from "@/lib/db";
import crypto from "crypto";

export const GET = withApiAuth(async (req, ctx) => {
  const products = await db.getOrgEcommerceProducts(ctx.orgId);
  return NextResponse.json({ products });
});

export const POST = withApiAuth(async (req, ctx) => {
  try {
    const body = await req.json();
    if (!body.name || body.price === undefined) {
      return NextResponse.json({ error: "Name and price are required" }, { status: 400 });
    }

    const product = {
      id: `prod_${crypto.randomBytes(8).toString("hex")}`,
      orgId: ctx.orgId,
      name: body.name,
      description: body.description || "",
      price: Number(body.price),
      stockQuantity: Number(body.stockQuantity) || 0,
      category: body.category || "Uncategorized",
      imageUrl: body.imageUrl || null,
      sku: body.sku || null,
      status: body.status || "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.createEcommerceProduct(product as any);
    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});

export const PATCH = withApiAuth(async (req, ctx) => {
  try {
    const body = await req.json();
    if (!body.productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }
    
    await db.updateEcommerceProduct(body.productId, ctx.orgId, body);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
