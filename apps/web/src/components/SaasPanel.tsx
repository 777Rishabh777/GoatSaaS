"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

export default function SaasPanel() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);

  const asNumber = (v: any) => {
    const n = typeof v === "number" ? v : parseFloat(String(v));
    return Number.isFinite(n) ? n : 0;
  };
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Form states
  const [newSub, setNewSub] = useState({ name: "", vendorId: "", amount: "", currency: "USD", billingCycle: "monthly", renewalDate: "", category: "other" });
  const [syncing, setSyncing] = useState(false);
  const [editingSub, setEditingSub] = useState<any>(null);
  
  // Integration & Project States
  const [projects, setProjects] = useState<any[]>([]);
  const [showIntegrationModal, setShowIntegrationModal] = useState(false);
  const [integrationPlatform, setIntegrationPlatform] = useState("aws");
  const [integrationKey, setIntegrationKey] = useState("");
  const [integrating, setIntegrating] = useState(false);
  
  // Gmail States
  const [showGmailModal, setShowGmailModal] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resSaas, resProj] = await Promise.all([
        fetch("/api/v1/saas", { headers: { "X-Org-Id": user?.orgName || "default_org" } }),
        fetch("/api/v1/projects", { headers: { "X-Org-Id": user?.orgName || "default_org" } })
      ]);
      if (resSaas.ok) setData(await resSaas.json());
      if (resProj.ok) {
        const pData = await resProj.json();
        setProjects(pData.projects || []);
      }
    } catch (e) {
      console.error("Failed to load data", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const handleAddSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSub.name || !newSub.amount) return;
    try {
      const res = await fetch("/api/v1/saas", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Org-Id": user?.orgName || "default_org" },
        body: JSON.stringify({ entity: "subscription", data: { ...newSub, amount: Number(newSub.amount) } })
      });
      if (res.ok) {
        setNewSub({ name: "", vendorId: "", amount: "", currency: "USD", billingCycle: "monthly", renewalDate: "", category: "other" });
        fetchData();
        setActiveTab("subscriptions");
      }
    } catch (e) {
      console.error("Failed to add subscription", e);
    }
  };

  const updateSubscriptionStatus = async (id: string, status: string) => {
    try {
      await fetch("/api/v1/saas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Org-Id": user?.orgName || "default_org" },
        body: JSON.stringify({ entity: "subscription", id, data: { status } })
      });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleGmailSync = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSyncing(true);

    const llmProvider = localStorage.getItem("LLM_PROVIDER");
    const llmKey = localStorage.getItem("LLM_API_KEY");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Org-Id": user?.orgName || "default_org",
    };
    if (llmProvider) headers["X-LLM-Provider"] = llmProvider;
    if (llmKey) headers["X-LLM-Key"] = llmKey;

    try {
      const res = await fetch("/api/v1/saas/gmail-sync?action=scan", {
        method: "POST",
        headers,
        body: JSON.stringify({ maxMessages: 10 }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        await fetchData();
        setShowGmailModal(false);
        setActiveTab("subscriptions");
      } else if (data?.connectUrl) {
        window.location.href = data.connectUrl;
      } else {
        alert(data.error || "Failed to scan Gmail");
      }
    } catch (e) {
      console.error(e);
    }

    setSyncing(false);
  };

  const handleCancel = async (id: string) => {
    if (confirm("Are you sure you want to cancel this subscription?")) {
      await updateSubscriptionStatus(id, "cancelled");
    }
  };

  const handleRenew = async (sub: any) => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + (sub.billingCycle === "annual" ? 12 : 1));
    try {
      await fetch("/api/v1/saas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Org-Id": user?.orgName || "default_org" },
        body: JSON.stringify({ entity: "subscription", id: sub.id, data: { status: "active", renewalDate: nextMonth.toISOString() } })
      });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleModify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSub) return;
    try {
      await fetch("/api/v1/saas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Org-Id": user?.orgName || "default_org" },
        body: JSON.stringify({ entity: "subscription", id: editingSub.id, data: { amount: Number(editingSub.amount), billingCycle: editingSub.billingCycle } })
      });
      setEditingSub(null);
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleLiveIntegration = async (e: React.FormEvent) => {
    e.preventDefault();
    setIntegrating(true);
    try {
      const res = await fetch("/api/v1/saas/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Org-Id": user?.orgName || "default_org" },
        body: JSON.stringify({ platform: integrationPlatform, apiKey: integrationKey })
      });
      if (res.ok) {
        setShowIntegrationModal(false);
        setIntegrationKey("");
        fetchData();
        setActiveTab("subscriptions");
      }
    } catch (error) {
      console.error("Integration failed", error);
    }
    setIntegrating(false);
  };

  const assignProject = async (subId: string, projectId: string) => {
    try {
      await fetch("/api/v1/saas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Org-Id": user?.orgName || "default_org" },
        body: JSON.stringify({ entity: "subscription", id: subId, data: { projectId: projectId === "none" ? null : projectId } })
      });
      fetchData();
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-6 animate-fade-in fade-in max-w-7xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent flex items-center gap-2">
            <span>💳</span> SaaS Management
          </h2>
          <p className="text-[var(--text-secondary)] mt-1">Track subscriptions, monitor spend, and manage team licenses.</p>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={() => setShowIntegrationModal(true)} className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-700 hover:border-emerald-500 hover:bg-zinc-800 transition-all rounded-lg text-sm font-medium text-white shadow-sm">
            <span className="text-lg">🔌</span>
            Connect Live API
          </button>
          <button onClick={() => setShowGmailModal(true)} disabled={syncing} className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-700 hover:border-purple-500 hover:bg-zinc-800 transition-all rounded-lg text-sm font-medium text-white shadow-sm disabled:opacity-50">
            <span className="text-lg">📧</span>
            Sync with Gmail
          </button>
        </div>
      </div>

      <div className="flex gap-2 bg-[var(--bg-1)] p-1 rounded-xl border border-[var(--border)] overflow-x-auto w-full hide-scrollbar">
        {["overview", "subscriptions", "vendors", "team", "usage", "entitlements"].map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === t ? "bg-purple-600 text-white shadow-lg shadow-purple-900/20" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
          >
            {t === "usage" ? "Usage Tracking" : t === "entitlements" ? "Plan Features" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-[var(--text-muted)] animate-pulse">Loading SaaS Data...</div>
      ) : !data ? null : activeTab === "overview" ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="glass rounded-2xl p-6 border border-[var(--border)]">
              <div className="text-sm font-medium text-[var(--text-secondary)] mb-2">Monthly Spend</div>
              <div className="text-3xl font-bold text-[var(--text-primary)]">${asNumber(data.overview?.totalMonthlySpend).toLocaleString()}</div>
            </div>
            <div className="glass rounded-2xl p-6 border border-[var(--border)]">
              <div className="text-sm font-medium text-[var(--text-secondary)] mb-2">Active Subscriptions</div>
              <div className="text-3xl font-bold text-[var(--text-primary)]">{data.overview?.activeSubscriptions || 0}</div>
            </div>
            <div className="glass rounded-2xl p-6 border border-[var(--border)]">
              <div className="text-sm font-medium text-[var(--text-secondary)] mb-2">Upcoming Renewals</div>
              <div className="text-3xl font-bold text-amber-400">{data.overview?.upcomingRenewals || 0}</div>
            </div>
            <div className="glass rounded-2xl p-6 border border-[var(--border)]">
              <div className="text-sm font-medium text-[var(--text-secondary)] mb-2">Unused Seats</div>
              <div className="text-3xl font-bold text-emerald-400">{data.overview?.unusedSeats || 0}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass rounded-2xl border border-[var(--border)] p-6">
              <h3 className="font-semibold mb-4 text-[var(--text-primary)]">Upcoming Renewals</h3>
              <div className="space-y-4">
                {data.upcomingRenewals?.length > 0 ? (
                  data.upcomingRenewals.map((sub: any) => {
                    const daysAway = Math.ceil((new Date(sub.renewalDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                    const isSoon = daysAway <= 7 && daysAway >= 0;
                    return (
                      <div key={sub.id} className={`flex justify-between items-center p-4 rounded-xl border ${isSoon ? 'bg-amber-500/10 border-amber-500/50' : 'bg-[var(--bg-1)] border-[var(--border)]'}`}>
                        <div>
                          <div className="font-medium text-[var(--text-primary)] flex items-center gap-2">
                            {sub.name}
                            {isSoon && <span className="text-[10px] font-bold bg-amber-500 text-amber-950 px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse">Renews in {daysAway} days</span>}
                          </div>
                          <div className="text-xs text-[var(--text-secondary)] mt-1">Renews: {new Date(sub.renewalDate).toLocaleDateString()}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-[var(--text-primary)]">${sub.amount}</div>
                          <div className="text-xs text-[var(--text-muted)] uppercase">{sub.billingCycle}</div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-xl">No upcoming renewals in the next 45 days.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === "subscriptions" ? (
        <div className="space-y-6">
          {/* Header with filters and stats */}
          <div className="glass rounded-2xl border border-[var(--border)] p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Subscriptions</h3>
                <p className="text-sm text-[var(--text-secondary)]">Track and manage all your software subscriptions</p>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <select 
                  value={categoryFilter} 
                  onChange={e => setCategoryFilter(e.target.value)}
                  className="bg-[var(--bg-1)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                >
                  <option value="all">All Categories</option>
                  <option value="productivity">Productivity</option>
                  <option value="dev tools">Dev Tools</option>
                  <option value="marketing">Marketing</option>
                  <option value="other">Other</option>
                </select>
                <div className="text-xs bg-purple-500/20 text-purple-400 px-4 py-2 rounded-full font-medium whitespace-nowrap">
                  ${data.subscriptions
                    ?.filter((s: any) => categoryFilter === "all" || s.category === categoryFilter)
                    .reduce((acc: number, sub: any) => {
                      const amt = asNumber(sub.amount);
                      return acc + (sub.billingCycle === "annual" ? amt / 12 : amt);
                    }, 0)
                    .toFixed(2)} / mo
                </div>
                <div className="text-xs bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-full font-medium whitespace-nowrap">
                  ${data.subscriptions
                    ?.filter((s: any) => categoryFilter === "all" || s.category === categoryFilter)
                    .reduce((acc: number, sub: any) => {
                      const amt = asNumber(sub.amount);
                      return acc + (sub.billingCycle === "annual" ? amt : amt * 12);
                    }, 0)
                    .toFixed(2)} / yr
                </div>
              </div>
            </div>
          </div>

          {/* Subscriptions Grid - Responsive Cards */}
          <div>
            {data.subscriptions?.filter((s:any) => categoryFilter === 'all' || s.category === categoryFilter).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.subscriptions?.filter((s:any) => categoryFilter === 'all' || s.category === categoryFilter).map((sub: any) => {
                  const daysAway = Math.ceil((new Date(sub.renewalDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                  const isSoon = daysAway <= 7 && daysAway >= 0;
                  const isExpired = daysAway < 0;
                  return (
                    <div key={sub.id} className={`glass rounded-2xl border p-5 transition-all ${isSoon && !isExpired ? 'border-amber-500/50 bg-amber-500/5' : isExpired ? 'border-red-500/50 bg-red-500/5' : 'border-[var(--border)] hover:border-purple-500/50'}`}>
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h4 className="font-semibold text-[var(--text-primary)]">{sub.name}</h4>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <span className="text-xs bg-zinc-800/60 text-zinc-300 px-2.5 py-1 rounded-md capitalize">{sub.category || "other"}</span>
                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${sub.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : sub.status === 'cancelled' ? 'bg-red-500/20 text-red-400' : 'bg-zinc-700/40 text-zinc-300'}`}>
                              {sub.status}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-[var(--text-primary)]">${asNumber(sub.amount).toFixed(2)}</div>
                          <div className="text-xs text-[var(--text-secondary)] capitalize">{sub.billingCycle}</div>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="space-y-3 pb-4 border-b border-[var(--border)] mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-[var(--text-secondary)]">Renewal:</span>
                          <span className={`font-medium ${isSoon && !isExpired ? 'text-amber-400' : isExpired ? 'text-red-400' : 'text-[var(--text-primary)]'}`}>
                            {new Date(sub.renewalDate).toLocaleDateString()}
                            {isSoon && !isExpired && <span className="ml-1 inline-block w-2 h-2 bg-amber-400 rounded-full animate-pulse align-middle"></span>}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-[var(--text-secondary)]">Project:</span>
                          <select 
                            value={sub.projectId || "none"}
                            onChange={(e) => assignProject(sub.id, e.target.value)}
                            className="bg-[var(--bg-1)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                          >
                            <option value="none">Unassigned</option>
                            {projects.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        {sub.status === 'active' ? (
                          <>
                            <button onClick={() => setEditingSub(sub)} className="flex-1 text-xs bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 px-3 py-2 rounded-lg border border-purple-500/30 transition-colors font-medium">
                              Modify
                            </button>
                            <button onClick={() => handleCancel(sub.id)} className="flex-1 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 px-3 py-2 rounded-lg border border-red-500/30 transition-colors font-medium">
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button onClick={() => handleRenew(sub)} className="w-full text-xs bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 px-3 py-2 rounded-lg border border-emerald-500/30 transition-colors font-medium">
                            Renew
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-[var(--text-muted)]">
                <div className="text-lg mb-2">No subscriptions found</div>
                <div className="text-sm">Add your first subscription to get started</div>
              </div>
            )}
          </div>

          {/* Add Subscription Panel */}
          <div className="glass rounded-2xl border border-[var(--border)] p-6">
            <h3 className="font-semibold mb-4 text-[var(--text-primary)] flex items-center gap-2 text-lg">
              <span className="text-purple-400">➕</span> Add New Subscription
            </h3>
            <form onSubmit={handleAddSubscription} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">Software Name</label>
                <input required type="text" value={newSub.name} onChange={e => setNewSub({...newSub, name: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50" placeholder="GitHub Copilot" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">Amount ($)</label>
                <input required type="number" step="0.01" value={newSub.amount} onChange={e => setNewSub({...newSub, amount: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50" placeholder="19.00" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">Cycle</label>
                <select value={newSub.billingCycle} onChange={e => setNewSub({...newSub, billingCycle: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50">
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">Renewal Date</label>
                <input required type="date" value={newSub.renewalDate} onChange={e => setNewSub({...newSub, renewalDate: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 [color-scheme:dark]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">Category</label>
                <select value={newSub.category} onChange={e => setNewSub({...newSub, category: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50">
                  <option value="productivity">Productivity</option>
                  <option value="dev tools">Dev Tools</option>
                  <option value="marketing">Marketing</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="md:col-span-2 lg:col-span-3 flex items-end">
                <button type="submit" className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-lg text-sm font-medium transition-all transform active:scale-[0.98] shadow-lg shadow-purple-500/20">
                  Save Subscription
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : activeTab === "vendors" ? (
        <div className="glass rounded-2xl border border-[var(--border)] overflow-hidden">
          <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-1)]">
            <h3 className="font-semibold text-[var(--text-primary)]">Vendor Directory</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--bg-2)] text-[var(--text-muted)]">
                <tr>
                  <th className="p-4 font-medium">Vendor</th>
                  <th className="p-4 font-medium">Website</th>
                  <th className="p-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.vendors?.length > 0 ? (
                  data.vendors.map((vendor: any) => (
                    <tr key={vendor.id} className="hover:bg-[var(--bg-1)]/50 transition-colors">
                      <td className="p-4 text-[var(--text-primary)] font-medium">{vendor.name}</td>
                      <td className="p-4 text-[var(--text-secondary)]">{vendor.website || "-"}</td>
                      <td className="p-4">
                        <span className={`text-xs px-2 py-1 rounded-full ${vendor.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-800 text-zinc-400'}`}>
                          {vendor.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-[var(--text-muted)]">No vendors registered.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === "team" ? (
        <div className="glass rounded-2xl border border-[var(--border)] overflow-hidden">
          <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-1)] flex justify-between items-center">
            <h3 className="font-semibold text-[var(--text-primary)]">Team Licenses</h3>
            <button className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-medium border border-zinc-700">Sync Directory</button>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.teamMembers?.length > 0 ? (
                data.teamMembers.map((member: any) => (
                  <div key={member.id} className="bg-[var(--bg-1)] border border-[var(--border)] rounded-xl p-4">
                    <div className="font-medium text-[var(--text-primary)]">{member.name}</div>
                    <div className="text-xs text-[var(--text-secondary)]">{member.email}</div>
                    <div className="mt-4 pt-3 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
                      Role: <span className="capitalize text-[var(--text-secondary)]">{member.role}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full py-8 text-center text-[var(--text-muted)]">No team members mapped.</div>
              )}
            </div>
          </div>
        </div>
      ) : activeTab === "usage" ? (
        <div className="glass rounded-2xl border border-[var(--border)] overflow-hidden">
          <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-1)] flex justify-between items-center">
            <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2"><span>📊</span> Metered Usage Tracking</h3>
            <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded border border-emerald-500/20">Live</span>
          </div>
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">📈</div>
            <h4 className="text-lg font-bold text-[var(--text-primary)]">Usage Billing Dashboard</h4>
            <p className="text-[var(--text-secondary)] mt-2 max-w-md mx-auto">This section visualizes the newly added <code>usage_records</code> database table. It tracks API calls, storage, and metered billing for your tenants in real-time.</p>
          </div>
        </div>
      ) : activeTab === "entitlements" ? (
        <div className="glass rounded-2xl border border-[var(--border)] overflow-hidden">
          <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-1)] flex justify-between items-center">
            <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2"><span>🛡️</span> Plan Features & Overrides</h3>
            <span className="text-xs bg-purple-500/10 text-purple-400 px-2 py-1 rounded border border-purple-500/20">Premium</span>
          </div>
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">⚙️</div>
            <h4 className="text-lg font-bold text-[var(--text-primary)]">Entitlements Manager</h4>
            <p className="text-[var(--text-secondary)] mt-2 max-w-md mx-auto">Manage feature toggles and custom tenant overrides. This connects directly to the <code>plan_features</code> tables to restrict or grant access dynamically.</p>
          </div>
        </div>
      ) : null}

      {editingSub && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-0)] border border-[var(--border)] p-6 rounded-2xl w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold mb-4 flex justify-between items-center">
              Modify Subscription
              <button onClick={() => setEditingSub(null)} className="text-[var(--text-muted)] hover:text-white">&times;</button>
            </h3>
            <form onSubmit={handleModify} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Software Name</label>
                <input type="text" disabled value={editingSub.name} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm opacity-50" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Amount ($)</label>
                  <input required type="number" step="0.01" value={editingSub.amount} onChange={e => setEditingSub({...editingSub, amount: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Cycle</label>
                  <select value={editingSub.billingCycle} onChange={e => setEditingSub({...editingSub, billingCycle: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50">
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-purple-500/20 mt-4">
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {showIntegrationModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-0)] border border-[var(--border)] p-6 rounded-2xl w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold mb-4 flex justify-between items-center">
              Connect Live API
              <button onClick={() => setShowIntegrationModal(false)} className="text-[var(--text-muted)] hover:text-white">&times;</button>
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">Select a platform and provide an API key to automatically import billing usage.</p>
            <form onSubmit={handleLiveIntegration} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Platform</label>
                <select value={integrationPlatform} onChange={e => setIntegrationPlatform(e.target.value)} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
                  <option value="aws">AWS</option>
                  <option value="vercel">Vercel</option>
                  <option value="stripe">Stripe</option>
                  <option value="github">GitHub</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">API Key / Token</label>
                <input required type="password" value={integrationKey} onChange={e => setIntegrationKey(e.target.value)} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50" placeholder="sk_..." />
              </div>
              <button disabled={integrating} type="submit" className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-emerald-500/20 mt-4 disabled:opacity-50">
                {integrating ? "Connecting..." : "Connect API"}
              </button>
            </form>
          </div>
        </div>
      )}

      {showGmailModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-0)] border border-[var(--border)] p-6 rounded-2xl w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold mb-4 flex justify-between items-center">
              Sign in with Google
              <button onClick={() => setShowGmailModal(false)} className="text-[var(--text-muted)] hover:text-white">&times;</button>
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">Connect your Google Workspace or Gmail account, then scan your inbox for subscription receipts and automatically add them to your account.</p>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => (window.location.href = "/api/v1/saas/gmail-sync?action=connect")}
                className="w-full py-2.5 bg-white text-black hover:bg-zinc-200 rounded-lg text-sm font-medium transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <span className="text-xl">G</span>
                Connect Google
              </button>

              <button
                type="button"
                disabled={syncing}
                onClick={() => handleGmailSync()}
                className="w-full py-2.5 bg-zinc-900 text-white hover:bg-zinc-800 rounded-lg text-sm font-medium transition-all border border-zinc-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {syncing ? <span className="animate-spin">⏳</span> : <span className="text-xl">📥</span>}
                {syncing ? "Scanning Inbox..." : "Scan Inbox"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
