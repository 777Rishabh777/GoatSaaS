import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/apimiddleware";
import { db } from "@/lib/db";
import crypto from "crypto";

export const GET = withApiAuth(async (req, ctx) => {
  const vehicles = await db.getOrgLogisticsVehicles(ctx.orgId);
  return NextResponse.json({ vehicles });
});

export const POST = withApiAuth(async (req, ctx) => {
  try {
    const body = await req.json();
    if (!body.driverName) {
      return NextResponse.json({ error: "Driver name is required" }, { status: 400 });
    }

    const vehicle = {
      id: `veh_${crypto.randomBytes(8).toString("hex")}`,
      orgId: ctx.orgId,
      driverName: body.driverName,
      status: body.status || "offline",
      locationLat: body.locationLat || null,
      locationLng: body.locationLng || null,
      lastPing: body.lastPing || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.createLogisticsVehicle(vehicle as any);
    return NextResponse.json({ success: true, vehicle }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});

export const PATCH = withApiAuth(async (req, ctx) => {
  try {
    const body = await req.json();
    if (!body.vehicleId || !body.status) {
      return NextResponse.json({ error: "vehicleId and status are required" }, { status: 400 });
    }
    
    await db.updateLogisticsVehicleStatus(body.vehicleId, ctx.orgId, body.status, body.locationLat, body.locationLng);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
