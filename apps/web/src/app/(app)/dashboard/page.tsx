"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";

const CloudMap3D = dynamic(() => import("@/components/CloudMap3D"), { ssr: false });
const KnowledgeBasePanel = dynamic(() => import("@/components/KnowledgeBasePanel"), { ssr: false });
const TelemetryPanel = dynamic(() => import("@/components/TelemetryPanel"), { ssr: false });
const OnboardingModal = dynamic(() => import("@/components/OnboardingModal"), { ssr: false });
const CrmPanel = dynamic(() => import("@/components/CrmPanel"), { ssr: false });
const LogisticsPanel = dynamic(() => import("@/components/LogisticsPanel"), { ssr: false });
const EcommercePanel = dynamic(() => import("@/components/EcommercePanel"), { ssr: false });
const SaasPanel = dynamic(() => import("@/components/SaasPanel"), { ssr: false });
const AudirePanel = dynamic(() => import("@/components/AudirePanel"), { ssr: false });
const ProjectsPanel = dynamic(() => import("@/components/ProjectsPanel"), { ssr: false });
const LlmSettingsPanel = dynamic(() => import("@/components/SettingsPanel"), { ssr: false });
const AdminPanel = dynamic(() => import("@/components/AdminPanel"), { ssr: false });
import GoatLoader from "@/components/GoatLoader";


// Dynamic stats are now fetched from the API


// Helper functions for CSV and PDF exports
const exportCsv = (filename: string, data: any[]) => {
  if (!data || !data.length) return;
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(","),
    ...data.map(row => 
      headers.map(field => {
        let cell = row[field] === null || row[field] === undefined ? "" : row[field];
        cell = typeof cell === "object" ? JSON.stringify(cell) : cell.toString();
        cell = cell.replace(/"/g, '""');
        if (cell.search(/("|,|\n)/g) >= 0) cell = `"${cell}"`;
        return cell;
      }).join(",")
    )
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const exportPdf = (title: string, columns: string[], data: any[]) => {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  
  const headers = columns.map(col => `<th style="text-align: left; padding: 12px 10px; background: #8b5cf6; color: white; border-bottom: 2px solid #e2e8f0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;">${col}</th>`).join('');
  const rows = data.map(row => 
    `<tr>${columns.map(col => `<td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">${row[col] === undefined || row[col] === null ? "" : typeof row[col] === 'object' ? JSON.stringify(row[col]) : row[col]}</td>`).join('')}</tr>`
  ).join('');

  printWindow.document.write(`
    <html>
      <head>
        <title>${title} Export</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; padding: 40px; background: #fff; }
          h1 { margin-bottom: 5px; color: #0f172a; font-size: 24px; font-weight: 700; }
          .meta { font-size: 12px; color: #64748b; margin-bottom: 30px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          @media print {
            button { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 20px;">
          <div>
            <h1>${title}</h1>
            <div class="meta">Exported on: ${new Date().toLocaleString()} | GOATSaaS Analytics Engine</div>
          </div>
          <button onclick="window.print();" style="padding: 10px 18px; background: #8b5cf6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px;">Print / Save as PDF</button>
        </div>
        <table>
          <thead>
            <tr>${headers}</tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 500);
          }
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

function StatCard({ stat }: { stat: { label: string; value: string; delta: string; up: boolean; icon: string; color: string } }) {
  const colorMap: Record<string, string> = {
    emerald: "border-emerald-500/20 bg-emerald-500/5",
    purple: "border-purple-500/20 bg-purple-500/5",
    blue: "border-blue-500/20 bg-blue-500/5",
    amber: "border-amber-500/20 bg-amber-500/5",
  };
  return (
    <div className={`glass glass-hover rounded-2xl p-6 border ${colorMap[stat.color]}`}>
      <div className="flex justify-between items-start mb-4">
        <span className="text-2xl">{stat.icon}</span>
        <span className={`text-xs font-mono px-2 py-1 rounded-full ${stat.up ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" : "text-red-400 bg-red-500/10"}`}>
          {stat.delta}
        </span>
      </div>
      <div className="text-2xl font-bold text-[var(--text-primary)] mb-1">{stat.value}</div>
      <div className="text-sm text-[var(--text-secondary)]">{stat.label}</div>
    </div>
  );
}

function AiChatPanel() {
  const { user } = useAuth();
  const orgId = user?.orgName || "default_org";
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hello! I'm your AI analyst. Ask me anything about your data, infrastructure, or business metrics." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("groq");
  const [useRag, setUseRag] = useState(false);
  const [ragStats, setRagStats] = useState({ documents: 0, total_chunks: 0 });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch("/api/ai-proxy/v1/rag/stats", { headers: { "X-Org-Id": orgId } }).then(r => r.json()).then(d => setRagStats(d)).catch(() => {});
  }, [orgId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      await fetch("/api/ai-proxy/v1/rag/upload", { method: "POST", headers: { "X-Org-Id": orgId }, body: fd });
      const stats = await fetch("/api/ai-proxy/v1/rag/stats", { headers: { "X-Org-Id": orgId } }).then(r => r.json());
      setRagStats(stats);
      setMessages(p => [...p, { role: "assistant", content: `Successfully indexed ${file.name} to the Knowledge Base.` }]);
    } catch {
      setMessages(p => [...p, { role: "assistant", content: `Failed to upload ${file.name}.` }]);
    }
    setUploading(false);
  };

  const MODELS = [
    { id: "groq", name: "Llama 3 (Groq)", cost: "$0.70/1M", latency: "Fast (~200ms)", badge: "⚡" },
    { id: "gemini", name: "Gemini Pro", cost: "$1.20/1M", latency: "Smart (~1.2s)", badge: "✨" },
    { id: "ollama", name: "Ollama Local", cost: "$0.00", latency: "Private (~1.5s)", badge: "🏠" },
  ];

  const send = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput("");
    setMessages(p => [...p, { role: "user", content: userMsg }]);
    setLoading(true);
    try {
      const res = await fetch("/api/ai-proxy/v1/ai/diagnostic-explain", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Org-Id": orgId },
        body: JSON.stringify({ 
          metric_name: userMsg, 
          current_value: 450, 
          previous_value: 1200, 
          date_range: "Today", 
          context_logs: userMsg,
          model: selectedModel,
          use_rag: useRag
        }),
      });
      if (!res.body) throw new Error();
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let reply = "";
      setMessages(p => [...p, { role: "assistant", content: "" }]);
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        chunk.split("\n").forEach(line => {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            try { const j = JSON.parse(data); if (j.choices?.[0]?.delta?.content) { reply += j.choices[0].delta.content; setMessages(p => [...p.slice(0, -1), { role: "assistant", content: reply }]); } }
            catch { if (!data.startsWith("{") && data !== "[DONE]") { reply += data + "\n"; setMessages(p => [...p.slice(0, -1), { role: "assistant", content: reply }]); } }
          }
        });
      }
    } catch {
      setMessages(p => [...p, { role: "assistant", content: "⚠ AI service offline. Start the Python server on port 8000." }]);
    }
    setLoading(false);
  };

  return (
    <div className="glass rounded-2xl border border-[var(--border)] flex flex-col h-96">
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-sm text-white">🤖</div>
          <div>
            <div className="text-sm font-semibold text-[var(--text-primary)] font-sans">AI Business Analyst</div>
            <div className="text-xs text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot inline-block" />
              {MODELS.find(m => m.id === selectedModel)?.name} · Online
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select 
            value={selectedModel} 
            onChange={e => setSelectedModel(e.target.value)}
            className="text-xs bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-1.5 text-[var(--text-secondary)] focus:outline-none focus:border-purple-500 font-sans"
          >
            {MODELS.map(m => (
              <option key={m.id} value={m.id}>{m.badge} {m.name}</option>
            ))}
          </select>
          <div className="hidden sm:flex flex-col items-end text-[9px] font-mono text-[var(--text-muted)]">
            <div>Cost: {MODELS.find(m => m.id === selectedModel)?.cost}</div>
            <div>Latency: {MODELS.find(m => m.id === selectedModel)?.latency}</div>
          </div>
        </div>
      </div>
      <div className="bg-zinc-950 px-4 py-2 border-b border-[var(--border)] flex justify-between items-center text-xs">
        <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
          <input type="checkbox" checked={useRag} onChange={e => setUseRag(e.target.checked)} className="rounded border-[var(--border)] text-purple-600 focus:ring-purple-500 bg-zinc-900" />
          Use Knowledge Base RAG
        </label>
        <div className="flex items-center gap-3">
          <span className="text-zinc-500 font-mono text-[10px]">{ragStats.documents} docs / {ragStats.total_chunks} chunks</span>
          <label className={`cursor-pointer px-3 py-1 rounded bg-purple-600/20 text-purple-300 border border-purple-500/30 hover:bg-purple-600/30 transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            {uploading ? 'Uploading...' : 'Upload PDF'}
            <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0 ${m.role === "user" ? "bg-purple-650 text-white" : "bg-zinc-800 text-zinc-350"}`}>
              {m.role === "user" ? "U" : "AI"}
            </div>
            <div className={`max-w-[80%] text-sm px-3 py-2 rounded-xl leading-relaxed whitespace-pre-wrap ${m.role === "user" ? "bg-purple-600/20 border border-purple-500/20 text-[var(--text-primary)]" : "bg-zinc-900 border border-zinc-800 text-zinc-300"}`}>
              {m.content}{loading && i === messages.length - 1 && m.role === "assistant" && <span className="cursor-blink ml-0.5">▋</span>}
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 border-t border-[var(--border)] flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} className="input-dark flex-1 rounded-xl px-3 py-2 text-sm" placeholder="Ask about revenue, users, anomalies..." />
        <button onClick={send} disabled={loading || !input.trim()} className="btn-primary px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50">→</button>
      </div>
    </div>
  );
}

function NlSqlPanel() {
  const { user } = useAuth();
  const orgId = user?.orgName || "default_org";
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("groq");
  
  const MODELS = [
    { id: "groq", name: "Llama 3 (Groq)", cost: "$0.70/1M", latency: "Fast (~200ms)", badge: "⚡" },
    { id: "gemini", name: "Gemini Pro", cost: "$1.20/1M", latency: "Smart (~1.2s)", badge: "✨" },
    { id: "ollama", name: "Ollama Local", cost: "$0.00", latency: "Private (~1.5s)", badge: "🏠" },
  ];

  // Saved queries state
  const [savedQueries, setSavedQueries] = useState<{ id: string; name: string; query: string }[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("saved_queries");
      if (saved) return JSON.parse(saved);
    }
    return [
      { id: "q1", name: "Top users by revenue", query: "Show me top 10 users by revenue this month" },
      { id: "q2", name: "High latency events", query: "Select all telemetry events where latency is above 200ms" },
      { id: "q3", name: "Active users count", query: "Count active users grouped by plan type" }
    ];
  });

  const [newQueryName, setNewQueryName] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  useEffect(() => {
    localStorage.setItem("saved_queries", JSON.stringify(savedQueries));
  }, [savedQueries]);

  const run = async (queryText?: string) => {
    const activeQuery = queryText !== undefined ? queryText : query;
    if (!activeQuery.trim()) return;
    setLoading(true); setResult("");
    try {
      const res = await fetch("/api/ai-proxy/v1/ai/natural-sql", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Org-Id": orgId },
        body: JSON.stringify({ 
          natural_query: activeQuery, 
          database_schema_context: "users(id,email,plan,created_at,status), events(user_id,type,timestamp), revenue(user_id,amount,date), telemetry(user_id,endpoint,latency_ms,timestamp)",
          model: selectedModel
        }),
      });
      if (!res.body) throw new Error();
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        chunk.split("\n").forEach(line => {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            try { const j = JSON.parse(data); if (j.choices?.[0]?.delta?.content) setResult(p => p + j.choices[0].delta.content); }
            catch { if (!data.startsWith("{") && data !== "[DONE]") setResult(p => p + data + "\n"); }
          }
        });
      }
    } catch { setResult("-- ERROR: Python AI service offline."); }
    setLoading(false);
  };

  const handleSaveQuery = () => {
    if (!query.trim() || !newQueryName.trim()) return;
    const newSaved = {
      id: `q_${Date.now()}`,
      name: newQueryName,
      query: query
    };
    setSavedQueries(p => [...p, newSaved]);
    setNewQueryName("");
    setShowSaveDialog(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
      {/* Saved Queries sidebar */}
      <div className="lg:col-span-1 glass rounded-2xl border border-[var(--border)] p-4 flex flex-col justify-between h-[360px] lg:h-auto">
        <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
          <div className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
            <span>⭐</span> Saved Queries
          </div>
          <div className="text-[11px] text-[var(--text-secondary)]">Click to auto-fill and run search library.</div>
          
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
            {savedQueries.map(sq => (
              <div key={sq.id} className="group relative p-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] transition-all flex flex-col justify-between gap-1">
                <button 
                  onClick={() => { setQuery(sq.query); run(sq.query); }}
                  className="text-left w-full focus:outline-none"
                >
                  <div className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-purple-400 transition-colors truncate">{sq.name}</div>
                  <div className="text-[10px] text-[var(--text-muted)] font-mono truncate mt-0.5">{sq.query}</div>
                </button>
                <button 
                  onClick={() => setSavedQueries(p => p.filter(q => q.id !== sq.id))}
                  className="absolute top-2.5 right-2 text-[var(--text-muted)] hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete query"
                >
                  🗑️
                </button>
              </div>
            ))}
            {savedQueries.length === 0 && (
              <div className="text-center py-8 text-xs text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-xl">
                No saved queries.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Terminal panel */}
      <div className="lg:col-span-3 glass rounded-2xl border border-[var(--border)] flex flex-col justify-between">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <span className="text-lg">⚡</span>
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)] font-sans">NL → SQL Terminal</div>
              <div className="text-xs text-[var(--text-secondary)] font-sans">Type plain English, get production SQL</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select 
              value={selectedModel} 
              onChange={e => setSelectedModel(e.target.value)}
              className="text-xs bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-1.5 text-[var(--text-secondary)] focus:outline-none focus:border-purple-500 font-sans"
            >
              {MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.badge} {m.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row gap-2">
            <input 
              value={query} 
              onChange={e => setQuery(e.target.value)} 
              onKeyDown={e => e.key === "Enter" && run()} 
              className="input-dark flex-1 rounded-xl px-3 py-2 text-sm font-mono" 
              placeholder="Show me top 10 users by revenue this month..." 
            />
            <div className="flex gap-2">
              <button onClick={() => run()} disabled={loading} className="flex-1 sm:flex-none bg-purple-650 hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center min-w-[60px]">{loading ? "..." : "Run"}</button>
              {query.trim() && (
                <button onClick={() => setShowSaveDialog(true)} className="btn-ghost border border-[var(--border)] text-zinc-350 hover:text-white px-3 py-2 rounded-xl text-sm font-medium transition-all" title="Save query">
                  ⭐
                </button>
              )}
            </div>
          </div>

          {showSaveDialog && (
            <div className="p-3 bg-[var(--bg-card)] border border-purple-500/30 rounded-xl flex flex-col sm:flex-row gap-2 items-center fade-in-up">
              <input 
                value={newQueryName} 
                onChange={e => setNewQueryName(e.target.value)} 
                required 
                className="input-dark flex-1 rounded-lg px-2.5 py-1 text-xs" 
                placeholder="Give your query a name (e.g. Latency Spike Analysis)" 
              />
              <button onClick={handleSaveQuery} disabled={!newQueryName.trim()} className="btn-primary text-xs px-3 py-1 rounded-lg disabled:opacity-50">Save</button>
              <button onClick={() => { setShowSaveDialog(false); setNewQueryName(""); }} className="btn-ghost text-xs px-3 py-1 rounded-lg">Cancel</button>
            </div>
          )}

          <div className="bg-zinc-950 rounded-xl p-4 flex-1 min-h-[140px] font-mono text-xs border border-zinc-900 flex flex-col">
            {result ? (
              <pre className="text-emerald-300 whitespace-pre-wrap flex-1 overflow-auto">{result}</pre>
            ) : (
              <span className="text-zinc-600 flex-1">-- SQL output appears here...</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: "📊" },
  { id: "saas", label: "SaaS Management", icon: "💳" },
  { id: "ecommerce", label: "eCommerce", icon: "🛒" },
  { id: "crm", label: "CRM Pipeline", icon: "🤝" },
  { id: "ai", label: "AI Analyst", icon: "🤖" },
  { id: "sql", label: "NL→SQL", icon: "⚡" },
  { id: "settings", label: "Settings", icon: "⚙️" },
  { id: "admin", label: "Admin Panel", icon: "👑" },
];

function PasswordChangeForm() {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) { setStatus({ type: "error", msg: "Passwords don't match." }); return; }
    if (newPw.length < 8) { setStatus({ type: "error", msg: "Must be at least 8 characters." }); return; }
    setLoading(true); setStatus(null);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const d = await res.json();
      if (res.ok) {
        setStatus({ type: "success", msg: "✓ Password updated successfully!" });
        setCurrentPw(""); setNewPw(""); setConfirmPw("");
      } else {
        setStatus({ type: "error", msg: d.error ?? "Failed to update password." });
      }
    } catch { setStatus({ type: "error", msg: "Connection error." }); }
    setLoading(false);
  };

  return (
    <form onSubmit={submit} className="space-y-3 max-w-lg">
      {status && (
        <div className={`p-3 rounded-xl border text-sm ${status.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
          {status.msg}
        </div>
      )}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-zinc-300">Current Password</label>
        <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} required
          className="input-dark w-full rounded-xl px-3 py-2 text-sm" placeholder="Your current password" />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-zinc-300">New Password</label>
        <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} required minLength={8}
          className="input-dark w-full rounded-xl px-3 py-2 text-sm" placeholder="Min. 8 characters" />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-zinc-300">Confirm New Password</label>
        <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required
          className={`input-dark w-full rounded-xl px-3 py-2 text-sm ${confirmPw && confirmPw !== newPw ? "border-red-500/40" : ""}`}
          placeholder="Repeat new password" />
      </div>
      <button type="submit" disabled={loading}
        className="btn-primary px-5 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50">
        {loading ? "Updating…" : "Update Password"}
      </button>
    </form>
  );
}

function SettingsPanel() {

  const { user, refreshUser, logout } = useAuth();
  const [subTab, setSubTab] = useState("profile");
  
  // Profile state
  const [profileName, setProfileName] = useState(user?.name || "");
  const [profileEmail, setProfileEmail] = useState(user?.email || "");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileStatus, setProfileStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Organization/Team state
  const [orgData, setOrgData] = useState<{ orgName: string; members: any[]; invites: any[] } | null>(null);
  const [orgNameInput, setOrgNameInput] = useState("");
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgStatus, setOrgStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  
  // Invite state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // ── Real API Keys state ────────────────────────────────────────────────────
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyGenerating, setNewKeyGenerating] = useState(false);
  const [revealedKey, setRevealedKey] = useState<{ rawKey: string; keyId: string } | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [apiKeyStatus, setApiKeyStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // ── DB Connector state ─────────────────────────────────────────────────────
  const [dbUri, setDbUri] = useState("");
  const [dbLabel, setDbLabel] = useState("");
  const [dbTesting, setDbTesting] = useState(false);
  const [dbStatus, setDbStatus] = useState<{ type: "success" | "error"; message: string; tables?: string[] } | null>(null);
  const [dbConnection, setDbConnection] = useState<any>(null);
  const [dbLoading, setDbLoading] = useState(false);

  // ── Webhooks state ─────────────────────────────────────────────────────────
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [deliveryLog, setDeliveryLog] = useState<any[]>([]);
  const [supportedEvents, setSupportedEvents] = useState<string[]>([]);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookLabel, setWebhookLabel] = useState("");
  const [webhookEvents, setWebhookEvents] = useState<string[]>(["anomaly.detected"]);
  const [webhookAdding, setWebhookAdding] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState<{ id: string; secret: string } | null>(null);
  const [webhookStatus, setWebhookStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [webhookLoading, setWebhooksLoading] = useState(false);
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);

  // Danger zone confirms
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [deleteAccountConfirmText, setDeleteAccountConfirmText] = useState("");
  const [confirmDeleteWorkspace, setConfirmDeleteWorkspace] = useState(false);
  const [deleteWorkspaceConfirmText, setDeleteWorkspaceConfirmText] = useState("");

  const handleUpgrade = async (planId: string) => {
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: planId })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Failed to start checkout.");
      }
    } catch {
      alert("Failed to connect to billing service.");
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("success=true")) {
      alert("Billing updated successfully!");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (subTab === "team") fetchOrgData();
    if (subTab === "apiKeys") fetchApiKeys();
    if (subTab === "database") fetchDbConnection();
    if (subTab === "webhooks") fetchWebhooks();
  }, [subTab]);

  const fetchOrgData = async () => {
    try {
      const res = await fetch("/api/settings/organization");
      const data = await res.json();
      if (res.ok) { setOrgData(data); setOrgNameInput(data.orgName); }
    } catch (e) { console.error(e); }
  };

  // ── API Key handlers ────────────────────────────────────────────────────────
  const fetchApiKeys = async () => {
    setApiKeysLoading(true);
    try {
      const res = await fetch("/api/v1/keys");
      const data = await res.json();
      if (res.ok) setApiKeys(data.keys || []);
    } catch { /* offline */ }
    setApiKeysLoading(false);
  };

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setNewKeyGenerating(true);
    setApiKeyStatus(null);
    setRevealedKey(null);
    try {
      const res = await fetch("/api/v1/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setRevealedKey({ rawKey: data.rawKey, keyId: data.record?.id || data.key?.id });
        setNewKeyName("");
        await fetchApiKeys();
        setApiKeyStatus({ type: "success", message: "Key generated. Copy it now — it won't be shown again." });
      } else {
        setApiKeyStatus({ type: "error", message: data.error || "Failed to generate key." });
      }
    } catch {
      setApiKeyStatus({ type: "error", message: "Connection error." });
    }
    setNewKeyGenerating(false);
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm("Revoke this API key? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/v1/keys?id=${encodeURIComponent(keyId)}`, { method: "DELETE" });
      if (res.ok) {
        setApiKeys(p => p.filter(k => k.id !== keyId));
        if (revealedKey?.keyId === keyId) setRevealedKey(null);
      }
    } catch { /* offline */ }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  // ── DB Connector handlers ───────────────────────────────────────────────────
  const fetchDbConnection = async () => {
    setDbLoading(true);
    try {
      const res = await fetch("/api/v1/db/connect");
      const data = await res.json();
      if (res.ok) setDbConnection(data.connection);
    } catch { /* offline */ }
    setDbLoading(false);
  };

  const handleTestConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbUri.trim()) return;
    setDbTesting(true);
    setDbStatus(null);
    try {
      const res = await fetch("/api/v1/db/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uri: dbUri.trim(), label: dbLabel.trim() || "External Database" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDbStatus({ type: "success", message: data.message, tables: data.tables });
        setDbUri("");
        setDbLabel("");
        await fetchDbConnection();
      } else {
        setDbStatus({ type: "error", message: data.error || "Connection failed." });
      }
    } catch {
      setDbStatus({ type: "error", message: "Could not reach server." });
    }
    setDbTesting(false);
  };

  const handleDisconnectDb = async () => {
    if (!confirm("Disconnect your database? NL→SQL queries will revert to the demo database.")) return;
    try {
      await fetch("/api/v1/db/connect", { method: "DELETE" });
      setDbConnection(null);
      setDbStatus(null);
    } catch { /* offline */ }
  };

  // ── Webhook handlers ────────────────────────────────────────────────────────
  const fetchWebhooks = async () => {
    setWebhooksLoading(true);
    try {
      const res = await fetch("/api/v1/webhooks");
      const data = await res.json();
      if (res.ok) {
        setWebhooks(data.webhooks || []);
        setDeliveryLog(data.deliveryLog || []);
        setSupportedEvents(data.supportedEvents || []);
      }
    } catch { /* offline */ }
    setWebhooksLoading(false);
  };

  const handleAddWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.trim() || webhookEvents.length === 0) return;
    setWebhookAdding(true);
    setWebhookStatus(null);
    setWebhookSecret(null);
    try {
      const res = await fetch("/api/v1/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl.trim(), events: webhookEvents, label: webhookLabel.trim() || webhookUrl.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setWebhookSecret({ id: data.webhook.id, secret: data.signingSecret });
        setWebhookUrl("");
        setWebhookLabel("");
        setWebhookEvents(["anomaly.detected"]);
        setWebhookStatus({ type: "success", message: "Webhook registered! Store the signing secret now — it won't be shown again." });
        await fetchWebhooks();
      } else {
        setWebhookStatus({ type: "error", message: data.error || "Failed to register webhook." });
      }
    } catch {
      setWebhookStatus({ type: "error", message: "Connection error." });
    }
    setWebhookAdding(false);
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    if (!confirm("Delete this webhook?")) return;
    try {
      const res = await fetch("/api/v1/webhooks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookId }),
      });
      if (res.ok) {
        setWebhooks(p => p.filter(w => w.id !== webhookId));
        if (webhookSecret?.id === webhookId) setWebhookSecret(null);
      }
    } catch { /* offline */ }
  };

  const handleTestWebhook = async (webhookId: string) => {
    setTestingWebhookId(webhookId);
    try {
      const res = await fetch("/api/v1/webhooks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookId }),
      });
      const data = await res.json();
      if (data.success) {
        setWebhookStatus({ type: "success", message: `Test ping delivered! HTTP ${data.delivery?.httpStatus ?? "200"} in ${data.delivery?.durationMs ?? "?"}ms` });
      } else {
        setWebhookStatus({ type: "error", message: `Test failed: ${data.delivery?.error || data.error}` });
      }
      await fetchWebhooks();
    } catch {
      setWebhookStatus({ type: "error", message: "Could not send test ping." });
    }
    setTestingWebhookId(null);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileStatus(null);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profileName, email: profileEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setProfileStatus({ type: "success", message: "Profile updated successfully!" });
        await refreshUser();
      } else {
        setProfileStatus({ type: "error", message: data.error || "Failed to update profile." });
      }
    } catch {
      setProfileStatus({ type: "error", message: "Connection error." });
    }
    setProfileLoading(false);
  };

  const handleUpdateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrgLoading(true);
    setOrgStatus(null);
    try {
      const res = await fetch("/api/settings/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName: orgNameInput }),
      });
      const data = await res.json();
      if (res.ok) {
        setOrgStatus({ type: "success", message: "Workspace updated successfully!" });
        await refreshUser();
        fetchOrgData();
      } else {
        setOrgStatus({ type: "error", message: data.error || "Failed to update workspace." });
      }
    } catch {
      setOrgStatus({ type: "error", message: "Connection error." });
    }
    setOrgLoading(false);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    setInviteStatus(null);
    try {
      const res = await fetch("/api/settings/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (res.ok) {
        setInviteStatus({ type: "success", message: `Invitation sent to ${inviteEmail}!` });
        setInviteEmail("");
        fetchOrgData();
      } else {
        setInviteStatus({ type: "error", message: data.error || "Failed to send invitation." });
      }
    } catch {
      setInviteStatus({ type: "error", message: "Connection error." });
    }
    setInviteLoading(false);
  };

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      const res = await fetch("/api/settings/invites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId }),
      });
      if (res.ok) fetchOrgData();
    } catch (e) { console.error(e); }
  };

  const handleDeleteAccountAction = () => {
    if (deleteAccountConfirmText !== "DELETE") return;
    alert("Simulated Account Deletion: Logging you out and redirecting to signup.");
    logout();
  };

  const handleDeleteWorkspaceAction = () => {
    if (deleteWorkspaceConfirmText !== (user?.orgName || "DELETE")) return;
    alert(`Simulated Workspace Dissolution: Workspace "${user?.orgName}" dissolved successfully.`);
    if (user) { user.orgName = undefined; user.orgRole = undefined; }
    refreshUser();
    window.location.reload();
  };

  const isOwnerOrAdmin = user?.orgRole === "owner" || user?.orgRole === "admin";

  return (
    <div className="space-y-6 fade-in-up font-sans">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Account Settings ⚙️</h1>
        <p className="text-[var(--text-secondary)] text-sm mt-1">Manage your profile, API keys, database connections, webhooks, and team.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        {/* Settings Navigation */}
        <div className="glass rounded-2xl border border-[var(--border)] p-2 flex flex-col gap-1 md:col-span-1">
          <button onClick={() => setSubTab("profile")} className={`sidebar-item w-full text-left ${subTab === "profile" ? "active" : ""}`}>
            👤 Profile
          </button>
          <button onClick={() => setSubTab("team")} className={`sidebar-item w-full text-left ${subTab === "team" ? "active" : ""}`}>
            👥 Team Workspace
          </button>
          <button onClick={() => setSubTab("notifications")} className={`sidebar-item w-full text-left ${subTab === "notifications" ? "active" : ""}`}>
            🔔 Notifications
          </button>
          {isOwnerOrAdmin && (
            <>
              <button onClick={() => setSubTab("billing")} className={`sidebar-item w-full text-left ${subTab === "billing" ? "active" : ""}`}>
                💳 Billing & Plan
              </button>
              <div className="my-1 border-t border-[var(--border)] opacity-40" />
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Developer</div>
              <button onClick={() => setSubTab("apiKeys")} className={`sidebar-item w-full text-left ${subTab === "apiKeys" ? "active" : ""}`}>
                🔑 API Keys
              </button>
              <button onClick={() => setSubTab("llm")} className={`sidebar-item w-full text-left ${subTab === "llm" ? "active" : ""}`}>
                🧠 LLM Provider
              </button>
              <button onClick={() => setSubTab("database")} className={`sidebar-item w-full text-left ${subTab === "database" ? "active" : ""}`}>
                🗄️ Database
              </button>
              <button onClick={() => setSubTab("webhooks")} className={`sidebar-item w-full text-left ${subTab === "webhooks" ? "active" : ""}`}>
                🔗 Webhooks
              </button>
              <a href="/docs" target="_blank" rel="noopener noreferrer" className="sidebar-item w-full text-left text-purple-400">
                📖 API Docs
              </a>
            </>
          )}
        </div>

        {/* Settings Content */}
        <div className="md:col-span-3 space-y-6">

          {/* PROFILE SUB-TAB */}
          {subTab === "profile" && (
            <div className="glass rounded-2xl border border-[var(--border)] p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">My Profile</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1">Update your personal account credentials.</p>
              </div>

              {profileStatus && (
                <div className={`p-3 rounded-xl border text-sm ${profileStatus.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
                  {profileStatus.message}
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-4 max-w-lg">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Full Name</label>
                  <input value={profileName} onChange={e => setProfileName(e.target.value)} required className="input-dark w-full rounded-xl px-3 py-2 text-sm" placeholder="Rishabh Dev" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Email Address</label>
                  <input type="email" value={profileEmail} onChange={e => setProfileEmail(e.target.value)} required className="input-dark w-full rounded-xl px-3 py-2 text-sm" placeholder="email@example.com" />
                </div>
                <button type="submit" disabled={profileLoading} className="btn-primary px-5 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50">
                  {profileLoading ? "Saving..." : "Save Profile"}
                </button>
              </form>

              <hr className="border-[var(--border)] my-6" />
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-[var(--text-primary)]">Change Password 🔒</h4>
                  <p className="text-xs text-[var(--text-muted)] mt-1">Update your account password. Min 8 characters.</p>
                </div>
                <PasswordChangeForm />
              </div>

              <hr className="border-[var(--border)] my-6" />
              <div className="border border-red-500/20 bg-red-500/5 rounded-2xl p-5 space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-red-400">Danger Zone</h4>
                  <p className="text-xs text-[var(--text-muted)] mt-1">Irreversible actions for your personal account.</p>
                </div>
                {!confirmDeleteAccount ? (
                  <button onClick={() => setConfirmDeleteAccount(true)} className="text-xs font-medium border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2 rounded-xl transition-all">Delete Account</button>
                ) : (
                  <div className="space-y-3 max-w-md">
                    <p className="text-xs text-red-300">⚠️ <strong>Warning:</strong> Type <code className="font-mono bg-red-500/20 px-1 py-0.5 rounded text-white select-all">DELETE</code> to confirm.</p>
                    <div className="flex gap-2">
                      <input value={deleteAccountConfirmText} onChange={e => setDeleteAccountConfirmText(e.target.value)} className="input-dark w-full rounded-xl px-3 py-1.5 text-xs font-mono" placeholder="Type DELETE" />
                      <button onClick={handleDeleteAccountAction} disabled={deleteAccountConfirmText !== "DELETE"} className="text-xs font-medium bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-4 py-1.5 rounded-xl transition-all">Confirm</button>
                      <button onClick={() => { setConfirmDeleteAccount(false); setDeleteAccountConfirmText(""); }} className="text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-350 px-3 py-1.5 rounded-xl transition-all">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TEAM SUB-TAB */}
          {subTab === "team" && (
            <div className="space-y-6">
              <div className="glass rounded-2xl border border-[var(--border)] p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">Workspace Details</h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">Manage your team identity and organization settings.</p>
                </div>
                {orgStatus && (
                  <div className={`p-3 rounded-xl border text-sm ${orgStatus.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
                    {orgStatus.message}
                  </div>
                )}
                <form onSubmit={handleUpdateOrg} className="space-y-4 max-w-lg">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Workspace / Organization Name</label>
                    <input value={orgNameInput} onChange={e => setOrgNameInput(e.target.value)} disabled={!isOwnerOrAdmin} required className="input-dark w-full rounded-xl px-3 py-2 text-sm disabled:opacity-50" placeholder="e.g. Acme Corp" />
                    {!isOwnerOrAdmin && <p className="text-[10px] text-zinc-500">Only owners and admins can rename the workspace.</p>}
                  </div>
                  {isOwnerOrAdmin && (
                    <button type="submit" disabled={orgLoading} className="btn-primary px-5 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50">
                      {orgLoading ? "Saving..." : "Rename Organization"}
                    </button>
                  )}
                </form>
                {isOwnerOrAdmin && (
                  <>
                    <hr className="border-[var(--border)] my-6" />
                    <div className="border border-red-500/20 bg-red-500/5 rounded-2xl p-5 space-y-4">
                      <h4 className="text-sm font-semibold text-red-400">Danger Zone</h4>
                      {!confirmDeleteWorkspace ? (
                        <button onClick={() => setConfirmDeleteWorkspace(true)} className="text-xs font-medium border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2 rounded-xl transition-all">Delete Workspace</button>
                      ) : (
                        <div className="space-y-3 max-w-md">
                          <p className="text-xs text-red-300">⚠️ Type <code className="font-mono bg-red-500/20 px-1 py-0.5 rounded text-white">{user?.orgName || "DELETE"}</code> to confirm.</p>
                          <div className="flex gap-2">
                            <input value={deleteWorkspaceConfirmText} onChange={e => setDeleteWorkspaceConfirmText(e.target.value)} className="input-dark w-full rounded-xl px-3 py-1.5 text-xs font-mono" placeholder={`Type ${user?.orgName || "DELETE"}`} />
                            <button onClick={handleDeleteWorkspaceAction} disabled={deleteWorkspaceConfirmText !== (user?.orgName || "DELETE")} className="text-xs font-medium bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-4 py-1.5 rounded-xl">Dissolve</button>
                            <button onClick={() => { setConfirmDeleteWorkspace(false); setDeleteWorkspaceConfirmText(""); }} className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-350 px-3 py-1.5 rounded-xl">Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="glass rounded-2xl border border-[var(--border)] p-6 space-y-4">
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">Active Members</h3>
                <div className="border border-zinc-850 rounded-xl overflow-hidden divide-y divide-zinc-900 bg-zinc-950/20">
                  {orgData?.members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-4 table-row-hover">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-600/20 border border-purple-500/20 flex items-center justify-center text-xs font-bold text-purple-300">{member.avatar || member.name.substring(0, 2).toUpperCase()}</div>
                        <div>
                          <div className="text-sm font-medium text-[var(--text-primary)]">{member.name} {member.id === user?.id && <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded ml-1.5 uppercase font-mono">You</span>}</div>
                          <div className="text-xs text-[var(--text-secondary)] font-mono">{member.email}</div>
                        </div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase ${member.orgRole === "owner" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : member.orgRole === "admin" ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" : "bg-zinc-800 text-zinc-400 border border-zinc-700/50"}`}>{member.orgRole}</span>
                    </div>
                  ))}
                </div>
              </div>

              {isOwnerOrAdmin && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="glass rounded-2xl border border-[var(--border)] p-6 space-y-6">
                    <h3 className="text-lg font-semibold text-[var(--text-primary)]">Invite Teammate</h3>
                    {inviteStatus && (
                      <div className={`p-3 rounded-xl border text-sm ${inviteStatus.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>{inviteStatus.message}</div>
                    )}
                    <form onSubmit={handleInvite} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-300">Teammate Email</label>
                        <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required className="input-dark w-full rounded-xl px-3 py-2 text-sm" placeholder="colleague@domain.com" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-300">Workspace Role</label>
                        <select value={inviteRole} onChange={e => setInviteRole(e.target.value as any)} className="input-dark w-full rounded-xl px-3 py-2 text-sm bg-zinc-950 text-white">
                          <option value="member">Workspace Member</option>
                          <option value="admin">Workspace Admin</option>
                        </select>
                      </div>
                      <button type="submit" disabled={inviteLoading || !inviteEmail} className="btn-primary w-full py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50">
                        {inviteLoading ? "Sending..." : "Send Invite"}
                      </button>
                    </form>
                  </div>
                  <div className="glass rounded-2xl border border-[var(--border)] p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-[var(--text-primary)]">Pending Invitations</h3>
                    {(!orgData?.invites || orgData.invites.length === 0) ? (
                      <div className="h-32 rounded-xl border border-dashed border-[var(--border)] flex items-center justify-center text-xs text-[var(--text-muted)]">No pending invites.</div>
                    ) : (
                      <div className="border border-zinc-850 rounded-xl overflow-hidden divide-y divide-zinc-900">
                        {orgData.invites.map((invite) => (
                          <div key={invite.id} className="flex items-center justify-between p-3.5">
                            <div>
                              <div className="text-sm font-medium text-white">{invite.email}</div>
                              <div className="text-[10px] text-zinc-500">Invited as {invite.role}</div>
                            </div>
                            <button onClick={() => handleRevokeInvite(invite.id)} className="text-xs border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 px-2.5 py-1 rounded-lg transition-all">Revoke</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* NOTIFICATIONS SUB-TAB */}
          {subTab === "notifications" && (
            <div className="glass rounded-2xl border border-[var(--border)] p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">Notification Preferences</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1">Configure when and where you receive alerts.</p>
              </div>
              <div className="space-y-6 font-sans">
                <div className="space-y-4">
                  <div className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Email Channels</div>
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input type="checkbox" defaultChecked className="rounded border-[var(--border)] text-purple-600 focus:ring-purple-500 bg-[var(--bg-card)] mt-0.5 h-4 w-4" />
                    <div>
                      <div className="text-sm font-medium text-[var(--text-primary)] group-hover:text-purple-400 transition-colors">API Quota Warnings</div>
                      <div className="text-xs text-[var(--text-muted)]">Receive notifications when your workspace reaches 80% and 100% of plan limits.</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input type="checkbox" className="rounded border-[var(--border)] text-purple-600 focus:ring-purple-500 bg-[var(--bg-card)] mt-0.5 h-4 w-4" />
                    <div>
                      <div className="text-sm font-medium text-[var(--text-primary)] group-hover:text-purple-400 transition-colors">Weekly Usage Digest</div>
                      <div className="text-xs text-[var(--text-muted)]">A summary report of LLM costs, telemetry queries, and active teammates.</div>
                    </div>
                  </label>
                </div>

                <hr className="border-[var(--border)] my-4" />

                {/* Integration channels */}
                <div className="space-y-4">
                  <div className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Webhooks & Chat Integration</div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
                    <div>
                      <div className="text-sm font-medium text-[var(--text-primary)]">Slack Notification Webhook</div>
                      <div className="text-xs text-[var(--text-muted)]">Post system anomaly events to your engineering Slack channel.</div>
                    </div>
                    <button onClick={() => alert("Slack configuration modal coming soon!")} className="btn-ghost px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] hover:text-white">Configure</button>
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
                    <div>
                      <div className="text-sm font-medium text-[var(--text-primary)]">PagerDuty Alerts</div>
                      <div className="text-xs text-[var(--text-muted)]">Trigger pager alert notifications for critical production severity items.</div>
                    </div>
                    <button className="btn-ghost px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] hover:text-white opacity-55 cursor-not-allowed">Enterprise Only</button>
                  </div>
                </div>

                <div className="pt-2">
                  <button onClick={() => alert("Notification preferences updated successfully!")} className="btn-primary px-5 py-2 rounded-xl text-sm font-medium transition-all">
                    Save Preferences
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* BILLING SUB-TAB */}
          {subTab === "billing" && (
            <div className="glass rounded-2xl border border-[var(--border)] p-6 space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">Plans & Billing</h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">View details of your active plan and features.</p>
                </div>
                <span className={`badge badge-${user?.plan} py-1 px-3`}>
                  {user?.plan} Active
                </span>
              </div>

              {/* Pricing Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                {/* Free Card */}
                <div className={`rounded-xl p-5 border flex flex-col justify-between h-72 ${user?.plan === "free" ? "border-zinc-550 bg-zinc-500/5 glow-free" : "border-zinc-800/80 bg-zinc-950/20"}`}>
                  <div>
                    <div className="text-xs text-zinc-400 font-mono">FREE</div>
                    <div className="text-2xl font-bold text-[var(--text-primary)] mt-1">$0 <span className="text-xs text-zinc-500">/mo</span></div>
                    <ul className="text-[11px] text-[var(--text-secondary)] mt-4 space-y-2">
                      <li>✓ NL → SQL Translation</li>
                      <li>✓ 50 runs / mo</li>
                      <li>✗ Direct SQL Execution</li>
                      <li>✗ AI Analyst explain</li>
                    </ul>
                  </div>
                  {user?.plan === "free" ? (
                    <button disabled className="w-full text-center text-xs py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-500 cursor-not-allowed">Current Plan</button>
                  ) : (
                    <button className="w-full text-center text-xs py-2 rounded-lg btn-ghost">Downgrade</button>
                  )}
                </div>

                {/* Pro Card */}
                <div className={`rounded-xl p-5 border flex flex-col justify-between h-72 ${user?.plan === "pro" ? "border-purple-500 bg-purple-500/5 glow-purple" : "border-zinc-800/80 bg-zinc-950/20"}`}>
                  <div>
                    <div className="text-xs text-purple-400 font-mono">PRO</div>
                    <div className="text-2xl font-bold text-[var(--text-primary)] mt-1">$79 <span className="text-xs text-zinc-500">/mo</span></div>
                    <ul className="text-[11px] text-[var(--text-secondary)] mt-4 space-y-2">
                      <li>✓ Unlimited SQL translation</li>
                      <li>✓ Direct Database Execution</li>
                      <li>✓ AI Anomaly explanations</li>
                      <li>✓ 3D Cloud Network map</li>
                    </ul>
                  </div>
                  {user?.plan === "pro" ? (
                    <button disabled className="w-full text-center text-xs py-2 rounded-lg border border-purple-700 bg-purple-900 text-purple-400 cursor-not-allowed">Current Plan</button>
                  ) : (
                    <button onClick={() => handleUpgrade("pro")} className="w-full text-center text-xs py-2 rounded-lg btn-primary">Upgrade to Pro</button>
                  )}
                </div>

                {/* Enterprise Card */}
                <div className={`rounded-xl p-5 border flex flex-col justify-between h-72 ${user?.plan === "enterprise" ? "border-amber-500 bg-amber-500/5 glow-emerald" : "border-zinc-800/80 bg-zinc-950/20"}`}>
                  <div>
                    <div className="text-xs text-amber-400 font-mono">ENTERPRISE</div>
                    <div className="text-2xl font-bold text-[var(--text-primary)] mt-1">$299 <span className="text-xs text-zinc-500">/mo</span></div>
                    <ul className="text-[11px] text-[var(--text-secondary)] mt-4 space-y-2">
                      <li>✓ RAG Document bases</li>
                      <li>✓ Custom AI Models & Prompts</li>
                      <li>✓ Dedicated Support & SSO</li>
                      <li>✓ Multi-workspace team routing</li>
                    </ul>
                  </div>
                  {user?.plan === "enterprise" ? (
                    <button disabled className="w-full text-center text-xs py-2 rounded-lg border border-amber-700 bg-amber-900 text-amber-450 cursor-not-allowed">Current Plan</button>
                  ) : (
                    <button onClick={() => handleUpgrade("enterprise")} className="w-full text-center text-xs py-2 rounded-lg btn-ghost border-amber-500/20 hover:border-amber-500/40 text-amber-450 hover:text-amber-300">Upgrade to Enterprise</button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── LLM SUB-TAB ──────────────────────────────────────────────── */}
          {subTab === "llm" && (
            <div className="space-y-6">
              <LlmSettingsPanel />
            </div>
          )}

          {/* ── API KEYS SUB-TAB ──────────────────────────────────────────────── */}
          {subTab === "apiKeys" && (
            <div className="space-y-6">
              <div className="glass rounded-2xl border border-[var(--border)] p-6 space-y-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--text-primary)]">API Keys 🔑</h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">Authenticate external API requests. Keys start with <code className="font-mono text-purple-400">gsk_live_</code></p>
                  </div>
                  <a href="/docs#authentication" target="_blank" className="text-xs text-purple-400 hover:text-purple-300 border border-purple-500/20 px-3 py-1.5 rounded-lg transition-all">📖 API Docs</a>
                </div>

                {/* Quick-start curl example */}
                <div className="bg-zinc-950 rounded-xl p-4 border border-zinc-800 font-mono text-xs text-zinc-400 space-y-1">
                  <div className="text-zinc-600 mb-2"># Use your key to call the API:</div>
                  <div><span className="text-emerald-400">curl</span> -X POST https://goatsaas.com/api/v1/nl-query \</div>
                  <div className="pl-4"><span className="text-amber-400">-H</span> <span className="text-zinc-300">&quot;Authorization: Bearer gsk_live_...&quot;</span> \</div>
                  <div className="pl-4"><span className="text-amber-400">-d</span> <span className="text-zinc-300">&apos;{`{"query":"show revenue by country"}`}&apos;</span></div>
                </div>

                {/* Generate new key form */}
                <form onSubmit={handleGenerateKey} className="flex gap-2 max-w-md">
                  <input id="api-key-name" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} required className="input-dark flex-1 rounded-xl px-3 py-2 text-sm" placeholder="Key name, e.g. Production Telemetry" />
                  <button type="submit" disabled={!newKeyName.trim() || newKeyGenerating} className="btn-primary px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap disabled:opacity-50">
                    {newKeyGenerating ? "Generating…" : "Generate Key"}
                  </button>
                </form>

                {/* Status banner */}
                {apiKeyStatus && (
                  <div className={`p-3 rounded-xl border text-sm ${apiKeyStatus.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
                    {apiKeyStatus.message}
                  </div>
                )}

                {/* One-time raw key reveal */}
                {revealedKey && (
                  <div className="p-4 bg-amber-500/5 border border-amber-500/30 rounded-xl space-y-3 fade-in-up">
                    <span className="text-amber-400 text-sm font-semibold">⚠️ Copy this key now — it will never be shown again</span>
                    <div className="flex gap-2">
                      <code className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-emerald-300 break-all select-all">
                        {revealedKey.rawKey}
                      </code>
                      <button onClick={() => copyToClipboard(revealedKey.rawKey, "reveal")} className="btn-primary px-3 py-2 rounded-lg text-xs whitespace-nowrap">
                        {copiedKeyId === "reveal" ? "✓ Copied!" : "📋 Copy"}
                      </button>
                    </div>
                    <button onClick={() => setRevealedKey(null)} className="text-xs text-zinc-500 hover:text-zinc-300">I&apos;ve saved it — dismiss</button>
                  </div>
                )}

                {/* Keys table */}
                {apiKeysLoading ? (
                  <div className="text-center py-8 text-zinc-500 text-sm">Loading keys…</div>
                ) : apiKeys.length === 0 ? (
                  <div className="h-24 rounded-xl border border-dashed border-[var(--border)] flex items-center justify-center text-xs text-[var(--text-muted)]">No API keys yet. Generate your first key above.</div>
                ) : (
                  <div className="border border-zinc-850 rounded-xl overflow-hidden divide-y divide-zinc-900 bg-zinc-950/20">
                    {apiKeys.map((key) => (
                      <div key={key.id} className="flex items-center justify-between p-4 table-row-hover gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-[var(--text-primary)]">{key.name}</span>
                            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${key.plan === "enterprise" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : key.plan === "pro" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" : "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>{key.plan}</span>
                            {key.revokedAt && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border bg-red-500/10 text-red-400 border-red-500/20">revoked</span>}
                          </div>
                          <div className="text-xs font-mono text-purple-400 mt-0.5">{key.display}</div>
                          <div className="text-[10px] text-[var(--text-muted)] mt-0.5 flex gap-3 flex-wrap">
                            <span>Created: {new Date(key.createdAt).toLocaleDateString()}</span>
                            {key.lastUsedAt && <span>Last used: {new Date(key.lastUsedAt).toLocaleDateString()}</span>}
                            <span>Calls today: {key.callsToday ?? 0} · Total: {key.totalCalls ?? 0}</span>
                          </div>
                        </div>
                        {!key.revokedAt && (
                          <button onClick={() => handleRevokeKey(key.id)} className="text-xs border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/15 px-3 py-1.5 rounded-lg transition-all flex-shrink-0">Revoke</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── DATABASE SUB-TAB ──────────────────────────────────────────────── */}
          {subTab === "database" && (
            <div className="space-y-6">
              <div className="glass rounded-2xl border border-[var(--border)] p-6 space-y-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--text-primary)]">External Database 🗄️</h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">Connect your Postgres database. NL→SQL queries will run against your real data.</p>
                  </div>
                  {dbConnection?.status === "connected" ? (
                    <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />Connected
                    </span>
                  ) : (
                    <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">Not connected</span>
                  )}
                </div>

                {dbLoading ? (
                  <div className="text-sm text-zinc-500">Loading connection status…</div>
                ) : dbConnection?.status === "connected" ? (
                  <div className="bg-zinc-950 rounded-xl p-4 border border-zinc-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-white">{dbConnection.label}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">Connected {new Date(dbConnection.connectedAt).toLocaleDateString()} · {dbConnection.tableCount} tables</div>
                      </div>
                      <button onClick={handleDisconnectDb} className="text-xs border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/15 px-3 py-1.5 rounded-lg transition-all">Disconnect</button>
                    </div>
                    {dbConnection.tables?.length > 0 && (
                      <div>
                        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Discovered Tables</div>
                        <div className="flex flex-wrap gap-1.5">
                          {dbConnection.tables.map((t: string) => (
                            <span key={t} className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}

                {dbConnection?.status !== "connected" && (
                  <form onSubmit={handleTestConnection} className="space-y-4 max-w-lg">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-300">Connection Label (optional)</label>
                      <input value={dbLabel} onChange={e => setDbLabel(e.target.value)} className="input-dark w-full rounded-xl px-3 py-2 text-sm" placeholder="e.g. Acme Corp Production DB" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-300">Connection URI</label>
                      <input value={dbUri} onChange={e => setDbUri(e.target.value)} required className="input-dark w-full rounded-xl px-3 py-2 text-sm font-mono text-xs" placeholder="postgresql://user:password@host:5432/dbname" />
                      <p className="text-[10px] text-zinc-500">Only read-only queries are permitted. Your URI is never exposed in API responses.</p>
                    </div>
                    <button type="submit" disabled={!dbUri.trim() || dbTesting} className="btn-primary px-5 py-2 rounded-xl text-sm font-medium disabled:opacity-50 flex items-center gap-2">
                      {dbTesting ? <><span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />Testing…</> : "Test & Connect"}
                    </button>
                  </form>
                )}

                {dbStatus && (
                  <div className={`p-4 rounded-xl border text-sm ${dbStatus.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
                    <div>{dbStatus.message}</div>
                    {dbStatus.tables && dbStatus.tables.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {dbStatus.tables.slice(0, 12).map(t => (
                          <span key={t} className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 border border-emerald-900 text-emerald-300">{t}</span>
                        ))}
                        {dbStatus.tables.length > 12 && <span className="text-[10px] text-emerald-500">+{dbStatus.tables.length - 12} more</span>}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="glass rounded-2xl border border-[var(--border)] p-6 space-y-4">
                <h4 className="text-sm font-semibold text-[var(--text-primary)]">What happens after connecting?</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { icon: "⚡", title: "NL→SQL queries your data", desc: "\"How many active users?\" runs against YOUR users table, not our demo." },
                    { icon: "🔒", title: "Read-only enforcement", desc: "DROP, TRUNCATE, INSERT are blocked. Only SELECT queries are allowed." },
                    { icon: "🔌", title: "API access via key", desc: "POST /api/v1/db/query with your API key to run SQL programmatically." },
                    { icon: "📊", title: "Schema-aware AI", desc: "The AI sees your table names and generates accurate, schema-specific SQL." },
                  ].map(item => (
                    <div key={item.title} className="flex gap-3 p-3 rounded-xl bg-zinc-950/40 border border-zinc-800/50">
                      <span className="text-lg flex-shrink-0">{item.icon}</span>
                      <div>
                        <div className="text-xs font-semibold text-white">{item.title}</div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── WEBHOOKS SUB-TAB ──────────────────────────────────────────────── */}
          {subTab === "webhooks" && (
            <div className="space-y-6">
              <div className="glass rounded-2xl border border-[var(--border)] p-6 space-y-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--text-primary)]">Webhooks 🔗</h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">Get HTTP POST notifications when events fire. Signed with HMAC-SHA256.</p>
                  </div>
                  <a href="/docs#webhooks" target="_blank" className="text-xs text-purple-400 hover:text-purple-300 border border-purple-500/20 px-3 py-1.5 rounded-lg transition-all">📖 Docs</a>
                </div>

                {webhookStatus && (
                  <div className={`p-3 rounded-xl border text-sm ${webhookStatus.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
                    {webhookStatus.message}
                  </div>
                )}

                {webhookSecret && (
                  <div className="p-4 bg-amber-500/5 border border-amber-500/30 rounded-xl space-y-3 fade-in-up">
                    <span className="text-amber-400 text-sm font-semibold">⚠️ Signing secret — save this now, it won&apos;t be shown again</span>
                    <div className="flex gap-2">
                      <code className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-emerald-300 break-all select-all">{webhookSecret.secret}</code>
                      <button onClick={() => copyToClipboard(webhookSecret.secret, "whsec")} className="btn-primary px-3 py-2 rounded-lg text-xs whitespace-nowrap">
                        {copiedKeyId === "whsec" ? "✓ Copied!" : "📋 Copy"}
                      </button>
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono">Verify: <code>X-GOATSaaS-Signature: sha256=&lt;hmac&gt;</code></div>
                    <button onClick={() => setWebhookSecret(null)} className="text-xs text-zinc-500 hover:text-zinc-300">I&apos;ve saved it — dismiss</button>
                  </div>
                )}

                <form onSubmit={handleAddWebhook} className="space-y-4 max-w-lg">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Endpoint URL</label>
                    <input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} required className="input-dark w-full rounded-xl px-3 py-2 text-sm font-mono text-xs" placeholder="https://your-server.com/webhooks/goatsaas" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Label (optional)</label>
                    <input value={webhookLabel} onChange={e => setWebhookLabel(e.target.value)} className="input-dark w-full rounded-xl px-3 py-2 text-sm" placeholder="e.g. Slack Anomaly Alerts" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-300">Subscribe to Events</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(supportedEvents.length > 0 ? supportedEvents : ["anomaly.detected", "quota.exceeded", "user.created", "plan.changed", "api.key_created", "test.ping"]).map(ev => (
                        <label key={ev} className="flex items-center gap-2 p-2 rounded-lg border border-zinc-800 bg-zinc-950/30 cursor-pointer hover:border-purple-500/30 transition-all">
                          <input
                            type="checkbox"
                            checked={webhookEvents.includes(ev)}
                            onChange={e => setWebhookEvents(p => e.target.checked ? [...p, ev] : p.filter(x => x !== ev))}
                            className="rounded border-zinc-700 text-purple-600 focus:ring-purple-500 bg-zinc-900 h-3.5 w-3.5"
                          />
                          <span className="text-[11px] font-mono text-zinc-300">{ev}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <button type="submit" disabled={!webhookUrl.trim() || webhookEvents.length === 0 || webhookAdding} className="btn-primary px-5 py-2 rounded-xl text-sm font-medium disabled:opacity-50">
                    {webhookAdding ? "Registering…" : "Register Webhook"}
                  </button>
                </form>
              </div>

              {webhookLoading ? (
                <div className="text-center py-8 text-zinc-500 text-sm">Loading webhooks…</div>
              ) : webhooks.length > 0 ? (
                <div className="glass rounded-2xl border border-[var(--border)] p-6 space-y-4">
                  <h4 className="text-sm font-semibold text-[var(--text-primary)]">Registered Webhooks ({webhooks.length})</h4>
                  <div className="space-y-3">
                    {webhooks.map(wh => (
                      <div key={wh.id} className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-800/60 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-white truncate">{wh.label}</span>
                              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${wh.status === "active" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : wh.status === "failing" ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>{wh.status}</span>
                            </div>
                            <div className="text-[11px] font-mono text-zinc-500 mt-0.5 truncate">{wh.url}</div>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {wh.events.map((ev: string) => (
                                <span key={ev} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-950/50 text-purple-400 border border-purple-900/50">{ev}</span>
                              ))}
                            </div>
                            {wh.lastFiredAt && <div className="text-[10px] text-zinc-600 mt-1">Last fired: {new Date(wh.lastFiredAt).toLocaleString()} · HTTP {wh.lastStatus}</div>}
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <button onClick={() => handleTestWebhook(wh.id)} disabled={testingWebhookId === wh.id} className="text-xs border border-purple-500/20 bg-purple-500/5 text-purple-400 hover:bg-purple-500/10 px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-50">
                              {testingWebhookId === wh.id ? "Sending…" : "⚡ Test"}
                            </button>
                            <button onClick={() => handleDeleteWebhook(wh.id)} className="text-xs border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/15 px-2.5 py-1.5 rounded-lg transition-all">Delete</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {deliveryLog.length > 0 && (
                <div className="glass rounded-2xl border border-[var(--border)] p-6 space-y-4">
                  <h4 className="text-sm font-semibold text-[var(--text-primary)]">Recent Deliveries</h4>
                  <div className="border border-zinc-850 rounded-xl overflow-hidden divide-y divide-zinc-900 bg-zinc-950/20">
                    {deliveryLog.slice(0, 10).map((d, i) => (
                      <div key={i} className="flex items-center justify-between p-3 text-xs">
                        <div className="flex items-center gap-3">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${d.status === "success" ? "bg-emerald-400" : "bg-red-400"}`} />
                          <span className="font-mono text-zinc-400">{d.event}</span>
                        </div>
                        <div className="flex items-center gap-3 text-zinc-500">
                          {d.httpStatus && <span className={`font-mono ${d.httpStatus < 300 ? "text-emerald-400" : "text-red-400"}`}>HTTP {d.httpStatus}</span>}
                          <span>{d.durationMs}ms</span>
                          <span>{new Date(d.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}


export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      window.location.href = "/sign-in";
    }
  }, [user, loading]);
  const [tab, setTab] = useState("overview");
  const [livePlan, setLivePlan] = useState(user?.plan || "free");

  // Mobile menu state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Theme state
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const [dashboardData, setDashboardData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/v1/dashboard/stats")
      .then(r => r.json())
      .then(setDashboardData)
      .catch(e => console.error("Failed to load dashboard stats", e));
  }, []);

  const revenueData = dashboardData?.revenueData || [];
  const aiUsageData = dashboardData?.aiUsageData || [];
  const stats = dashboardData?.stats || [];
  const recentActivity = dashboardData?.recentActivity || [];

  useEffect(() => {
    const saved = localStorage.getItem("theme") as "dark" | "light" | null;
    if (saved) {
      setTheme(saved);
      if (saved === "light") {
        document.documentElement.classList.add("light");
      } else {
        document.documentElement.classList.remove("light");
      }
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    if (next === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
  };

  // Notifications state
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetch("/api/ai-proxy/v1/billing/status", {
        headers: { "X-Org-Id": user?.orgName || "default_org" }
      }).then(r => r.json()).then(d => { if (d.plan) setLivePlan(d.plan); }).catch(()=>{});
    }
  }, [user]);

  useEffect(() => {
    const orgId = user?.orgName || "default_org";
    const fetchAlerts = async () => {
      try {
        const res = await fetch("/api/ai-proxy/v1/anomalies/alerts", {
          headers: { "X-Org-Id": orgId }
        });
        const alerts = await res.json();
        setNotifications(alerts.map((a: any) => ({
          id: a.id.toString(),
          type: "anomaly",
          message: `⚠️ Anomaly Detected: ${a.metric} (Score: ${a.z_score.toFixed(1)}) - ${a.insight}`,
          time: new Date(a.timestamp).toLocaleTimeString(),
          read: a.read || false
        })));
      } catch (e) {
        // backend offline
      }
    };
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 5000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markRead = (id: string) => {
    setNotifications(p => p.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = () => {
    setNotifications(p => p.map(n => ({ ...n, read: true })));
  };

  const deleteNotif = (id: string) => {
    setNotifications(p => p.filter(n => n.id !== id));
  };

  const simulateAnomaly = async () => {
    try {
      await fetch("/api/ai-proxy/v1/db/simulate-anomaly", { 
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Org-Id": user?.orgName || "default_org" },
        body: JSON.stringify({})
      });
      setNotifDropdownOpen(true);
    } catch {
      alert("Backend simulator offline.");
    }
  };

  if (loading) {
    return <GoatLoader message="Loading Dashboard..." />;
  }

  if (!user) {
    return <GoatLoader message="Redirecting to sign in..." />;
  }
  return (
    <div className="min-h-screen bg-[var(--bg-0)] text-[var(--text-primary)] transition-colors duration-300 flex overflow-hidden">
      <OnboardingModal />
      {/* Desktop Sidebar */}

      <aside className="w-60 flex-shrink-0 border-r border-zinc-900 hidden md:flex flex-col p-4 bg-zinc-950 font-sans">
        <div className="flex items-center mb-8 px-2">
          <img src="/logo.png" alt="GOATSaaS Logo" className="h-16 w-auto object-contain drop-shadow-md" />
        </div>

        <nav className="space-y-1 flex-1">
          {NAV_ITEMS.filter(item => item.id !== "admin" || user?.role === "admin").map(item => (
            <button key={item.id} onClick={() => setTab(item.id)} className={`sidebar-item w-full text-left ${tab === item.id ? "active" : ""}`}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="border-t border-zinc-900 pt-4 mt-4">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-purple-655 bg-purple-600 flex items-center justify-center text-xs font-bold text-white">{user.avatar}</div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-white truncate">{user.name}</div>
              <div className="text-xs text-zinc-500 truncate">{user.orgName || user.email}</div>
            </div>
          </div>
          <div className="px-2 mb-2 flex gap-1.5 items-center">
            <span className={`badge badge-${livePlan}`}>{livePlan}</span>
            {user.orgRole && (
              <span className="text-[9px] font-mono text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800 uppercase">
                {user.orgRole}
              </span>
            )}
          </div>
          <a href="/changelog" className="sidebar-item w-full text-left text-zinc-500 hover:text-white" target="_blank" rel="noopener noreferrer">
            <span>📜</span><span>Changelog</span>
          </a>
          <button onClick={logout} className="sidebar-item w-full text-left text-red-400">
            <span>🚪</span><span>Log out</span>
          </button>

        </div>
      </aside>

      {/* Mobile Drawer Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-all duration-300" onClick={() => setMobileSidebarOpen(false)}>
          <aside className="w-64 h-full flex flex-col p-4 bg-zinc-950 font-sans border-r border-zinc-900 relative" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-8 px-2">
              <div className="flex items-center">
                <img src="/logo.png" alt="GOATSaaS Logo" className="h-16 w-auto object-contain drop-shadow-md" />
              </div>
              <button 
                onClick={() => setMobileSidebarOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent hover:border-zinc-850"
              >
                ✕
              </button>
            </div>

            <nav className="space-y-1 flex-1">
              {NAV_ITEMS.filter(item => item.id !== "admin" || user?.role === "admin").map(item => (
                <button 
                  key={item.id} 
                  onClick={() => { setTab(item.id); setMobileSidebarOpen(false); }} 
                  className={`sidebar-item w-full text-left ${tab === item.id ? "active" : ""}`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>

            <div className="border-t border-zinc-900 pt-4 mt-4">
              <div className="flex items-center gap-3 px-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-purple-605 bg-purple-600 flex items-center justify-center text-xs font-bold text-white">{user.avatar}</div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white truncate">{user.name}</div>
                  <div className="text-xs text-zinc-500 truncate">{user.orgName || user.email}</div>
                </div>
              </div>
              <div className="px-2 mb-2 flex gap-1.5 items-center">
                <span className={`badge badge-${livePlan}`}>{livePlan}</span>
                {user.orgRole && (
                  <span className="text-[9px] font-mono text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800 uppercase">
                    {user.orgRole}
                  </span>
                )}
              </div>
              <button onClick={logout} className="sidebar-item w-full text-left text-red-400">
                <span>🚪</span><span>Log out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main content wrapper */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="flex items-center justify-between border-b border-[var(--border)] p-4 md:px-8 bg-[var(--bg-1)] sticky top-0 z-30 backdrop-blur-md">
          <div className="flex items-center gap-3">
            {/* Hamburger Menu Button (Mobile Only) */}
            <button 
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-2 -ml-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-card)] border border-transparent hover:border-[var(--border)] transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h2 className="text-base font-bold text-[var(--text-primary)] capitalize font-sans">
              {tab === "sql" ? "NL → SQL Terminal" : tab === "ai" ? "AI Analyst" : tab === "cloud" ? "Cloud Map" : tab === "knowledge" ? "Knowledge Base" : tab === "telemetry" ? "Telemetry" : tab}
            </h2>
          </div>

          <div className="flex items-center gap-2 relative">
            {/* Notification Bell */}
            <div className="relative">
              <button 
                onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
                className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] border border-transparent hover:border-[var(--border)] transition-all relative flex items-center justify-center"
              >
                <span className="text-lg">🔔</span>
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                )}
              </button>

              {/* Notification Popover Dropdown */}
              {notifDropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 glass rounded-2xl border border-[var(--border)] p-4 shadow-xl z-55 text-left fade-in-up bg-zinc-950/95 font-sans">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">Notifications</span>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-[11px] text-purple-400 hover:text-purple-305 font-medium">Mark all read</button>
                    )}
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
                    {notifications.length === 0 ? (
                      <div className="text-center py-6 text-xs text-[var(--text-muted)]">No notifications</div>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} className={`p-2.5 rounded-xl border transition-all flex gap-2 justify-between items-start text-xs ${n.read ? 'bg-transparent border-transparent opacity-55' : 'bg-[var(--bg-card)] border-[var(--border)] hover:bg-[var(--bg-card-hover)]'}`}>
                          <div className="flex gap-2">
                            <span className="text-base flex-shrink-0">{n.type === 'anomaly' ? '⚠️' : n.type === 'job' ? '🤖' : '⚡'}</span>
                            <div>
                              <div className={`font-medium ${n.read ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>{n.message}</div>
                              <div className="text-[10px] text-[var(--text-muted)] mt-1">{n.time}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {!n.read && (
                              <button onClick={() => markRead(n.id)} className="w-1.5 h-1.5 bg-purple-500 rounded-full flex-shrink-0" title="Mark as read" />
                            )}
                            <button onClick={() => deleteNotif(n.id)} className="text-[var(--text-muted)] hover:text-red-400 font-bold px-1" title="Dismiss">×</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="border-t border-[var(--border)] mt-3 pt-2 flex justify-between items-center">
                    <button onClick={simulateAnomaly} className="text-[10px] text-purple-400 hover:text-purple-300 bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/20">Simulate Anomaly</button>
                    {notifications.length > 0 && (
                      <button onClick={() => setNotifications([])} className="text-[10px] text-[var(--text-muted)] hover:text-red-400">Clear all</button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Theme Toggle Button */}
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] border border-transparent hover:border-[var(--border)] transition-all flex items-center justify-center"
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              <span className="text-lg">{theme === "dark" ? "☀️" : "🌙"}</span>
            </button>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-8 max-w-7xl mx-auto w-full">
            {tab === "ecommerce" && (
              <EcommercePanel />
            )}

            {tab === "logistics" && (
              <LogisticsPanel />
            )}
            
            {tab === "crm" && (
              <CrmPanel />
            )}

            {tab === "saas" && (
              <SaasPanel />
            )}

            {tab === "projects" && (
              <ProjectsPanel />
            )}

            {tab === "audire" && (
              <AudirePanel />
            )}
            
            {tab === "overview" && (
              <div className="space-y-8 fade-in-up">
                <div>
                  <h1 className="text-2xl font-bold text-[var(--text-primary)]">Good day, {user.name.split(" ")[0]} 👋</h1>
                  <p className="text-[var(--text-secondary)] text-sm mt-1">Here's what's happening with your platform today.</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  {stats.map((s, i) => <StatCard key={i} stat={s} />)}
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  {/* Revenue Growth Card */}
                  <div className="xl:col-span-2 glass rounded-2xl border border-[var(--border)] p-6">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="font-semibold text-[var(--text-primary)]">Revenue Growth</h3>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">Monthly recurring revenue</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => exportCsv("Revenue_Growth", revenueData)} className="text-[10px] btn-ghost px-2 py-1 rounded-lg border border-[var(--border)] flex items-center gap-1 font-mono hover:text-white" title="Export CSV">📥 CSV</button>
                        <button onClick={() => exportPdf("Revenue Growth Report", ["month", "revenue", "users"], revenueData)} className="text-[10px] btn-ghost px-2 py-1 rounded-lg border border-[var(--border)] flex items-center gap-1 font-mono hover:text-white" title="Export PDF">📄 PDF</button>
                        <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-full">+21.4% MoM</span>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={revenueData}>
                        <defs>
                          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="month" stroke="#71717a" tick={{ fontSize: 12 }} />
                        <YAxis stroke="#71717a" tick={{ fontSize: 12 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                        <Tooltip contentStyle={{ background: "#0a0a0f", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#fff" }} formatter={(v: number) => [`$${v.toLocaleString()}`, "Revenue"]} />
                        <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" fill="url(#revGrad)" strokeWidth={2} dot={{ fill: "#8b5cf6", r: 4 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* AI Usage Card */}
                  <div className="glass rounded-2xl border border-[var(--border)] p-6">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="font-semibold text-[var(--text-primary)] mb-1">AI Usage</h3>
                        <p className="text-xs text-[var(--text-secondary)]">API calls this week</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => exportCsv("AI_Usage", aiUsageData)} className="text-[10px] btn-ghost px-2 py-1 rounded-lg border border-[var(--border)] hover:text-white" title="Export CSV">📥 CSV</button>
                        <button onClick={() => exportPdf("AI Usage Report", ["day", "calls"], aiUsageData)} className="text-[10px] btn-ghost px-2 py-1 rounded-lg border border-[var(--border)] hover:text-white" title="Export PDF">📄 PDF</button>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={aiUsageData}>
                        <XAxis dataKey="day" stroke="#71717a" tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ background: "#0a0a0f", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#fff" }} />
                        <Bar dataKey="calls" fill="#6d28d9" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Recent Activity Section */}
                <div className="glass rounded-2xl border border-[var(--border)] p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-[var(--text-primary)]">Recent Activity</h3>
                    <div className="flex items-center gap-2">
                      <button onClick={() => exportCsv("Recent_Activity", recentActivity)} className="text-[10px] btn-ghost px-2.5 py-1.5 rounded-lg border border-[var(--border)] flex items-center gap-1 hover:text-white">📥 CSV</button>
                      <button onClick={() => exportPdf("Recent Activity Report", ["user", "action", "time", "type"], recentActivity)} className="text-[10px] btn-ghost px-2.5 py-1.5 rounded-lg border border-[var(--border)] flex items-center gap-1 hover:text-white">📄 PDF</button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {recentActivity.map((a, i) => (
                      <div key={i} className="flex items-center gap-4 table-row-hover rounded-xl px-2 py-2">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-300">
                          {a.user.split(" ").map(n=>n[0]).join("")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-[var(--text-primary)] font-medium">{a.user}</span>
                          <span className="text-sm text-[var(--text-secondary)]"> — {a.action}</span>
                        </div>
                        <span className="text-xs text-[var(--text-muted)] flex-shrink-0">{a.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === "ai" && (
              <div className="space-y-6 fade-in-up">
                <div>
                  <h1 className="text-2xl font-bold text-[var(--text-primary)]">Pyro AI 🐐</h1>
                  <p className="text-[var(--text-secondary)] text-sm mt-1">Your AI Business Analyst has been upgraded to a global platform widget.</p>
                </div>
                <div className="glass rounded-2xl border border-[var(--border)] p-12 flex flex-col items-center justify-center text-center mt-8">
                  <div className="text-5xl animate-bounce mb-4">🐐</div>
                  <h3 className="text-xl font-bold text-white mb-2">Look to your bottom right!</h3>
                  <p className="text-zinc-400 max-w-md">
                    Pyro AI is now a persistent, intelligent chatbot widget available on every single page of the dashboard. Click the floating green goat icon in the corner to chat with your real database anytime!
                  </p>
                </div>
              </div>
            )}

            {tab === "sql" && (
              <div className="space-y-6 fade-in-up">
                <div>
                  <h1 className="text-2xl font-bold text-[var(--text-primary)]">NL → SQL Terminal ⚡</h1>
                  <p className="text-[var(--text-secondary)] text-sm mt-1">Type plain English queries, get production-ready SQL instantly.</p>
                </div>
                <NlSqlPanel />
              </div>
            )}

            {tab === "cloud" && (
              <div className="space-y-6 fade-in-up">
                <div>
                  <h1 className="text-2xl font-bold text-[var(--text-primary)]">3D Cloud Infrastructure 🌐</h1>
                  <p className="text-[var(--text-secondary)] text-sm mt-1">Live WebGL visualization of your global server network.</p>
                </div>
                <div className="relative h-[600px] rounded-2xl overflow-hidden border border-[var(--border)] glass">
                  <CloudMap3D />
                  <div className="absolute bottom-6 left-6 glass rounded-xl p-4 border border-zinc-700 space-y-1 text-xs font-mono text-white bg-zinc-950/70">
                    <div className="text-emerald-400 font-bold">● 50 GLOBAL NODES ONLINE</div>
                    <div className="text-zinc-400">AVG LATENCY: 12ms</div>
                    <div className="text-purple-400 pulse-dot font-semibold">HIGH TRAFFIC DETECTED</div>
                  </div>
                </div>
              </div>
            )}

            {tab === "knowledge" && (
              <KnowledgeBasePanel />
            )}

            {tab === "telemetry" && (
              <TelemetryPanel />
            )}

            {tab === "settings" && (
              <SettingsPanel />
            )}

            {tab === "admin" && (
              <AdminPanel />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
