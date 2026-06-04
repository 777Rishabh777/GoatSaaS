import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withApiAuth } from "@/lib/apimiddleware";

export const GET = withApiAuth(async (req, ctx) => {
  const companies = await db.getOrgCrmCompanies(ctx.orgId);
  return NextResponse.json({ companies });
});

export const POST = withApiAuth(async (req, ctx) => {
  const body = await req.json();
  const { name, website, industry } = body;

  if (!name) return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

  const companyId = `cmp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  await db.createCrmCompany({
    id: companyId,
    orgId: ctx.orgId,
    name,
    website: website || null,
    industry: industry || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, companyId });
});
