# GOATSaaS → Developer Platform

## The Core Insight

Right now GOATSaaS is a **dashboard** — developers log in and click things.  
What they actually pay for is an **API** — 2 lines of code in their app, data flows, they never leave.

Every company making real money (Stripe, Datadog, Sentry, OpenAI) sells the same thing: **drop code into your app and it works**. The dashboard is just proof the API is working.

---

## Priority Order (build this exact sequence)

```
API Keys → External DB Connector → Webhooks → SDK
    ↑              ↑                  ↑          ↑
 Required      10x value          $500/mo     Viral loop
 for all       overnight          deals       installs
 3 below
```

---

## Feature 1: Real API Key System ⚡ REQUIRED FIRST

**What it is:** A developer generates `gsk_live_abc123...` in Settings → API Keys, then calls:

```bash
curl -X POST https://goatsaas.com/api/v1/nl-query \
  -H "Authorization: Bearer gsk_live_abc123" \
  -H "Content-Type: application/json" \
  -d '{"query": "show me revenue by country last 30 days"}'
```

And gets back:
```json
{
  "sql": "SELECT country, SUM(amount) FROM orders WHERE ...",
  "result": [...],
  "model": "groq/llama-3",
  "latency_ms": 142
}
```

**Why it's first:** Every other feature depends on API auth. You can't charge for webhooks or DB connectors without knowing *which customer* is making the call.

### Files to create/modify

#### [NEW] `src/lib/apikeys.ts`
- `generateApiKey(userId, orgId, name)` → returns `gsk_live_<32 random chars>`
- `validateApiKey(key)` → returns `{ userId, orgId, plan }` or null
- `API_KEYS_DB` in-memory store (same pattern as USERS_DB)
- Rate limit counters per key per minute

#### [NEW] `src/lib/apimiddleware.ts`
- `withApiAuth(handler)` — wraps any route, reads `Authorization: Bearer` header
- Returns 401 if key missing/invalid, 429 if rate limited, 403 if plan doesn't allow it
- Logs to quota tracker + audit log automatically

#### [NEW] `src/app/api/v1/nl-query/route.ts`
- Public endpoint: `POST /api/v1/nl-query`
- Auth: API key in header
- Body: `{ query: string, model?: "groq"|"gemini"|"ollama" }`
- Forwards to Python AI service, streams back JSON
- Enforces plan limits (free: 100 calls/day, pro: 5000, enterprise: unlimited)

#### [NEW] `src/app/api/v1/anomalies/route.ts`
- `GET /api/v1/anomalies` — latest alerts for the org
- `GET /api/v1/anomalies/stats` — mean, std_dev, threshold

#### [NEW] `src/app/api/v1/keys/route.ts`
- `GET` — list keys for authenticated user (masked)
- `POST` — generate new key `{ name: string }`
- `DELETE` — revoke key by ID

#### [MODIFY] `src/app/(app)/dashboard/page.tsx`
- Wire up the Settings → API Keys tab to use real `/api/v1/keys` endpoint
- Show key prefix (`gsk_live_abc1...xxxx`), creation date, last used
- One-time reveal on creation (like Stripe does it)

---

## Feature 2: External Database Connector 🔥 10x VALUE

**What it is:** User pastes `postgresql://user:pass@host:5432/mydb` into a field. Now every NL→SQL query runs against **their actual business data** — their users table, their orders, their revenue.

```
Before: "How many active users?" → queries YOUR demo Neon DB (useless)
After:  "How many active users?" → queries THEIR production database (irreplaceable)
```

Once their real data flows through, switching cost = months of migration. They're locked in.

### Files to create/modify

#### [NEW] `src/lib/dbconnector.ts`
- `testConnection(uri: string)` → returns `{ success, tables[], rowCount }`
- `runQuery(orgId, sql)` → executes against org's registered DB URI
- `DB_CONNECTIONS` store: `{ orgId → { uri, label, connectedAt } }`
- URI validation + sanitization (block DROP, DELETE without WHERE, TRUNCATE)

#### [NEW] `src/app/api/v1/db/connect/route.ts`
- `POST /api/v1/db/connect` — save a DB URI for the org
- `DELETE /api/v1/db/connect` — remove it
- `GET /api/v1/db/connect` — connection status + table list

#### [NEW] `src/app/api/v1/db/query/route.ts`
- `POST /api/v1/db/query` — run raw SQL against org's connected DB
- Auth: API key or session cookie
- Returns rows as JSON array

#### [MODIFY] `src/app/api` (NL→SQL route)
- After connecting a DB, NL→SQL queries route to the external DB
- Show which DB is being queried in the UI ("Querying: Acme Corp Production DB ✓")

#### [MODIFY] `src/app/(app)/dashboard/page.tsx` — Settings tab
- New "Database Connections" sub-tab
- Input: `Connection URI (postgresql://...)`
- Button: "Test Connection" → shows table list on success
- Status indicator: Connected / Not connected

---

## Feature 3: Webhooks 💰 ENTERPRISE DEALS

**What it is:** User pastes a URL. When your anomaly detector fires, you do:

```
POST https://their-slack-webhook.com/... 
{
  "event": "anomaly.detected",
  "latency_ms": 892,
  "z_score": 4.2,
  "message": "Response time 4.2 standard deviations above baseline",
  "timestamp": "2026-05-21T13:30:00Z"
}
```

Their Slack lights up. They see it before their customers do. That's worth $500/month.

### Files to create/modify

#### [NEW] `src/lib/webhooks.ts`
- `WEBHOOKS_DB`: `{ orgId → { url, secret, events[], createdAt, lastFiredAt, status } }`
- `fireWebhook(orgId, event, payload)` → POST to URL with HMAC-SHA256 signature header
- `verifyWebhookSignature(secret, payload, header)` — for docs
- Retry logic: 3 attempts with exponential backoff
- Dead letter logging: if all retries fail, mark webhook as `failing`

#### [NEW] `src/app/api/v1/webhooks/route.ts`
- `GET` — list configured webhooks for org
- `POST` — register: `{ url, events: ["anomaly.detected", "quota.exceeded", "user.created"] }`
- `DELETE` — remove by ID
- `POST /api/v1/webhooks/test` — fires a test payload to the URL right now

#### [MODIFY] Python anomaly detection service
- After detecting anomaly → call `POST /api/internal/webhook-fire` on Node service
- Or: Node service polls anomalies endpoint every 30s and fires webhooks itself

#### [MODIFY] `src/app/(app)/dashboard/page.tsx` — Settings → Webhooks sub-tab
- Input: Webhook URL
- Checkbox list of events to subscribe to
- "Send Test Event" button
- Delivery log table (last 10 attempts, status code, timestamp)

---

## Feature 4: JavaScript SDK 🔁 VIRAL LOOP

**What it is:** Developer installs `npm install goatsaas` and drops 3 lines in their Node app:

```javascript
import GoatSaaS from 'goatsaas';
const goat = new GoatSaaS({ apiKey: 'gsk_live_abc123' });

// Track any event from their app
await goat.track('order.completed', { amount: 150, country: 'US' });
await goat.query('show top 10 customers by revenue last 7 days');
await goat.alert('payment gateway latency spike');
```

Every developer who installs the SDK **becomes a paying customer** — their production app is now calling your API. Switching costs are enormous.

### Files to create

#### [NEW] `packages/sdk/` (new workspace package)
- `src/index.ts` — main GoatSaaS class
- `src/track.ts` — event tracking with batching + flush
- `src/query.ts` — NL→SQL wrapper
- `src/types.ts` — TypeScript types for all responses
- `package.json` — publishable to npm as `goatsaas`
- `README.md` — copy-paste quickstart

#### [NEW] `src/app/(marketing)/docs/page.tsx`
- Public docs page at `/docs`
- Quickstart with code blocks (curl + Node.js + Python)
- API reference table (all endpoints, params, response shapes)
- Link from landing page and sidebar

---

## What to skip (for now)

| Feature | Why skip |
|---|---|
| Stripe billing | You need users willing to pay first. API keys prove value. |
| Real Postgres migration | In-memory is fine until you have 100+ real users. |
| Mobile SDK | Web/Node SDK first. Prove the pattern. |

---

## Verification Plan

### After Feature 1 (API Keys)
- Generate a key in the UI
- Call `curl -X POST localhost:3000/api/v1/nl-query -H "Authorization: Bearer gsk_live_..."` from terminal
- See SQL result in the response
- Check audit log shows the API call

### After Feature 2 (DB Connector)  
- Connect to any real Postgres database
- Run NL query — confirm it queries the external DB not the demo one
- Verify table list shows in settings

### After Feature 3 (Webhooks)
- Register a webhook URL (use https://webhook.site for testing)
- Trigger an anomaly via the admin panel simulate button
- Confirm POST arrives at webhook.site with correct payload + HMAC signature

### After Feature 4 (SDK)
- `npm install ./packages/sdk` locally
- Run the 3-line quickstart
- Confirm event appears in dashboard

---

## Open Questions

> [!IMPORTANT]
> **Which database driver to use for external DB?** The `pg` (node-postgres) package is the standard choice. Do you also want MySQL support (`mysql2`)? Limiting to Postgres covers 80% of SaaS use cases.

> [!IMPORTANT]  
> **SDK distribution:** Do you want to publish to npm immediately under `goatsaas`, or keep it as a local package first and only publish after it's tested?

> [!NOTE]
> **Webhook signing secret:** Industry standard is HMAC-SHA256 (same as Stripe/GitHub). The secret is shown once at webhook creation. Should we also support a simple Bearer token mode for simpler integrations?
