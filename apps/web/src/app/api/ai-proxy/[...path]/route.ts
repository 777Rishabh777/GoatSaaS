import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(req, (await params).path);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(req, (await params).path);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(req, (await params).path);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(req, (await params).path);
}

async function handleProxy(req: NextRequest, path: string[]) {
  const backendUrl = process.env.AI_SERVICE_URL || "http://localhost:8000";
  const targetPath = path.join("/");
  const url = new URL(req.url);
  const targetUrl = `${backendUrl}/api/${targetPath}${url.search}`;

  try {
    const headers = new Headers(req.headers);
    // Remove host header to avoid forwarding original host to backend
    headers.delete("host");

    // Optional: add a specific token or secret here to verify next.js proxy requests

    const options: RequestInit = {
      method: req.method,
      headers: headers,
      // If there is a body, forward it (except for GET/HEAD)
      body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.arrayBuffer(),
      redirect: "manual",
    };

    const response = await fetch(targetUrl, options);

    // Forward the response back to the client
    const responseHeaders = new Headers(response.headers);
    
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("AI Proxy Error:", error);
    return NextResponse.json(
      { error: "AI Service is currently offline or unreachable." },
      { status: 502 }
    );
  }
}
