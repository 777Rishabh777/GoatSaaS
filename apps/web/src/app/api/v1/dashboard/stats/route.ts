import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/apimiddleware";
import { db } from "@/lib/db";

export const GET = withApiAuth(async (req, ctx) => {
  try {
    const stats = await db.getDashboardStats(ctx.orgId);
    return NextResponse.json(stats);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
