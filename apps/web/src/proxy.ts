/**
 * Next.js Middleware — Route Protection
 * Runs on every request BEFORE rendering.
 *
 * Rules:
 *  /admin/*        → requires role === "admin" → else redirect /admin-login
 *  /admin-login    → if already admin, redirect /admin
 *  /dashboard/*    → requires any logged-in user → else redirect /sign-in
 *  /settings/*     → requires any logged-in user → else redirect /sign-in
 *  /sign-in        → if already logged in, redirect /dashboard (or /admin)
 *  /sign-up        → if already logged in, redirect /dashboard
 */

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "goat-saas-super-secret-key-2024");

async function verifyTokenEdge(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as any;
  } catch {
    return null;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("goat-session")?.value;
  const payload = token ? await verifyTokenEdge(token) : null;

  // ── Admin routes ──────────────────────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    if (!payload) {
      const url = new URL("/sign-in", req.url);
      url.searchParams.set("from", pathname);
      return NextResponse.redirect(url);
    }

    if (payload.role !== "admin") {
      // Logged in but not admin → send to their dashboard with error
      const url = new URL("/dashboard", req.url);
      url.searchParams.set("error", "admin_required");
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }


  // ── Protected user routes ─────────────────────────────────────────────────
  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/settings")
  ) {
    if (!payload) {
      const url = new URL("/sign-in", req.url);
      url.searchParams.set("from", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // ── Auth pages — redirect if already logged in ────────────────────────────
  if (pathname === "/sign-in" || pathname === "/sign-up") {
    if (payload) {
      const dest = payload.role === "admin" ? "/admin" : "/dashboard";
      return NextResponse.redirect(new URL(dest, req.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/admin-login",
    "/dashboard",
    "/dashboard/:path*",
    "/settings",
    "/settings/:path*",
    "/sign-in",
    "/sign-up",
  ],
};
