# goatsaas

Official JavaScript/TypeScript SDK for [GOATSaaS](https://goatsaas.com) — AI-powered developer telemetry platform.

## Installation

```bash
npm install goatsaas
```

## Quick Start

```ts
import GoatSaaS from 'goatsaas';

const client = new GoatSaaS({
  apiKey: 'gsk_live_...',           // from Settings → API Keys
  baseUrl: 'https://goatsaas.com',  // optional, defaults to production
});

// NL → SQL: translate plain English to SQL
const { sql } = await client.query('show top 10 users by revenue last month');
console.log(sql);
// → SELECT u.id, u.email, SUM(o.amount) AS revenue ...

// Run SQL against your connected Postgres database
const { rows, columns } = await client.sql('SELECT plan, COUNT(*) FROM users GROUP BY plan');

// Get system anomaly alerts
const { anomalies } = await client.alerts();
anomalies.forEach(a => console.log(a.message, a.z_score));

// Track custom events (auto-batched)
client.track('user.signup', { plan: 'pro', country: 'US' });
client.track('checkout.completed', { amount: 79, currency: 'USD' });

// Flush before process exit
process.on('beforeExit', () => client.flush());
```

## API Reference

### `new GoatSaaS(config)`

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `apiKey` | `string` | ✓ | API key from Settings → API Keys |
| `baseUrl` | `string` | | Defaults to `https://goatsaas.com` |
| `timeoutMs` | `number` | | Request timeout. Default: `30000` |

---

### `client.query(query, model?)`

Translates a natural-language question into SQL using AI.

```ts
const result = await client.query('show all users who signed up this week');
// result.sql → the generated SQL
// result.model → "groq" | "gemini" | "ollama"
```

---

### `client.sql(sql)`

Runs a raw SQL query against your connected external Postgres database (Settings → Database).
Only `SELECT` queries are permitted — `DROP`, `INSERT`, etc. are blocked server-side.

```ts
const { rows, columns, rowCount, durationMs } = await client.sql(
  'SELECT country, SUM(amount) FROM orders GROUP BY country ORDER BY 2 DESC'
);
```

---

### `client.alerts()`

Fetches the latest system anomaly alerts for your organization.

```ts
const { anomalies } = await client.alerts();
// anomalies[].message → human-readable description
// anomalies[].z_score → statistical severity (> threshold = anomaly)
// anomalies[].resolved → boolean
```

---

### `client.track(event, properties?)`

Sends a custom event. Calls are **auto-batched** — events accumulate in memory and flush every 1s or every 10 events (whichever comes first). Completely non-blocking.

```ts
client.track('checkout.completed', { amount: 79, plan: 'pro', country: 'US' });
```

---

### `client.flush()`

Synchronously flush all pending `track()` events. Call before process termination.

---

## Authentication

All requests authenticate via a `Bearer` token:

```
Authorization: Bearer gsk_live_...
```

Keys are generated in **Settings → API Keys**. Each key belongs to an org and inherits its plan limits.

---

## Error Handling

All methods throw `Error` with a descriptive message on API errors:

```ts
try {
  const { sql } = await client.query('...');
} catch (err) {
  console.error(err.message);
  // "GoatSaaS API error 429: quota exceeded for org free plan"
}
```

---

## Webhook Verification (Server-side)

When GOATSaaS sends webhooks to your endpoint, verify the signature:

```ts
import crypto from 'crypto';

function verifyWebhook(rawBody: string, signature: string, secret: string): boolean {
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

// In your Express handler:
app.post('/webhooks/goatsaas', (req, res) => {
  const sig = req.headers['x-goatsaas-signature'] as string;
  const rawBody = req.body.toString(); // make sure bodyParser returns raw buffer
  
  if (!verifyWebhook(rawBody, sig, process.env.GOATSAAS_WEBHOOK_SECRET!)) {
    return res.status(401).send('Invalid signature');
  }
  
  const { event, data } = JSON.parse(rawBody);
  console.log(`Event: ${event}`, data);
  res.sendStatus(200);
});
```

---

## License

MIT
