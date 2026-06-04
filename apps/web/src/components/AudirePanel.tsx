"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

export default function AudirePanel() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  const [newAuditUrl, setNewAuditUrl] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/audire", { headers: { "X-Org-Id": user?.orgName || "default_org" } });
      if (res.ok) {
        setData(await res.json());
      }
    } catch (e) {
      console.error("Failed to load Audire data", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const handleRunAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAuditUrl) return;

    const llmProvider = localStorage.getItem("LLM_PROVIDER");
    const llmKey = localStorage.getItem("LLM_API_KEY");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Org-Id": user?.orgName || "default_org",
    };
    if (llmProvider) headers["X-LLM-Provider"] = llmProvider;
    if (llmKey) headers["X-LLM-Key"] = llmKey;

    try {
      const res = await fetch("/api/v1/audire", {
        method: "POST",
        headers,
        body: JSON.stringify({ entity: "audit", data: { url: newAuditUrl, summary: "Audit queued" } })
      });
      if (res.ok) {
        setNewAuditUrl("");
        fetchData();
        setActiveTab("audits");
        // Poll once to show completed after 4s
        setTimeout(fetchData, 4000);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to start audit");
      }
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-6 animate-fade-in fade-in max-w-7xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-2">
            <span>🔍</span> AI Readiness Audits
          </h2>
          <p className="text-[var(--text-secondary)] mt-1">Check how AI assistants interpret your brand and websites.</p>
        </div>
        <div className="flex gap-2 bg-[var(--bg-1)] p-1 rounded-xl border border-[var(--border)] overflow-x-auto">
          {["overview", "audits", "agents"].map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === t ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-[var(--text-muted)] animate-pulse">Loading AI Audit Data...</div>
      ) : !data ? null : activeTab === "overview" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass rounded-2xl border border-[var(--border)] p-6 lg:col-span-1 h-fit">
            <h3 className="font-semibold mb-4 text-[var(--text-primary)] flex items-center gap-2">
              <span className="text-blue-400">⚡</span> Run New Scan
            </h3>
            <form onSubmit={handleRunAudit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Target URL</label>
                <input required type="url" value={newAuditUrl} onChange={e => setNewAuditUrl(e.target.value)} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" placeholder="https://brand.com" />
              </div>
              <button type="submit" className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-sm font-medium transition-all transform active:scale-[0.98] shadow-lg shadow-blue-500/20 mt-2">
                Start Analysis
              </button>
            </form>
          </div>

          <div className="glass rounded-2xl border border-[var(--border)] overflow-hidden lg:col-span-2">
            <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-1)]">
              <h3 className="font-semibold text-[var(--text-primary)]">Recent Scans</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--bg-2)] text-[var(--text-muted)]">
                  <tr>
                    <th className="p-4 font-medium">URL</th>
                    <th className="p-4 font-medium">Score</th>
                    <th className="p-4 font-medium">Grade</th>
                    <th className="p-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {data.audits?.slice(0, 5).map((a: any) => (
                    <tr key={a.id} className="hover:bg-[var(--bg-1)]/50 transition-colors">
                      <td className="p-4 text-[var(--text-primary)] font-medium">{a.url}</td>
                      <td className="p-4 text-[var(--text-secondary)]">{a.score > 0 ? `${a.score}/100` : "-"}</td>
                      <td className="p-4">
                        <span className={`text-xs px-2 py-1 rounded-full font-bold ${a.grade === 'A' ? 'bg-emerald-500/10 text-emerald-500' : a.grade === 'B' ? 'bg-blue-500/10 text-blue-500' : a.grade === 'Pending' ? 'bg-zinc-800 text-zinc-500' : 'bg-amber-500/10 text-amber-500'}`}>
                          {a.grade}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-[var(--text-muted)] uppercase">{a.status}</td>
                    </tr>
                  ))}
                  {(!data.audits || data.audits.length === 0) && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-[var(--text-muted)]">No audits run yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === "audits" ? (
        <div className="glass rounded-2xl border border-[var(--border)] overflow-hidden">
          <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-1)]">
            <h3 className="font-semibold text-[var(--text-primary)]">Full Audit History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--bg-2)] text-[var(--text-muted)]">
                <tr>
                  <th className="p-4 font-medium">URL</th>
                  <th className="p-4 font-medium">Score</th>
                  <th className="p-4 font-medium">Grade</th>
                  <th className="p-4 font-medium">Date</th>
                  <th className="p-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.audits?.map((a: any) => (
                  <tr key={a.id} className="hover:bg-[var(--bg-1)]/50 transition-colors">
                    <td className="p-4 text-[var(--text-primary)] font-medium">{a.url}</td>
                    <td className="p-4 text-[var(--text-secondary)]">{a.score > 0 ? `${a.score}/100` : "-"}</td>
                    <td className="p-4">
                        <span className={`text-xs px-2 py-1 rounded-full font-bold ${a.grade === 'A' ? 'bg-emerald-500/10 text-emerald-500' : a.grade === 'B' ? 'bg-blue-500/10 text-blue-500' : a.grade === 'Pending' ? 'bg-zinc-800 text-zinc-500' : 'bg-amber-500/10 text-amber-500'}`}>
                          {a.grade}
                        </span>
                      </td>
                    <td className="p-4 text-[var(--text-secondary)]">{new Date(a.createdAt).toLocaleDateString()}</td>
                    <td className="p-4 text-xs text-[var(--text-muted)] uppercase">{a.status}</td>
                  </tr>
                ))}
                {(!data.audits || data.audits.length === 0) && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-[var(--text-muted)]">No audit history found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="glass rounded-2xl border border-[var(--border)] overflow-hidden">
          <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-1)]">
            <h3 className="font-semibold text-[var(--text-primary)]">Monitored AI Agents</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.agents?.length > 0 ? (
                data.agents.map((agent: any) => (
                  <div key={agent.id} className="bg-[var(--bg-1)] border border-[var(--border)] rounded-xl p-4">
                    <div className="font-medium text-[var(--text-primary)]">{agent.name}</div>
                    <div className="text-xs text-[var(--text-secondary)] mb-2">{agent.model}</div>
                    <div className="text-xs text-[var(--text-muted)] line-clamp-2 mb-3">{agent.description}</div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className={`w-2 h-2 rounded-full ${agent.status === 'active' ? 'bg-emerald-500' : 'bg-zinc-500'}`}></span>
                      <span className="text-[var(--text-secondary)] capitalize">{agent.status}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full py-8 text-center text-[var(--text-muted)]">No agents configured.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
