"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface Section {
  id: string;
  title: string;
  icon: string;
  group: string;
}

/* ─── Nav sections ───────────────────────────────────────────────────────── */

const SECTIONS: Section[] = [
  { id: "overview",        title: "Overview",            icon: "🚀", group: "Getting Started" },
  { id: "authentication",  title: "Authentication",      icon: "🔑", group: "Getting Started" },
  { id: "quickstart",      title: "Quick Start",         icon: "⚡", group: "Getting Started" },
  { id: "sdk",             title: "JavaScript SDK",      icon: "📦", group: "SDK" },
  { id: "sdk-query",       title: "client.query()",      icon: "💬", group: "SDK" },
  { id: "sdk-sql",         title: "client.sql()",        icon: "🗄️",  group: "SDK" },
  { id: "sdk-alerts",      title: "client.alerts()",     icon: "🚨", group: "SDK" },
  { id: "sdk-track",       title: "client.track()",      icon: "📊", group: "SDK" },
  { id: "nl-query",        title: "POST /nl-query",      icon: "🤖", group: "REST API" },
  { id: "db-query",        title: "POST /db/query",      icon: "🗃️",  group: "REST API" },
  { id: "anomalies",       title: "GET /anomalies",      icon: "📈", group: "REST API" },
  { id: "keys-list",       title: "GET /keys",           icon: "🔐", group: "REST API" },
  { id: "keys-create",     title: "POST /keys",          icon: "➕", group: "REST API" },
  { id: "keys-revoke",     title: "DELETE /keys/:id",    icon: "🗑️",  group: "REST API" },
  { id: "webhooks",        title: "Webhooks",            icon: "🔗", group: "Webhooks" },
  { id: "webhook-verify",  title: "Signature Verify",    icon: "🛡️",  group: "Webhooks" },
  { id: "errors",          title: "Errors & Limits",     icon: "⚠️",  group: "Reference" },
  { id: "changelog",       title: "Changelog",           icon: "📋", group: "Reference" },
];

const GROUPS = [...new Set(SECTIONS.map(s => s.group))];

/* ─── Code block ─────────────────────────────────────────────────────────── */

function CodeBlock({ code, lang = "bash", title }: { code: string; lang?: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <div className="rounded-xl overflow-hidden border border-zinc-800 my-4">
      {title && (
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
          <span className="text-xs font-mono text-zinc-400">{title}</span>
          <span className="text-[10px] font-mono text-zinc-600 uppercase">{lang}</span>
        </div>
      )}
      <div className="relative bg-zinc-950 group">
        <pre className="overflow-x-auto p-4 text-xs font-mono text-zinc-300 leading-relaxed">{code.trim()}</pre>
        <button
          onClick={copy}
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity btn-ghost text-[10px] px-2.5 py-1 rounded-lg border border-zinc-700 font-mono"
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

/* ─── Endpoint badge ─────────────────────────────────────────────────────── */

function EndpointBadge({ method, path }: { method: string; path: string }) {
  const colors: Record<string, string> = {
    GET: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    POST: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    DELETE: "bg-red-500/10 text-red-400 border-red-500/20",
    PATCH: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  };
  return (
    <div className="flex items-center gap-3 my-4 p-3 rounded-xl bg-zinc-950 border border-zinc-800">
      <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${colors[method] ?? ""}`}>{method}</span>
      <code className="text-sm font-mono text-white">{path}</code>
    </div>
  );
}

/* ─── Parameter table ────────────────────────────────────────────────────── */

function ParamTable({ params }: { params: { name: string; type: string; required?: boolean; desc: string }[] }) {
  return (
    <div className="my-4 rounded-xl overflow-hidden border border-zinc-800">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-zinc-900 text-zinc-400">
            <th className="text-left p-3 font-semibold">Parameter</th>
            <th className="text-left p-3 font-semibold">Type</th>
            <th className="text-left p-3 font-semibold">Required</th>
            <th className="text-left p-3 font-semibold">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-900">
          {params.map(p => (
            <tr key={p.name} className="bg-zinc-950 hover:bg-zinc-900/50 transition-colors">
              <td className="p-3 font-mono text-purple-400">{p.name}</td>
              <td className="p-3 font-mono text-amber-400">{p.type}</td>
              <td className="p-3">{p.required ? <span className="text-emerald-400">✓</span> : <span className="text-zinc-600">–</span>}</td>
              <td className="p-3 text-zinc-400">{p.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Section heading ────────────────────────────────────────────────────── */

function H2({ id, icon, children }: { id: string; icon?: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 text-xl font-bold text-white mt-14 mb-4 flex items-center gap-2 pb-3 border-b border-zinc-800">
      {icon && <span>{icon}</span>}
      {children}
    </h2>
  );
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-zinc-100 mt-8 mb-2">{children}</h3>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-zinc-400 leading-relaxed mb-3">{children}</p>;
}

/* ─── Main docs page ─────────────────────────────────────────────────────── */

export default function DocsPage() {
  const [activeId, setActiveId] = useState<string>("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  /* Intersection observer to highlight active nav item */
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    SECTIONS.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* ── Top nav ── */}
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-lg font-black bg-gradient-to-r from-purple-400 to-emerald-400 text-transparent bg-clip-text">GOATSaaS</span>
            </Link>
            <span className="text-zinc-700">·</span>
            <span className="text-sm text-zinc-400 font-medium">Docs</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-zinc-500 border border-zinc-800 px-2.5 py-1 rounded-lg">v0.1</span>
            <Link href="/dashboard" className="text-xs font-medium text-purple-400 hover:text-purple-300 border border-purple-500/20 px-3 py-1.5 rounded-lg transition-all">
              Dashboard →
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto flex">
        {/* ── Left sidebar nav ── */}
        <aside className="hidden md:block w-56 flex-shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto py-8 pr-4 pl-4">
          <nav className="space-y-6">
            {GROUPS.map(group => (
              <div key={group}>
                <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 px-2 mb-2">{group}</div>
                <ul className="space-y-0.5">
                  {SECTIONS.filter(s => s.group === group).map(s => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all ${
                          activeId === s.id
                            ? "bg-purple-500/10 text-purple-300 font-medium"
                            : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900"
                        }`}
                      >
                        <span className="text-sm">{s.icon}</span>
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* ── Main content ── */}
        <main ref={contentRef} className="flex-1 min-w-0 max-w-3xl px-8 py-10">

          {/* ═══════════════ OVERVIEW ═══════════════ */}
          <H2 id="overview" icon="🚀">GOATSaaS API Overview</H2>
          <P>
            GOATSaaS exposes a REST API and JavaScript SDK that let you embed AI-powered
            telemetry, NL→SQL querying, anomaly detection, and event tracking directly
            into your applications.
          </P>
          <div className="grid grid-cols-2 gap-3 my-6">
            {[
              { icon: "💬", t: "NL → SQL", d: "Translate plain English to production-ready SQL" },
              { icon: "🗄️", t: "External DB", d: "Query your own Postgres database via API" },
              { icon: "🚨", t: "Anomaly Alerts", d: "Fetch AI-detected metric anomalies" },
              { icon: "🔗", t: "Webhooks", d: "Push events to your servers with HMAC signing" },
            ].map(item => (
              <div key={item.t} className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                <div className="text-xl mb-1">{item.icon}</div>
                <div className="text-sm font-semibold text-white">{item.t}</div>
                <div className="text-xs text-zinc-500 mt-0.5">{item.d}</div>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 text-sm text-blue-300 mb-4">
            <span className="font-semibold">Base URL: </span>
            <code className="font-mono">https://goatsaas.com/api/v1</code>
          </div>

          {/* ═══════════════ AUTHENTICATION ═══════════════ */}
          <H2 id="authentication" icon="🔑">Authentication</H2>
          <P>
            All API requests require an API key passed as a Bearer token in the
            <code className="text-purple-400 font-mono mx-1">Authorization</code> header.
            Keys are created in <strong className="text-white">Settings → API Keys</strong>.
          </P>
          <CodeBlock lang="bash" title="HTTP Header" code={`Authorization: Bearer gsk_live_YOUR_KEY_HERE`} />
          <P>
            Keys follow the pattern <code className="font-mono text-purple-400">gsk_live_</code> for live keys.
            Keys are hashed at rest — the raw value is shown <strong className="text-white">only once</strong> at creation time.
            If you lose a key, revoke it and generate a new one.
          </P>

          {/* Rate limits table */}
          <H3>Rate Limits</H3>
          <div className="rounded-xl overflow-hidden border border-zinc-800 my-4">
            <table className="w-full text-xs">
              <thead><tr className="bg-zinc-900 text-zinc-400"><th className="text-left p-3">Plan</th><th className="text-left p-3">Requests / day</th><th className="text-left p-3">NL queries / day</th></tr></thead>
              <tbody className="divide-y divide-zinc-900">
                <tr className="bg-zinc-950"><td className="p-3 text-zinc-400">Free</td><td className="p-3 font-mono text-zinc-300">1,000</td><td className="p-3 font-mono text-zinc-300">50</td></tr>
                <tr className="bg-zinc-950"><td className="p-3 text-purple-400">Pro</td><td className="p-3 font-mono text-zinc-300">50,000</td><td className="p-3 font-mono text-zinc-300">1,000</td></tr>
                <tr className="bg-zinc-950"><td className="p-3 text-amber-400">Enterprise</td><td className="p-3 font-mono text-zinc-300">Unlimited</td><td className="p-3 font-mono text-zinc-300">Unlimited</td></tr>
              </tbody>
            </table>
          </div>

          {/* ═══════════════ QUICK START ═══════════════ */}
          <H2 id="quickstart" icon="⚡">Quick Start (curl)</H2>
          <P>Get your first result in 30 seconds using just curl:</P>
          <CodeBlock lang="bash" title="1. Generate SQL from natural language" code={`curl -X POST https://goatsaas.com/api/v1/nl-query \\
  -H "Authorization: Bearer gsk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"query": "show top 10 users by revenue last month", "model": "groq"}'`} />
          <CodeBlock lang="json" title="Response" code={`{
  "object": "nl_query.result",
  "sql": "SELECT u.id, u.email, SUM(o.amount) AS revenue FROM users u JOIN orders o ON u.id = o.user_id WHERE o.created_at >= NOW() - INTERVAL '1 month' GROUP BY u.id, u.email ORDER BY revenue DESC LIMIT 10",
  "query": "show top 10 users by revenue last month",
  "model": "groq",
  "org_id": "acme-corp",
  "plan": "pro",
  "timestamp": "2025-05-21T18:00:00Z"
}`} />

          {/* ═══════════════ SDK ═══════════════ */}
          <H2 id="sdk" icon="📦">JavaScript / TypeScript SDK</H2>
          <P>The official SDK wraps the REST API with TypeScript types, auto-batching for events, and convenient method chaining.</P>
          <CodeBlock lang="bash" title="Install" code={`npm install goatsaas
# or
yarn add goatsaas
# or
pnpm add goatsaas`} />
          <CodeBlock lang="typescript" title="Initialize" code={`import GoatSaaS from 'goatsaas';

const client = new GoatSaaS({
  apiKey: process.env.GOATSAAS_API_KEY!, // gsk_live_...
  baseUrl: 'https://goatsaas.com',       // optional
  timeoutMs: 30_000,                     // optional
});`} />

          <H2 id="sdk-query" icon="💬">client.query()</H2>
          <P>Translates a natural language question to SQL using AI. Returns the generated SQL string and metadata.</P>
          <CodeBlock lang="typescript" code={`const result = await client.query(
  'show all users who signed up this week',
  'groq'  // optional: "groq" | "gemini" | "ollama"
);

console.log(result.sql);   // SELECT * FROM users WHERE ...
console.log(result.model); // "groq"`} />
          <ParamTable params={[
            { name: "query", type: "string", required: true, desc: "Plain-English question" },
            { name: "model", type: '"groq" | "gemini" | "ollama"', desc: "AI model to use. Default: groq" },
          ]} />

          <H2 id="sdk-sql" icon="🗄️">client.sql()</H2>
          <P>Runs a raw SQL query against your connected external Postgres database. Only SELECT queries are allowed.</P>
          <CodeBlock lang="typescript" code={`const { rows, columns, rowCount, durationMs } = await client.sql(
  'SELECT country, COUNT(*) AS users FROM users GROUP BY country ORDER BY 2 DESC'
);
console.log(\`\${rowCount} rows in \${durationMs}ms\`);
console.table(rows);`} />

          <H2 id="sdk-alerts" icon="🚨">client.alerts()</H2>
          <P>Fetches current system anomaly alerts for your organization. Anomalies are detected automatically by the AI engine.</P>
          <CodeBlock lang="typescript" code={`const { anomalies } = await client.alerts();

anomalies.forEach(alert => {
  console.log(\`[\${alert.z_score.toFixed(1)}σ] \${alert.message}\`);
  // [3.2σ] latency spike detected on endpoint /api/checkout
});`} />

          <H2 id="sdk-track" icon="📊">client.track()</H2>
          <P>Track custom business events. Events are auto-batched in memory and flushed every 1 second or 10 events. Never throws — failed flushes are silently ignored to prevent disrupting your app.</P>
          <CodeBlock lang="typescript" code={`// Fire-and-forget — completely non-blocking
client.track('user.signup', { plan: 'pro', country: 'US' });
client.track('checkout.completed', { amount: 79.00, currency: 'USD' });
client.track('feature.used', { feature: 'nl-query', model: 'groq' });

// Always flush before process exit
process.on('beforeExit', () => client.flush());

// Or await the explicit flush
client.flush();`} />

          {/* ═══════════════ REST API ═══════════════ */}
          <H2 id="nl-query" icon="🤖">POST /api/v1/nl-query</H2>
          <P>Translate a natural-language question to SQL. Requires an active API key.</P>
          <EndpointBadge method="POST" path="https://goatsaas.com/api/v1/nl-query" />
          <H3>Request Body</H3>
          <ParamTable params={[
            { name: "query", type: "string", required: true, desc: "Plain-English question" },
            { name: "model", type: "string", desc: '"groq" | "gemini" | "ollama". Default: "groq"' },
          ]} />
          <CodeBlock lang="bash" code={`curl -X POST https://goatsaas.com/api/v1/nl-query \\
  -H "Authorization: Bearer gsk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"query": "how many users signed up today"}'`} />

          <H2 id="db-query" icon="🗃️">POST /api/v1/db/query</H2>
          <P>Run a raw SQL SELECT query against your connected external Postgres database (configured via Settings → Database).</P>
          <EndpointBadge method="POST" path="https://goatsaas.com/api/v1/db/query" />
          <H3>Request Body</H3>
          <ParamTable params={[
            { name: "sql", type: "string", required: true, desc: "SELECT query to execute (write operations blocked)" },
          ]} />
          <CodeBlock lang="json" title="Response" code={`{
  "object": "db.query_result",
  "columns": ["country", "users"],
  "rows": [{ "country": "US", "users": 1240 }, { "country": "UK", "users": 390 }],
  "rowCount": 2,
  "durationMs": 18,
  "database": "acme-production",
  "timestamp": "2025-05-21T18:00:00Z"
}`} />

          <H2 id="anomalies" icon="📈">GET /api/v1/anomalies</H2>
          <P>List the latest anomaly alerts detected by the AI engine for your organization.</P>
          <EndpointBadge method="GET" path="https://goatsaas.com/api/v1/anomalies" />
          <CodeBlock lang="bash" code={`curl https://goatsaas.com/api/v1/anomalies \\
  -H "Authorization: Bearer gsk_live_..."`} />

          <H2 id="keys-list" icon="🔐">GET /api/v1/keys</H2>
          <P>List all API keys for your organization (raw key values are never returned).</P>
          <EndpointBadge method="GET" path="https://goatsaas.com/api/v1/keys" />

          <H2 id="keys-create" icon="➕">POST /api/v1/keys</H2>
          <P>Create a new API key. The raw key is returned <strong className="text-white">only in this response</strong> — store it immediately.</P>
          <EndpointBadge method="POST" path="https://goatsaas.com/api/v1/keys" />
          <ParamTable params={[
            { name: "name", type: "string", required: true, desc: "Human-readable label for this key" },
          ]} />
          <CodeBlock lang="json" title="Response (raw key shown once)" code={`{
  "id": "key_01HZ4M...",
  "name": "Production Telemetry",
  "rawKey": "gsk_live_abc123...",
  "display": "gsk_live_abc...123",
  "plan": "pro",
  "createdAt": "2025-05-21T18:00:00Z"
}`} />

          <H2 id="keys-revoke" icon="🗑️">DELETE /api/v1/keys/:id</H2>
          <P>Revoke an API key. All in-flight requests using this key will immediately start returning 401.</P>
          <EndpointBadge method="DELETE" path="https://goatsaas.com/api/v1/keys/:id" />

          {/* ═══════════════ WEBHOOKS ═══════════════ */}
          <H2 id="webhooks" icon="🔗">Webhooks</H2>
          <P>
            GOATSaaS can push real-time event notifications to an HTTP endpoint you control.
            Register endpoints in <strong className="text-white">Settings → Webhooks</strong>.
          </P>
          <H3>Supported Events</H3>
          <div className="grid grid-cols-2 gap-2 my-4">
            {["anomaly.detected","quota.exceeded","user.created","plan.changed","api.key_created","test.ping"].map(ev => (
              <code key={ev} className="text-[11px] font-mono px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-purple-300">{ev}</code>
            ))}
          </div>
          <H3>Payload Format</H3>
          <CodeBlock lang="json" title="Example webhook body" code={`{
  "event": "anomaly.detected",
  "timestamp": "2025-05-21T18:00:00Z",
  "org_id": "acme-corp",
  "data": {
    "id": 42,
    "metric": "api_latency_ms",
    "z_score": 3.8,
    "insight": "Latency 3.8σ above baseline",
    "resolved": false
  }
}`} />

          <H2 id="webhook-verify" icon="🛡️">Signature Verification</H2>
          <P>Every webhook request includes an <code className="font-mono text-purple-400">X-GOATSaaS-Signature</code> header. Always verify it to prevent spoofed requests.</P>
          <CodeBlock lang="typescript" title="Express.js — verify webhook" code={`import crypto from 'crypto';
import express from 'express';

const app = express();

// IMPORTANT: parse as raw buffer before JSON
app.use('/webhooks/goatsaas', express.raw({ type: 'application/json' }));

app.post('/webhooks/goatsaas', (req, res) => {
  const rawBody = req.body.toString();
  const signature = req.headers['x-goatsaas-signature'] as string;
  const secret = process.env.GOATSAAS_WEBHOOK_SECRET!;

  // Compute expected signature
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  // Timing-safe comparison
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { event, data } = JSON.parse(rawBody);
  console.log(\`Webhook: \${event}\`, data);
  
  res.sendStatus(200);
});`} />

          {/* ═══════════════ ERRORS ═══════════════ */}
          <H2 id="errors" icon="⚠️">Errors & Limits</H2>
          <div className="rounded-xl overflow-hidden border border-zinc-800 my-4">
            <table className="w-full text-xs">
              <thead><tr className="bg-zinc-900 text-zinc-400"><th className="text-left p-3">Status</th><th className="text-left p-3">Code</th><th className="text-left p-3">Meaning</th></tr></thead>
              <tbody className="divide-y divide-zinc-900">
                {[
                  ["400","bad_request","Malformed JSON or missing required fields"],
                  ["401","unauthorized","Missing or invalid API key"],
                  ["403","forbidden","Key is revoked or org is inactive"],
                  ["429","quota_exceeded","You have hit your daily request limit"],
                  ["500","internal_error","Unexpected server error — retry with backoff"],
                ].map(([status, code, meaning]) => (
                  <tr key={code} className="bg-zinc-950 hover:bg-zinc-900/50 transition-colors">
                    <td className={`p-3 font-mono font-bold ${parseInt(status) >= 500 ? "text-red-400" : parseInt(status) >= 400 ? "text-amber-400" : "text-emerald-400"}`}>{status}</td>
                    <td className="p-3 font-mono text-purple-300">{code}</td>
                    <td className="p-3 text-zinc-400">{meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <CodeBlock lang="json" title="Error response shape" code={`{
  "error": "quota_exceeded",
  "message": "You have used 50/50 NL queries for today. Upgrade to Pro for 1,000/day.",
  "plan": "free",
  "resetAt": "2025-05-22T00:00:00Z"
}`} />

          {/* ═══════════════ CHANGELOG ═══════════════ */}
          <H2 id="changelog" icon="📋">Changelog</H2>
          <div className="space-y-4 my-4">
            {[
              { v: "0.1.0", date: "May 2025", changes: ["Initial public release", "NL→SQL, DB query, anomaly, webhook endpoints", "JavaScript SDK with auto-batched tracking"] },
            ].map(rel => (
              <div key={rel.v} className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm font-bold text-white font-mono">v{rel.v}</span>
                  <span className="text-xs text-zinc-500">{rel.date}</span>
                </div>
                <ul className="space-y-1">
                  {rel.changes.map(c => <li key={c} className="text-xs text-zinc-400">· {c}</li>)}
                </ul>
              </div>
            ))}
          </div>

          {/* CTA footer */}
          <div className="mt-16 p-8 rounded-2xl bg-gradient-to-br from-purple-900/20 to-emerald-900/20 border border-purple-500/20 text-center">
            <div className="text-2xl font-bold text-white mb-2">Ready to integrate?</div>
            <p className="text-sm text-zinc-400 mb-6">Generate your API key and start querying in under 2 minutes.</p>
            <Link href="/dashboard" className="inline-flex items-center gap-2 btn-primary px-6 py-3 rounded-xl text-sm font-semibold">
              Open Dashboard → Get API Key
            </Link>
          </div>

        </main>

        {/* ── Right on-page anchor minimap (lg+) ── */}
        <aside className="hidden lg:block w-48 flex-shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto py-8 pl-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">On this page</div>
          <ul className="space-y-1">
            {SECTIONS.filter(s => !["sdk-query","sdk-sql","sdk-alerts","sdk-track","keys-list","keys-create","keys-revoke","webhook-verify"].includes(s.id)).map(s => (
              <li key={s.id}>
                <a href={`#${s.id}`} className={`block text-[11px] py-0.5 transition-colors ${activeId === s.id ? "text-purple-400 font-medium" : "text-zinc-600 hover:text-zinc-300"}`}>
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
