/**
 * GOATSaaS Express Gateway — apps/server/src/index.ts
 *
 * This server acts as a gateway/proxy between the web app and external services.
 * It also provides health check, CORS proxy, and server-sent metrics endpoints.
 *
 * Run: npm run dev
 * Starts on: http://localhost:4000
 */

import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT ?? 4000;
const AI_SERVICE = process.env.AI_SERVICE_URL ?? "http://localhost:8000";

app.use(express.json());
app.use(cors({
  origin: process.env.WEB_URL ?? "http://localhost:3000",
  credentials: true,
}));

// ─── Health Check ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "goatsaas-gateway",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ─── AI Service Proxy ─────────────────────────────────────────────────────────
// Proxies requests to the Python FastAPI service
app.all("/proxy/ai/*path", async (req, res) => {
  const targetPath = req.path.replace("/proxy/ai", "");
  const targetUrl = `${AI_SERVICE}${targetPath}`;

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-By": "goatsaas-gateway",
      },
      body: ["GET", "HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(502).json({ error: "AI service unavailable", detail: String(err) });
  }
});

// ─── Status endpoint for admin panel ──────────────────────────────────────────
app.get("/status", (_req, res) => {
  res.json({
    gateway: { status: "healthy", latency: "2ms" },
    ai_service: AI_SERVICE,
    node_version: process.version,
    memory: process.memoryUsage(),
  });
});

// ─── Start server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 GOATSaaS Gateway running at http://localhost:${PORT}`);
  console.log(`   ↳ Health:   http://localhost:${PORT}/health`);
  console.log(`   ↳ AI Proxy: http://localhost:${PORT}/proxy/ai/*`);
  console.log(`   ↳ AI Service target: ${AI_SERVICE}\n`);
});

export default app;
