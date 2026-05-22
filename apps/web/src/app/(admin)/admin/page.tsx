"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend
} from "recharts";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface UserRow {
  id: string; email: string; name: string; role: string;
  plan: string; avatar: string; createdAt: string; lastLogin: string; status: string;
}
interface AuditEntry {
  id: string; timestamp: string; userId: string; userEmail: string;
  action: string; target: string; ip: string; metadata?: Record<string, any>;
}
interface QuotaOrg {
  orgId: string; orgName: string; plan: string; totalCalls: number;
  groq: number; gemini: number; ollama: number; dailyLimit: number;
  usagePct: number; overLimit: boolean;
}
interface FlagData {
  flags: Record<string, Record<string, boolean>>;
  allFlags: string[];
  planDefaults: Record<string, Record<string, boolean>>;
  orgIds: string[];
}
interface EmailRecord {
  id: string; timestamp: string; subject: string; segment: string;
  recipientCount: number; status: string; body: string; sentBy: string;
}
interface KbDoc { id: number; name: string; file_type: string; chunks_count: number; created_at: string; }
interface KbStats { documents: number; total_chunks: number; last_indexed: string | null; }
interface AnomalyAlert { id: number; latency_ms: number; z_score: number; threshold_z: number; message: string; timestamp: string; resolved: boolean; }
interface TelStats { mean: number; std_dev: number; threshold: number; count: number; }

// ─── Constants ────────────────────────────────────────────────────────────────
const FLAG_LABELS: Record<string, string> = {
  ai_analyst: "🤖 AI Analyst",
  nl_sql: "⚡ NL→SQL",
  knowledge_base: "🧠 Knowledge Base",
  telemetry: "📡 Telemetry",
  cloud_map: "🌐 3D Cloud Map",
  rag_upload: "📤 RAG Upload",
  export_csv: "📥 CSV Export",
  export_pdf: "📄 PDF Export",
  api_keys: "🔑 API Keys",
  onboarding: "🎯 Onboarding",
};

const ACTION_COLORS: Record<string, string> = {
  "auth": "text-blue-400 bg-blue-500/10 border-blue-500/20",
  "settings": "text-amber-400 bg-amber-500/10 border-amber-500/20",
  "admin": "text-red-400 bg-red-500/10 border-red-500/20",
  "billing": "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  "ai": "text-purple-400 bg-purple-500/10 border-purple-500/20",
  "telemetry": "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
};

const topMetrics = [
  { label: "Total Users", value: "5,128", icon: "👥", color: "purple" },
  { label: "Pro Subscribers", value: "1,840", icon: "⭐", color: "blue" },
  { label: "Enterprise", value: "312", icon: "🏢", color: "amber" },
  { label: "MRR", value: "$112,400", icon: "💰", color: "emerald" },
  { label: "AI Calls Today", value: "13,360", icon: "🤖", color: "purple" },
  { label: "Avg Latency", value: "12ms", icon: "⚡", color: "blue" },
];

const systemHealth = [
  { name: "PostgreSQL (Neon)", status: "healthy", latency: "4ms", icon: "🗄️" },
  { name: "Python AI Service", status: "healthy", latency: "12ms", icon: "🤖" },
  { name: "Node.js Gateway", status: "healthy", latency: "2ms", icon: "⚙️" },
  { name: "Redis (Upstash)", status: "healthy", latency: "18ms", icon: "⚡" },
  { name: "ClickHouse Analytics", status: "healthy", latency: "8ms", icon: "📊" },
  { name: "Resend (Email)", status: "healthy", latency: "110ms", icon: "📧" },
];

// ─── Sub-panels ───────────────────────────────────────────────────────────────

function FeatureFlagsPanel() {
  const [data, setData] = useState<FlagData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/flags");
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggle = async (orgId: string, flagName: string, current: boolean) => {
    const key = `${orgId}:${flagName}`;
    setSaving(key);
    try {
      const res = await fetch("/api/admin/flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, flagName, value: !current }),
      });
      if (res.ok) {
        setData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            flags: { ...prev.flags, [orgId]: { ...prev.flags[orgId], [flagName]: !current } }
          };
        });
        setMsg(`✓ ${flagName} toggled for ${orgId}`);
        setTimeout(() => setMsg(""), 2500);
      }
    } catch {}
    setSaving(null);
  };

  const resetToPlan = async (orgId: string, plan: string) => {
    setSaving(`reset:${orgId}`);
    try {
      const res = await fetch("/api/admin/flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, plan }),
      });
      if (res.ok) {
        await load();
        setMsg(`✓ ${orgId} reset to ${plan} defaults`);
        setTimeout(() => setMsg(""), 2500);
      }
    } catch {}
    setSaving(null);
  };

  if (loading) return <div className="p-12 text-center text-zinc-500 animate-pulse">Loading feature flags…</div>;
  if (!data) return <div className="p-12 text-center text-zinc-500">Failed to load flags.</div>;

  return (
    <div className="space-y-6 fade-in-up max-w-6xl">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-white">Feature Flags 🚩</h1>
          <p className="text-zinc-400 text-sm mt-1">Toggle features on/off per tenant — no deploy required. Backed by Upstash Redis.</p>
        </div>
        {msg && (
          <div className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl fade-in-up">{msg}</div>
        )}
      </div>

      {/* Plan defaults reference */}
      <div className="glass rounded-2xl border border-zinc-800 overflow-hidden">
        <div className="p-5 border-b border-zinc-800">
          <h3 className="font-semibold text-white text-sm">Plan Default Permissions</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Reference matrix for what each plan gets by default.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-900/40">
              <tr>
                <th className="px-5 py-3 text-left text-xs text-zinc-500 uppercase font-medium">Feature</th>
                {["free", "pro", "enterprise"].map(p => (
                  <th key={p} className="px-5 py-3 text-center text-xs text-zinc-500 uppercase font-medium">{p}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {data.allFlags.map(flag => (
                <tr key={flag} className="table-row-hover">
                  <td className="px-5 py-2.5 text-zinc-300 font-mono text-xs">{FLAG_LABELS[flag] ?? flag}</td>
                  {["free", "pro", "enterprise"].map(plan => (
                    <td key={plan} className="px-5 py-2.5 text-center">
                      {data.planDefaults[plan]?.[flag]
                        ? <span className="text-emerald-400 text-lg">✓</span>
                        : <span className="text-zinc-700 text-lg">✗</span>
                      }
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-org flag overrides */}
      {data.orgIds.map(orgId => (
        <div key={orgId} className="glass rounded-2xl border border-zinc-800 overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-zinc-800">
            <div>
              <span className="font-semibold text-white">{orgId}</span>
              <span className="text-xs text-zinc-500 ml-3 font-mono">org flags override</span>
            </div>
            <div className="flex gap-2">
              {["free", "pro", "enterprise"].map(plan => (
                <button
                  key={plan}
                  onClick={() => resetToPlan(orgId, plan)}
                  disabled={saving === `reset:${orgId}`}
                  className="text-[10px] px-2.5 py-1 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-all disabled:opacity-50"
                >
                  Reset to {plan}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-0 divide-x divide-y divide-zinc-900">
            {data.allFlags.map(flag => {
              const enabled = data.flags[orgId]?.[flag] ?? false;
              const key = `${orgId}:${flag}`;
              const isSaving = saving === key;
              return (
                <label
                  key={flag}
                  className={`p-4 flex items-center gap-3 cursor-pointer transition-all hover:bg-zinc-900/50 ${enabled ? "bg-purple-500/5" : ""}`}
                >
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => toggle(orgId, flag, enabled)}
                      disabled={isSaving}
                      className="sr-only"
                    />
                    <div
                      onClick={() => toggle(orgId, flag, enabled)}
                      className={`w-8 h-4 rounded-full transition-all duration-300 cursor-pointer flex-shrink-0 ${enabled ? "bg-purple-500" : "bg-zinc-700"} ${isSaving ? "opacity-50" : ""}`}
                    >
                      <div className={`w-3 h-3 rounded-full bg-white m-0.5 transition-transform duration-300 ${enabled ? "translate-x-4" : "translate-x-0"}`} />
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-medium text-zinc-300 leading-tight">{FLAG_LABELS[flag] ?? flag}</div>
                    <div className={`text-[9px] font-mono mt-0.5 ${enabled ? "text-purple-400" : "text-zinc-600"}`}>
                      {enabled ? "enabled" : "disabled"}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function AuditLogPanel() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userFilter, setUserFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  const load = useCallback(async (off = 0) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (userFilter) params.set("userId", userFilter);
      if (actionFilter) params.set("action", actionFilter);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      params.set("limit", String(LIMIT));
      params.set("offset", String(off));

      const res = await fetch(`/api/admin/audit?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries);
        setTotal(data.total);
      }
    } catch {}
    setLoading(false);
  }, [userFilter, actionFilter, startDate, endDate]);

  useEffect(() => { setOffset(0); load(0); }, [load]);

  const exportCsv = () => {
    const headers = ["id", "timestamp", "userId", "userEmail", "action", "target", "ip"];
    const rows = entries.map(e => headers.map(h => (e as any)[h] ?? "").join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `audit_log_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const actionCategory = (action: string) => action.split(":")[0];

  return (
    <div className="space-y-6 fade-in-up max-w-6xl">
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Log 📋</h1>
          <p className="text-zinc-400 text-sm mt-1">Append-only, immutable. Every action by every user. SOC2 ready.</p>
        </div>
        <button onClick={exportCsv} className="text-xs btn-ghost border border-zinc-700 px-3 py-2 rounded-xl hover:text-white flex items-center gap-1.5">
          📥 Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="glass rounded-2xl border border-zinc-800 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] text-zinc-500 uppercase font-medium block mb-1">User / Email</label>
            <input
              value={userFilter}
              onChange={e => setUserFilter(e.target.value)}
              placeholder="Search by user…"
              className="input-dark w-full rounded-xl px-3 py-2 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 uppercase font-medium block mb-1">Action Type</label>
            <select
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              className="input-dark w-full rounded-xl px-3 py-2 text-xs bg-zinc-950"
            >
              <option value="">All actions</option>
              {["auth", "settings", "admin", "billing", "ai", "telemetry"].map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 uppercase font-medium block mb-1">From Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="input-dark w-full rounded-xl px-3 py-2 text-xs bg-zinc-950" />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 uppercase font-medium block mb-1">To Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="input-dark w-full rounded-xl px-3 py-2 text-xs bg-zinc-950" />
          </div>
        </div>
      </div>

      {/* Log Table */}
      <div className="glass rounded-2xl border border-zinc-800 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <span className="text-sm text-zinc-400 font-mono">{total.toLocaleString()} total entries</span>
          <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot inline-block" />
            Append-only • Immutable
          </div>
        </div>
        {loading ? (
          <div className="p-12 text-center text-zinc-500 animate-pulse">Loading audit entries…</div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center text-zinc-500">No entries match your filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-zinc-800 bg-zinc-900/40">
                <tr>
                  {["Timestamp", "User", "Action", "Target", "IP", "Metadata"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-zinc-500 uppercase font-medium tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {entries.map(entry => {
                  const cat = actionCategory(entry.action);
                  const colorClass = ACTION_COLORS[cat] ?? "text-zinc-400 bg-zinc-800 border-zinc-700";
                  return (
                    <tr key={entry.id} className="table-row-hover">
                      <td className="px-4 py-3 font-mono text-zinc-500 whitespace-nowrap">
                        {new Date(entry.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-zinc-300 font-medium truncate max-w-[120px]">{entry.userEmail.split("@")[0]}</div>
                        <div className="text-zinc-600 font-mono truncate max-w-[120px]">{entry.userId}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full border font-mono text-[10px] ${colorClass}`}>
                          {entry.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-400 truncate max-w-[150px]">{entry.target}</td>
                      <td className="px-4 py-3 font-mono text-zinc-600">{entry.ip}</td>
                      <td className="px-4 py-3 font-mono text-zinc-600 text-[10px] truncate max-w-[160px]">
                        {entry.metadata ? JSON.stringify(entry.metadata).slice(0, 60) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > LIMIT && (
          <div className="flex items-center justify-between p-4 border-t border-zinc-800">
            <span className="text-xs text-zinc-500">Page {Math.floor(offset / LIMIT) + 1} of {Math.ceil(total / LIMIT)}</span>
            <div className="flex gap-2">
              <button
                onClick={() => { const o = Math.max(0, offset - LIMIT); setOffset(o); load(o); }}
                disabled={offset === 0}
                className="text-xs px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white disabled:opacity-40 transition-all"
              >← Prev</button>
              <button
                onClick={() => { const o = offset + LIMIT; setOffset(o); load(o); }}
                disabled={offset + LIMIT >= total}
                className="text-xs px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white disabled:opacity-40 transition-all"
              >Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AIQuotaPanel() {
  const [summary, setSummary] = useState<QuotaOrg[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/quota").then(r => r.json()).then(d => {
      setSummary(d.summary ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const chartData = summary.map(o => ({
    name: o.orgName.length > 12 ? o.orgName.slice(0, 12) + "…" : o.orgName,
    groq: o.groq, gemini: o.gemini, ollama: o.ollama,
    total: o.totalCalls,
  }));

  return (
    <div className="space-y-6 fade-in-up max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white">AI Quota Dashboard 📊</h1>
        <p className="text-zinc-400 text-sm mt-1">Per-tenant AI call usage today. Prevent surprise bills before they happen.</p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-zinc-500 animate-pulse">Loading quota data…</div>
      ) : (
        <>
          {/* Bar chart */}
          <div className="glass rounded-2xl border border-zinc-800 p-6">
            <h3 className="font-semibold text-white mb-2">Calls by Organization (Today)</h3>
            <p className="text-xs text-zinc-500 mb-6">Stacked by model: Groq (purple) · Gemini (blue) · Ollama (emerald)</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <XAxis dataKey="name" stroke="#52525b" tick={{ fontSize: 11, fill: "#a1a1aa" }} />
                <YAxis stroke="#52525b" tick={{ fontSize: 11, fill: "#71717a" }} />
                <Tooltip
                  contentStyle={{ background: "#0a0a0f", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#fff", fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }} />
                <Bar dataKey="groq" stackId="a" fill="#7c3aed" radius={[0, 0, 0, 0]} name="Groq" />
                <Bar dataKey="gemini" stackId="a" fill="#2563eb" radius={[0, 0, 0, 0]} name="Gemini" />
                <Bar dataKey="ollama" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} name="Ollama" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Table */}
          <div className="glass rounded-2xl border border-zinc-800 overflow-hidden">
            <div className="p-5 border-b border-zinc-800">
              <h3 className="font-semibold text-white">Usage Details</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900/40">
                <tr>
                  {["Organization", "Plan", "Total Calls", "Groq", "Gemini", "Ollama", "Usage"].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs text-zinc-500 uppercase font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {summary.map(org => (
                  <tr key={org.orgId} className="table-row-hover">
                    <td className="px-5 py-4">
                      <div className="font-medium text-white">{org.orgName}</div>
                      <div className="text-xs text-zinc-500 font-mono">{org.orgId}</div>
                    </td>
                    <td className="px-5 py-4"><span className={`badge badge-${org.plan}`}>{org.plan}</span></td>
                    <td className="px-5 py-4 font-mono font-bold text-white">{org.totalCalls.toLocaleString()}</td>
                    <td className="px-5 py-4 font-mono text-purple-400">{org.groq.toLocaleString()}</td>
                    <td className="px-5 py-4 font-mono text-blue-400">{org.gemini.toLocaleString()}</td>
                    <td className="px-5 py-4 font-mono text-emerald-400">{org.ollama.toLocaleString()}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 bg-zinc-900 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${org.usagePct >= 100 ? "bg-red-500" : org.usagePct >= 80 ? "bg-amber-500" : "bg-purple-500"}`}
                            style={{ width: `${Math.min(100, org.usagePct)}%` }}
                          />
                        </div>
                        <span className={`text-xs font-mono ${org.usagePct >= 100 ? "text-red-400" : org.usagePct >= 80 ? "text-amber-400" : "text-zinc-400"}`}>
                          {org.usagePct}%
                        </span>
                        {org.overLimit && <span className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded font-mono">OVER LIMIT</span>}
                      </div>
                      <div className="text-[10px] text-zinc-600 mt-1 font-mono">{org.totalCalls.toLocaleString()} / {org.dailyLimit.toLocaleString()} limit</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function BroadcastEmailPanel() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [segment, setSegment] = useState<"all" | "free" | "pro" | "enterprise">("all");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [history, setHistory] = useState<EmailRecord[]>([]);
  const [tab, setTab] = useState<"compose" | "history">("compose");
  const [preview, setPreview] = useState(false);

  const loadHistory = async () => {
    try {
      const res = await fetch("/api/admin/email");
      if (res.ok) {
        const d = await res.json();
        setHistory(d.history ?? []);
      }
    } catch {}
  };

  useEffect(() => { loadHistory(); }, []);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;
    setSending(true); setStatus(null);
    try {
      const res = await fetch("/api/admin/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, segment }),
      });
      const d = await res.json();
      if (res.ok && d.success) {
        setStatus({ type: "success", msg: `✓ Sent to ${d.recipientCount} ${segment} users successfully!` });
        setSubject(""); setBody("");
        loadHistory();
        setTimeout(() => setStatus(null), 5000);
      } else {
        setStatus({ type: "error", msg: d.error ?? "Failed to send." });
      }
    } catch {
      setStatus({ type: "error", msg: "Connection error." });
    }
    setSending(false);
  };

  const SEGMENT_COUNTS: Record<string, string> = {
    all: "~5,128", free: "~2,976", pro: "~1,840", enterprise: "~312",
  };

  return (
    <div className="space-y-6 fade-in-up max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Broadcast Email 📧</h1>
        <p className="text-zinc-400 text-sm mt-1">Compose and send announcements to all users or a segment via Resend.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-zinc-900 rounded-xl border border-zinc-800 w-fit">
        {(["compose", "history"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${tab === t ? "bg-purple-600 text-white" : "text-zinc-400 hover:text-white"}`}>
            {t === "compose" ? "✏️ Compose" : "📜 Send History"}
          </button>
        ))}
      </div>

      {tab === "compose" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Compose form */}
          <form onSubmit={send} className="glass rounded-2xl border border-zinc-800 p-6 space-y-5">
            {status && (
              <div className={`p-3 rounded-xl border text-sm ${status.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
                {status.msg}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Audience Segment</label>
              <select value={segment} onChange={e => setSegment(e.target.value as any)}
                className="input-dark w-full rounded-xl px-3 py-2 text-sm bg-zinc-950">
                <option value="all">All Users ({SEGMENT_COUNTS.all})</option>
                <option value="free">Free Plan ({SEGMENT_COUNTS.free})</option>
                <option value="pro">Pro Plan ({SEGMENT_COUNTS.pro})</option>
                <option value="enterprise">Enterprise ({SEGMENT_COUNTS.enterprise})</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Subject Line</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} required
                className="input-dark w-full rounded-xl px-3 py-2 text-sm"
                placeholder="🚀 Announcing NL→SQL Direct Execution…" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Email Body</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} required rows={8}
                className="input-dark w-full rounded-xl px-3 py-2 text-sm resize-none"
                placeholder="Write your announcement here. Plain text or HTML is supported…" />
            </div>

            <div className="flex gap-3">
              <button type="submit" disabled={sending || !subject.trim() || !body.trim()}
                className="btn-primary flex-1 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50">
                {sending ? "Sending…" : `Send to ${SEGMENT_COUNTS[segment]} ${segment} users`}
              </button>
              <button type="button" onClick={() => setPreview(p => !p)}
                className="btn-ghost border border-zinc-700 px-4 rounded-xl text-sm hover:text-white">
                {preview ? "Hide" : "Preview"}
              </button>
            </div>

            <div className="text-xs text-zinc-600 font-mono">
              Powered by Resend · From: GOATSaaS &lt;noreply@goatsaas.com&gt;
            </div>
          </form>

          {/* Live preview */}
          <div className={`transition-all ${preview ? "opacity-100" : "opacity-30"}`}>
            <div className="glass rounded-2xl border border-zinc-800 overflow-hidden">
              <div className="p-4 border-b border-zinc-800 flex items-center gap-2">
                <span className="text-xs text-zinc-500 font-mono">Email Preview</span>
                <span className="text-[9px] px-1.5 py-0.5 bg-zinc-800 text-zinc-500 rounded font-mono">HTML</span>
              </div>
              <div className="p-6 bg-zinc-950 font-sans">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center font-black text-white text-sm">G</div>
                  <span className="font-bold text-white text-sm">GOAT<span className="text-purple-400">SaaS</span></span>
                </div>
                <h2 className="text-lg font-bold text-white mb-3">{subject || "Your subject line here…"}</h2>
                <p className="text-zinc-400 text-sm leading-relaxed whitespace-pre-wrap">{body || "Your email body will appear here…"}</p>
                <div className="mt-6 pt-4 border-t border-zinc-800 text-xs text-zinc-600">
                  You received this email because you're a {segment === "all" ? "" : segment + " plan "}GOATSaaS user. • <span className="text-purple-400 cursor-pointer">Unsubscribe</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="glass rounded-2xl border border-zinc-800 overflow-hidden">
          {history.length === 0 ? (
            <div className="p-12 text-center text-zinc-500">No emails sent yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900/40">
                <tr>
                  {["Sent At", "Subject", "Segment", "Recipients", "Status"].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs text-zinc-500 uppercase font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {history.map(em => (
                  <tr key={em.id} className="table-row-hover">
                    <td className="px-5 py-4 font-mono text-xs text-zinc-500">
                      {new Date(em.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-5 py-4 font-medium text-white">{em.subject}</td>
                    <td className="px-5 py-4"><span className={`badge badge-${em.segment === "all" ? "active" : em.segment}`}>{em.segment}</span></td>
                    <td className="px-5 py-4 font-mono text-zinc-300">{em.recipientCount.toLocaleString()}</td>
                    <td className="px-5 py-4">
                      <span className={`badge ${em.status === "sent" ? "badge-active" : "badge-suspended"}`}>{em.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function SystemHealthPanel({ anomalyConfig, setAnomalyConfig, savingConfig, saveAnomalyConfig }: any) {
  const grafanaUrl = process.env.NEXT_PUBLIC_GRAFANA_URL;

  return (
    <div className="space-y-6 fade-in-up max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white">System Health ❤️‍🔥</h1>
        <p className="text-zinc-400 text-sm mt-1">Real-time infrastructure status, Grafana metrics, and anomaly detector controls.</p>
      </div>

      {/* Grafana embed */}
      {grafanaUrl ? (
        <div className="glass rounded-2xl border border-zinc-800 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">Grafana Metrics</span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded">Live</span>
            </div>
            <a href={grafanaUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs text-zinc-400 hover:text-white transition-colors">Open in Grafana ↗</a>
          </div>
          <iframe src={grafanaUrl} className="w-full h-96 border-0" title="Grafana Dashboard" />
        </div>
      ) : (
        <div className="glass rounded-2xl border border-zinc-800 p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-lg flex-shrink-0">📊</div>
            <div>
              <h3 className="font-semibold text-white">Connect Grafana for Real Metrics</h3>
              <p className="text-sm text-zinc-400 mt-1">Self-host Grafana free on Railway → connect to your Neon Postgres + Upstash Redis → embed below.</p>
              <div className="mt-3 bg-zinc-950 rounded-xl p-4 border border-zinc-800 font-mono text-xs space-y-1.5 text-zinc-400">
                <div><span className="text-purple-400">1.</span> Deploy Grafana on Railway (free tier)</div>
                <div><span className="text-purple-400">2.</span> Add data sources: Neon Postgres + Upstash Redis</div>
                <div><span className="text-purple-400">3.</span> Import dashboard with p95 latency, error rate, DB pool</div>
                <div><span className="text-purple-400">4.</span> Set <span className="text-amber-400">NEXT_PUBLIC_GRAFANA_URL</span>=your-iframe-url in .env.local</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Service health cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {systemHealth.map((s, i) => (
          <div key={i} className={`glass rounded-2xl border p-5 flex items-center gap-4 ${s.status === "healthy" ? "border-emerald-500/10 bg-emerald-500/3" : "border-red-500/20 bg-red-500/5"}`}>
            <span className="text-2xl">{s.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-white text-sm">{s.name}</div>
              <div className="text-xs text-zinc-500 mt-0.5 font-mono">Latency: {s.latency}</div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${s.status === "healthy" ? "bg-emerald-400 pulse-dot" : "bg-red-400 animate-pulse"}`} />
              <span className={`text-xs font-mono ${s.status === "healthy" ? "text-emerald-400" : "text-red-400"}`}>{s.status}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Anomaly Detection Controls */}
      <div className="glass rounded-2xl border border-zinc-800 p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-semibold text-white">AI Anomaly Detection Sensitivity</h3>
            <p className="text-xs text-zinc-500 mt-1">Configure the Z-Score threshold for the background telemetry anomaly detector.</p>
          </div>
          <button onClick={saveAnomalyConfig} disabled={savingConfig} className="btn-primary px-4 py-2 rounded-xl text-sm font-medium transition-all">
            {savingConfig ? "Saving..." : "Apply Config"}
          </button>
        </div>
        <div className="space-y-4">
          <div className="flex justify-between items-end">
            <label className="text-sm font-medium text-white">Z-Score Threshold</label>
            <span className="text-xs font-mono bg-purple-600/20 text-purple-300 px-2 py-1 rounded border border-purple-500/30">
              {anomalyConfig.z_score_threshold.toFixed(1)} standard deviations
            </span>
          </div>
          <input type="range" min="1.0" max="6.0" step="0.1"
            value={anomalyConfig.z_score_threshold}
            onChange={(e) => setAnomalyConfig({ z_score_threshold: parseFloat(e.target.value) })}
            className="w-full accent-purple-500 bg-zinc-900 rounded-lg appearance-none h-2 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
            <span>Very Sensitive (Lots of alerts)</span>
            <span>Strict (Fewer alerts)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────
export default function AdminPage() {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [tab, setTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [anomalyConfig, setAnomalyConfig] = useState({ z_score_threshold: 3.0 });
  const [savingConfig, setSavingConfig] = useState(false);
  const [kbStats, setKbStats] = useState<KbStats>({ documents: 0, total_chunks: 0, last_indexed: null });
  const [kbDocs, setKbDocs] = useState<KbDoc[]>([]);
  const [kbLoading, setKbLoading] = useState(false);
  const [telStats, setTelStats] = useState<TelStats>({ mean: 0, std_dev: 0, threshold: 2.5, count: 0 });
  const [telAlerts, setTelAlerts] = useState<AnomalyAlert[]>([]);
  const [telLoading, setTelLoading] = useState(false);
  const [changingPlan, setChangingPlan] = useState<string | null>(null);

  const fetchKb = useCallback(async () => {
    setKbLoading(true);
    try {
      const [statsRes, docsRes] = await Promise.allSettled([
        fetch("http://localhost:8000/api/v1/rag/stats"),
        fetch("http://localhost:8000/api/v1/rag/documents"),
      ]);
      if (statsRes.status === "fulfilled" && statsRes.value.ok) setKbStats(await statsRes.value.json());
      if (docsRes.status === "fulfilled" && docsRes.value.ok) {
        const data = await docsRes.value.json();
        setKbDocs(Array.isArray(data) ? data : []);
      }
    } catch {}
    setKbLoading(false);
  }, []);

  const fetchTel = useCallback(async () => {
    setTelLoading(true);
    try {
      const [statsRes, alertsRes] = await Promise.allSettled([
        fetch("http://localhost:8000/api/v1/anomalies/stats"),
        fetch("http://localhost:8000/api/v1/anomalies/alerts"),
      ]);
      if (statsRes.status === "fulfilled" && statsRes.value.ok) setTelStats(await statsRes.value.json());
      if (alertsRes.status === "fulfilled" && alertsRes.value.ok) {
        const data = await alertsRes.value.json();
        setTelAlerts(Array.isArray(data) ? data : []);
      }
    } catch {}
    setTelLoading(false);
  }, []);

  useEffect(() => {
    if (tab === "overview" || tab === "knowledge") fetchKb();
    if (tab === "overview" || tab === "telemetry") fetchTel();
  }, [tab, fetchKb, fetchTel]);

  useEffect(() => {
    fetch("http://localhost:8000/api/v1/anomalies/config")
      .then(r => r.json())
      .then(d => setAnomalyConfig({ z_score_threshold: d.z_score_threshold }))
      .catch(() => {});
  }, []);

  const saveAnomalyConfig = async () => {
    setSavingConfig(true);
    try {
      await fetch("http://localhost:8000/api/v1/anomalies/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(anomalyConfig)
      });
      setActionMsg("Anomaly detection sensitivity updated!");
      setTimeout(() => setActionMsg(""), 3000);
    } catch {
      setActionMsg("Failed to update detection config");
      setTimeout(() => setActionMsg(""), 3000);
    }
    setSavingConfig(false);
  };

  useEffect(() => {
    fetch("/api/admin/users")
      .then(r => r.json())
      .then(d => { if (d.users) setUsers(d.users); })
      .finally(() => setLoadingUsers(false));
  }, []);

  const doAction = async (userId: string, action: "suspend" | "activate") => {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action }),
    });
    const data = await res.json();
    if (data.success) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: action === "suspend" ? "suspended" : "active" } : u));
      setActionMsg(`User ${action}d successfully.`);
      setTimeout(() => setActionMsg(""), 3000);
    }
  };

  const changePlan = async (userId: string, newPlan: string) => {
    setChangingPlan(userId);
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action: "changePlan", plan: newPlan }),
    });
    const data = await res.json();
    if (data.success) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, plan: newPlan } : u));
      setActionMsg(`Plan changed to ${newPlan}.`);
      setTimeout(() => setActionMsg(""), 3000);
    }
    setChangingPlan(null);
  };

  const filtered = users.filter(u =>
    (u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())) &&
    (planFilter ? u.plan === planFilter : true)
  );

  if (!user) return null;

  const NAV = [
    { id: "overview",  label: "Overview",       icon: "📊" },
    { id: "users",     label: "Users",           icon: "👥" },
    { id: "flags",     label: "Feature Flags",   icon: "🚩" },
    { id: "audit",     label: "Audit Log",       icon: "📋" },
    { id: "quota",     label: "AI Quota",        icon: "📊" },
    { id: "email",     label: "Broadcast Email", icon: "📧" },
    { id: "knowledge", label: "Knowledge Base",  icon: "🧠" },
    { id: "telemetry", label: "Telemetry",       icon: "📡" },
    { id: "system",    label: "System Health",   icon: "❤️" },
  ];

  return (
    <div className="min-h-screen flex" style={{ background: "#040408" }}>
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-zinc-900 flex flex-col p-4" style={{ background: "#040408" }}>
        <div className="flex items-center gap-2 mb-2 px-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-black text-base">🛡️</div>
          <div>
            <div className="text-sm font-bold text-white">Admin Cockpit</div>
            <div className="text-xs text-amber-400">Super Admin</div>
          </div>
        </div>
        <div className="px-2 mb-6">
          <div className="text-xs font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 truncate">{user.email}</div>
        </div>

        <nav className="space-y-0.5 flex-1">
          {NAV.map(n => (
            <button key={n.id} onClick={() => setTab(n.id)}
              className={`sidebar-item w-full text-left ${tab === n.id ? "active" : ""}`}>
              <span>{n.icon}</span><span>{n.label}</span>
            </button>
          ))}

        </nav>

        <div className="border-t border-zinc-900 pt-4 mt-4">
          <button onClick={logout} className="sidebar-item w-full text-left text-red-400">
            <span>🚪</span><span>Log out</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto p-8">
        {actionMsg && (
          <div className="fixed top-4 right-4 z-50 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl text-sm fade-in-up">{actionMsg}</div>
        )}

        {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
        {tab === "overview" && (
          <div className="space-y-8 fade-in-up max-w-6xl">
            <div>
              <h1 className="text-2xl font-bold text-white">Admin Overview 🛡️</h1>
              <p className="text-zinc-400 text-sm mt-1">Full visibility across your entire platform.</p>
            </div>
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
              {topMetrics.map((m, i) => (
                <div key={i} className={`glass glass-hover rounded-2xl border p-5 ${
                  m.color === "purple" ? "border-purple-500/20 bg-purple-500/5" :
                  m.color === "blue" ? "border-blue-500/20 bg-blue-500/5" :
                  m.color === "amber" ? "border-amber-500/20 bg-amber-500/5" :
                  "border-emerald-500/20 bg-emerald-500/5"
                }`}>
                  <div className="text-2xl mb-3">{m.icon}</div>
                  <div className="text-2xl font-bold text-white">{m.value}</div>
                  <div className="text-sm text-zinc-400 mt-1">{m.label}</div>
                </div>
              ))}
              <div className="glass glass-hover rounded-2xl border border-purple-500/20 bg-purple-500/5 p-5">
                <div className="text-2xl mb-3">🧠</div>
                <div className="text-2xl font-bold text-white">{kbStats.documents}</div>
                <div className="text-sm text-purple-400 mt-1">KB Documents</div>
                <div className="text-[10px] text-zinc-500 font-mono mt-1">{kbStats.total_chunks.toLocaleString()} chunks</div>
              </div>
              <div className={`glass glass-hover rounded-2xl border p-5 ${telAlerts.filter(a => !a.resolved).length > 0 ? "border-red-500/20 bg-red-500/5" : "border-emerald-500/20 bg-emerald-500/5"}`}>
                <div className="text-2xl mb-3">{telAlerts.filter(a => !a.resolved).length > 0 ? "⚠️" : "✅"}</div>
                <div className="text-2xl font-bold text-white">{telAlerts.filter(a => !a.resolved).length}</div>
                <div className={`text-sm mt-1 ${telAlerts.filter(a => !a.resolved).length > 0 ? "text-red-400" : "text-emerald-400"}`}>Active Anomalies</div>
                <div className="text-[10px] text-zinc-500 font-mono mt-1">μ {telStats.mean.toFixed(0)}ms avg latency</div>
              </div>
            </div>

            {/* Quick nav cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { tab: "flags", icon: "🚩", label: "Feature Flags", desc: "Toggle per-tenant" },
                { tab: "audit", icon: "📋", label: "Audit Log", desc: "All user actions" },
                { tab: "quota", icon: "📊", label: "AI Quota", desc: "Usage per tenant" },
                { tab: "email", icon: "📧", label: "Broadcast", desc: "Send to segments" },
              ].map(card => (
                <button key={card.tab} onClick={() => setTab(card.tab)}
                  className="glass glass-hover rounded-2xl border border-zinc-800 p-5 text-left transition-all hover:border-purple-500/30 hover:bg-purple-500/5">
                  <div className="text-2xl mb-3">{card.icon}</div>
                  <div className="font-semibold text-white text-sm">{card.label}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{card.desc}</div>
                </button>
              ))}
            </div>

            {/* Recent users */}
            <div className="glass rounded-2xl border border-zinc-800 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-white">Recent Users</h3>
                <button onClick={() => setTab("users")} className="text-xs text-purple-400 hover:text-purple-300 transition-colors">View all →</button>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b border-zinc-800">
                    <th className="pb-3 text-xs font-medium text-zinc-500">USER</th>
                    <th className="pb-3 text-xs font-medium text-zinc-500">PLAN</th>
                    <th className="pb-3 text-xs font-medium text-zinc-500">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {users.slice(0, 4).map(u => (
                    <tr key={u.id} className="border-b border-zinc-900 table-row-hover">
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-purple-600/40 flex items-center justify-center text-xs font-bold">{u.avatar}</div>
                          <div>
                            <div className="text-sm text-white">{u.name}</div>
                            <div className="text-xs text-zinc-500">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3"><span className={`badge badge-${u.plan}`}>{u.plan}</span></td>
                      <td className="py-3"><span className={`badge badge-${u.status}`}>{u.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── USERS ────────────────────────────────────────────────────────── */}
        {tab === "users" && (
          <div className="space-y-6 fade-in-up max-w-6xl">
            <div className="flex justify-between items-center flex-wrap gap-4">
              <div>
                <h1 className="text-2xl font-bold text-white">User Management 👥</h1>
                <p className="text-zinc-400 text-sm mt-1">{users.length} total users across all plans.</p>
              </div>
              <div className="flex gap-3">
                <input value={search} onChange={e => setSearch(e.target.value)}
                  className="input-dark rounded-xl px-4 py-2 text-sm w-52" placeholder="Search users…" />
                <select value={planFilter} onChange={e => setPlanFilter(e.target.value)}
                  className="input-dark rounded-xl px-3 py-2 text-sm bg-zinc-950">
                  <option value="">All plans</option>
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
            </div>

            <div className="glass rounded-2xl border border-zinc-800 overflow-hidden">
              <table className="w-full">
                <thead className="border-b border-zinc-800 bg-zinc-900/50">
                  <tr>
                    {["User", "Plan", "Role", "Status", "Last Login", "Actions"].map(h => (
                      <th key={h} className="px-6 py-4 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loadingUsers ? (
                    <tr><td colSpan={6} className="text-center py-12 text-zinc-500">Loading users…</td></tr>
                  ) : filtered.map(u => (
                    <tr key={u.id} className="border-b border-zinc-900 table-row-hover">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-xs font-bold">{u.avatar}</div>
                          <div>
                            <div className="text-sm font-medium text-white">{u.name}</div>
                            <div className="text-xs text-zinc-500">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={u.plan}
                          onChange={e => changePlan(u.id, e.target.value)}
                          disabled={changingPlan === u.id}
                          className={`text-xs font-mono px-2 py-1 rounded-lg border bg-zinc-950 cursor-pointer transition-all ${
                            u.plan === "enterprise" ? "border-amber-500/30 text-amber-400" :
                            u.plan === "pro" ? "border-purple-500/30 text-purple-400" :
                            "border-zinc-700 text-zinc-400"
                          }`}
                        >
                          <option value="free">free</option>
                          <option value="pro">pro</option>
                          <option value="enterprise">enterprise</option>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`badge ${u.role === "admin" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "badge-free"}`}>{u.role}</span>
                      </td>
                      <td className="px-6 py-4"><span className={`badge badge-${u.status}`}>{u.status}</span></td>
                      <td className="px-6 py-4 text-xs text-zinc-500 font-mono">{new Date(u.lastLogin).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          {u.role !== "admin" && (
                            <>
                              {u.status === "active" ? (
                                <button onClick={() => doAction(u.id, "suspend")}
                                  className="text-xs text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 px-3 py-1 rounded-lg transition-all">Suspend</button>
                              ) : (
                                <button onClick={() => doAction(u.id, "activate")}
                                  className="text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 hover:border-emerald-500/40 px-3 py-1 rounded-lg transition-all">Activate</button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "flags" && <FeatureFlagsPanel />}
        {tab === "audit" && <AuditLogPanel />}
        {tab === "quota" && <AIQuotaPanel />}
        {tab === "email" && <BroadcastEmailPanel />}

        {/* ── KNOWLEDGE BASE ──────────────────────────────────────────────── */}
        {tab === "knowledge" && (
          <div className="space-y-6 fade-in-up max-w-5xl">
            <div>
              <h1 className="text-2xl font-bold text-white">Knowledge Base 🧠</h1>
              <p className="text-zinc-400 text-sm mt-1">All indexed RAG documents across the platform.</p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Total Documents", value: kbStats.documents, icon: "📄", color: "purple" },
                { label: "Total Chunks", value: kbStats.total_chunks.toLocaleString(), icon: "🔍", color: "blue" },
                { label: "Last Indexed", value: kbStats.last_indexed ? new Date(kbStats.last_indexed).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—", icon: "🕐", color: "emerald" },
              ].map((s, i) => (
                <div key={i} className={`glass rounded-2xl p-5 border flex flex-col gap-1 ${s.color === "purple" ? "border-purple-500/20 bg-purple-500/5" : s.color === "blue" ? "border-blue-500/20 bg-blue-500/5" : "border-emerald-500/20 bg-emerald-500/5"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500 font-mono uppercase tracking-wider">{s.label}</span>
                    <span className="text-lg">{s.icon}</span>
                  </div>
                  <div className="text-2xl font-bold text-white font-mono">{s.value}</div>
                </div>
              ))}
            </div>
            <div className="glass rounded-2xl border border-zinc-800 overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-zinc-800">
                <h3 className="font-semibold text-white">Indexed Documents</h3>
                <button onClick={fetchKb} className="text-xs text-zinc-400 hover:text-white border border-zinc-800 px-3 py-1.5 rounded-lg transition-all">🔄 Refresh</button>
              </div>
              {kbLoading ? (
                <div className="p-10 text-center text-zinc-500 animate-pulse">Loading…</div>
              ) : kbDocs.length === 0 ? (
                <div className="p-10 text-center text-zinc-500">No documents indexed yet.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-zinc-800 bg-zinc-900/40">
                    <tr>{["Document", "Type", "Chunks", "Indexed On"].map(h => <th key={h} className="px-5 py-3 text-left text-[10px] font-medium text-zinc-500 uppercase">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900">
                    {kbDocs.map(doc => (
                      <tr key={doc.id} className="table-row-hover">
                        <td className="px-5 py-3"><div className="flex items-center gap-2"><span>{doc.file_type === "pdf" ? "📄" : "📃"}</span><span className="text-white font-medium truncate max-w-xs">{doc.name}</span></div></td>
                        <td className="px-5 py-3"><span className="text-[10px] font-mono px-2 py-0.5 rounded-full border uppercase bg-zinc-800 text-zinc-400 border-zinc-700">{doc.file_type}</span></td>
                        <td className="px-5 py-3 font-mono text-white">{doc.chunks_count.toLocaleString()}</td>
                        <td className="px-5 py-3 text-xs text-zinc-500 font-mono">{new Date(doc.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── TELEMETRY ────────────────────────────────────────────────────── */}
        {tab === "telemetry" && (
          <div className="space-y-6 fade-in-up max-w-5xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-white">Telemetry Overview 📡</h1>
                <p className="text-zinc-400 text-sm mt-1">Platform-wide latency statistics and anomaly summary.</p>
              </div>
              <button onClick={fetchTel} className="text-xs text-zinc-400 hover:text-white border border-zinc-800 px-3 py-1.5 rounded-lg transition-all flex-shrink-0">🔄 Refresh</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Mean Latency", value: `${telStats.mean.toFixed(1)} ms`, icon: "📊", color: "purple" },
                { label: "Std Deviation", value: `±${telStats.std_dev.toFixed(1)} ms`, icon: "📉", color: "blue" },
                { label: "Z-Threshold", value: telStats.threshold.toFixed(1), icon: "⚡", color: "amber" },
                { label: "Active Alerts", value: telAlerts.filter(a => !a.resolved).length, icon: "🚨", color: "red" },
              ].map((s, i) => (
                <div key={i} className={`glass rounded-2xl p-4 border flex flex-col gap-1 ${s.color === "purple" ? "border-purple-500/20 bg-purple-500/5" : s.color === "blue" ? "border-blue-500/20 bg-blue-500/5" : s.color === "amber" ? "border-amber-500/20 bg-amber-500/5" : "border-red-500/20 bg-red-500/5"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500 font-mono uppercase tracking-wider">{s.label}</span>
                    <span className="text-lg">{s.icon}</span>
                  </div>
                  <div className="text-xl font-bold text-white font-mono">{s.value}</div>
                </div>
              ))}
            </div>
            <div className="glass rounded-2xl border border-zinc-800 overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-zinc-800">
                <h3 className="font-semibold text-white">Recent Anomaly Alerts</h3>
                <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot inline-block" />Live
                </span>
              </div>
              {telLoading ? (
                <div className="p-10 text-center text-zinc-500 animate-pulse">Loading…</div>
              ) : telAlerts.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <div className="text-3xl opacity-30">✅</div>
                  <div className="text-sm text-zinc-500">No anomalies detected.</div>
                </div>
              ) : (
                <div className="divide-y divide-zinc-900">
                  {telAlerts.map(alert => (
                    <div key={alert.id} className="px-5 py-4 flex items-start gap-4 table-row-hover">
                      <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${alert.resolved ? "bg-emerald-400" : "bg-red-400 animate-pulse"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-white truncate">{alert.message}</span>
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border flex-shrink-0 ${alert.resolved ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
                            {alert.resolved ? "RESOLVED" : "ACTIVE"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-500 font-mono flex-wrap">
                          <span>z: <span className="text-red-400">{alert.z_score.toFixed(2)}</span></span>
                          <span>latency: <span className="text-amber-400">{alert.latency_ms}ms</span></span>
                          <span>{new Date(alert.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "system" && (
          <SystemHealthPanel
            anomalyConfig={anomalyConfig}
            setAnomalyConfig={setAnomalyConfig}
            savingConfig={savingConfig}
            saveAnomalyConfig={saveAnomalyConfig}
          />
        )}
      </main>
    </div>
  );
}