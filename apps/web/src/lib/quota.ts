/**
 * AI quota tracker — per-org, per-model, per-day.
 * Resets at midnight UTC. Enforces plan-based limits.
 */

export interface QuotaRecord {
  orgId: string;
  date: string;           // YYYY-MM-DD UTC
  groq: number;
  gemini: number;
  ollama: number;
  total: number;
}

// Per-plan daily limits (total AI calls/day)
export const PLAN_LIMITS: Record<string, number> = {
  free:       100,
  pro:        5000,
  enterprise: 50000,
};

// Storage: { [orgId:date]: QuotaRecord }
const QUOTA_STORE: Record<string, QuotaRecord> = {};

function todayUtc(): string {
  return new Date().toISOString().split("T")[0];
}

function key(orgId: string, date: string) {
  return `${orgId}:${date}`;
}

function ensureRecord(orgId: string): QuotaRecord {
  const date = todayUtc();
  const k = key(orgId, date);
  if (!QUOTA_STORE[k]) {
    QUOTA_STORE[k] = { orgId, date, groq: 0, gemini: 0, ollama: 0, total: 0 };
  }
  return QUOTA_STORE[k];
}

export function incrementQuota(orgId: string, model: "groq" | "gemini" | "ollama" = "groq"): QuotaRecord {
  const record = ensureRecord(orgId);
  record[model] += 1;
  record.total += 1;
  return record;
}

export function getOrgQuota(orgId: string, date?: string): QuotaRecord | null {
  const d = date ?? todayUtc();
  return QUOTA_STORE[key(orgId, d)] ?? { orgId, date: d, groq: 0, gemini: 0, ollama: 0, total: 0 };
}

export function getAllQuotaStats(days = 7): {
  byOrg: Record<string, QuotaRecord[]>;
  summary: { orgId: string; totalCalls: number; groq: number; gemini: number; ollama: number }[];
} {
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }

  const byOrg: Record<string, QuotaRecord[]> = {};
  for (const [k, record] of Object.entries(QUOTA_STORE)) {
    if (dates.includes(record.date)) {
      if (!byOrg[record.orgId]) byOrg[record.orgId] = [];
      byOrg[record.orgId].push(record);
    }
  }

  const summary = Object.entries(byOrg).map(([orgId, records]) => ({
    orgId,
    totalCalls: records.reduce((s, r) => s + r.total, 0),
    groq:       records.reduce((s, r) => s + r.groq, 0),
    gemini:     records.reduce((s, r) => s + r.gemini, 0),
    ollama:     records.reduce((s, r) => s + r.ollama, 0),
  })).sort((a, b) => b.totalCalls - a.totalCalls);

  return { byOrg, summary };
}

export function checkQuotaExceeded(orgId: string, plan: string): boolean {
  const record = getOrgQuota(orgId);
  if (!record) return false;
  return record.total >= (PLAN_LIMITS[plan] ?? PLAN_LIMITS.free);
}

// Seed realistic quota data for demo
(function seedQuota() {
  const orgs = [
    { id: "org_goatsaas", calls: { groq: 892, gemini: 314, ollama: 22 } },
    { id: "org_acme", calls: { groq: 3200, gemini: 900, ollama: 0 } },
    { id: "org_startup", calls: { groq: 87, gemini: 0, ollama: 45 } },
    { id: "org_tech", calls: { groq: 1240, gemini: 380, ollama: 0 } },
  ];

  const today = todayUtc();
  for (const org of orgs) {
    const k = key(org.id, today);
    QUOTA_STORE[k] = {
      orgId: org.id,
      date: today,
      groq: org.calls.groq,
      gemini: org.calls.gemini,
      ollama: org.calls.ollama,
      total: org.calls.groq + org.calls.gemini + org.calls.ollama,
    };
  }

  // Also seed yesterday
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];
  for (const org of orgs) {
    const k = key(org.id, yesterdayStr);
    const factor = 0.7 + Math.random() * 0.6;
    QUOTA_STORE[k] = {
      orgId: org.id,
      date: yesterdayStr,
      groq: Math.floor(org.calls.groq * factor),
      gemini: Math.floor(org.calls.gemini * factor),
      ollama: Math.floor(org.calls.ollama * factor),
      total: Math.floor((org.calls.groq + org.calls.gemini + org.calls.ollama) * factor),
    };
  }
})();
