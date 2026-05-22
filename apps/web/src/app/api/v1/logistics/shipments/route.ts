import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/apimiddleware";
import { db } from "@/lib/db";
import crypto from "crypto";

export const GET = withApiAuth(async (req, ctx) => {
  const shipments = await db.getOrgLogisticsShipments(ctx.orgId);
  return NextResponse.json({ shipments });
});

export const POST = withApiAuth(async (req, ctx) => {
  try {
    const body = await req.json();
    if (!body.origin || !body.destination) {
      return NextResponse.json({ error: "Origin and destination are required" }, { status: 400 });
    }

    const shipment = {
      id: `ship_${crypto.randomBytes(8).toString("hex")}`,
      orgId: ctx.orgId,
      vehicleId: body.vehicleId || null,
      origin: body.origin,
      destination: body.destination,
      status: body.status || "pending",
      estimatedDelivery: body.estimatedDelivery || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.createLogisticsShipment(shipment as any);
    return NextResponse.json({ success: true, shipment }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});

export const PATCH = withApiAuth(async (req, ctx) => {
  try {
    const body = await req.json();
    if (!body.shipmentId || !body.status) {
      return NextResponse.json({ error: "shipmentId and status are required" }, { status: 400 });
    }
    
    await db.updateLogisticsShipmentStatus(body.shipmentId, ctx.orgId, body.status);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
