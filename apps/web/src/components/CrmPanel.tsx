"use client";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Users, Building2, LayoutDashboard, Briefcase, Activity, Plus, BrainCircuit, Mail, Phone, Calendar, StickyNote } from "lucide-react";

export default function CrmPanel() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"dashboard" | "companies" | "contacts" | "deals" | "activities">("dashboard");
  
  const [companies, setCompanies] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Forms
  const [newCompany, setNewCompany] = useState({ name: "", website: "", industry: "" });
  const [newContact, setNewContact] = useState({ companyId: "", name: "", email: "", phone: "" });
  const [newDeal, setNewDeal] = useState({ contactId: "", title: "", amount: "", stage: "prospecting", probability: "50", expectedCloseDate: "" });
  const [newActivity, setNewActivity] = useState({ type: "note", notes: "", contactId: "", dealId: "" });

  const fetchCrmData = async () => {
    setLoading(true);
    try {
      const headers = { "X-Org-Id": user?.orgName || "default_org" };
      const [cmpRes, cntRes, dlRes, actRes] = await Promise.all([
        fetch("/api/v1/crm/companies", { headers }),
        fetch("/api/v1/crm/contacts", { headers }),
        fetch("/api/v1/crm/deals", { headers }),
        fetch("/api/v1/crm/activities", { headers })
      ]);
      const cmpData = await cmpRes.json();
      const cntData = await cntRes.json();
      const dlData = await dlRes.json();
      const actData = await actRes.json();
      
      setCompanies(cmpData.companies || []);
      setContacts(cntData.contacts || []);
      setDeals(dlData.deals || []);
      setActivities(actData.activities || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchCrmData();
  }, [user]);

  // --- Handlers ---
  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompany.name) return;
    await fetch("/api/v1/crm/companies", {
      method: "POST", headers: { "Content-Type": "application/json", "X-Org-Id": user?.orgName || "default_org" },
      body: JSON.stringify(newCompany)
    });
    setNewCompany({ name: "", website: "", industry: "" });
    fetchCrmData();
  };

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContact.name || !newContact.email) return;
    await fetch("/api/v1/crm/contacts", {
      method: "POST", headers: { "Content-Type": "application/json", "X-Org-Id": user?.orgName || "default_org" },
      body: JSON.stringify(newContact)
    });
    setNewContact({ companyId: "", name: "", email: "", phone: "" });
    fetchCrmData();
  };

  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeal.title || !newDeal.contactId) return;
    await fetch("/api/v1/crm/deals", {
      method: "POST", headers: { "Content-Type": "application/json", "X-Org-Id": user?.orgName || "default_org" },
      body: JSON.stringify(newDeal)
    });
    setNewDeal({ contactId: "", title: "", amount: "", stage: "prospecting", probability: "50", expectedCloseDate: "" });
    fetchCrmData();
  };

  const handleCreateActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActivity.notes || !newActivity.type) return;
    await fetch("/api/v1/crm/activities", {
      method: "POST", headers: { "Content-Type": "application/json", "X-Org-Id": user?.orgName || "default_org" },
      body: JSON.stringify(newActivity)
    });
    setNewActivity({ type: "note", notes: "", contactId: "", dealId: "" });
    fetchCrmData();
  };

  const moveDeal = async (dealId: string, stage: string) => {
    await fetch("/api/v1/crm/deals", {
      method: "PATCH", headers: { "Content-Type": "application/json", "X-Org-Id": user?.orgName || "default_org" },
      body: JSON.stringify({ dealId, stage })
    });
    fetchCrmData();
  };

  // --- Derived Metrics ---
  const activeDeals = deals.filter(d => d.stage !== 'won' && d.stage !== 'lost');
  const pipelineValue = activeDeals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const wonDeals = deals.filter(d => d.stage === 'won');
  const winRate = deals.length > 0 ? Math.round((wonDeals.length / deals.length) * 100) : 0;
  
  // AI Insight (Mocked logic based on probability)
  const highRiskDeals = activeDeals.filter(d => d.probability < 40 && d.amount > 1000);
  const aiSuggestion = highRiskDeals.length > 0 
    ? `Warning: ${highRiskDeals[0].title} is a high-value deal but has a low close probability (${highRiskDeals[0].probability}%). Schedule a follow-up meeting immediately.`
    : `Your pipeline is looking healthy. Focus your efforts on the ${activeDeals.sort((a,b) => b.probability - a.probability)[0]?.title || 'next'} deal to ensure a quick win.`;

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={16} /> },
    { id: "companies", label: "Companies", icon: <Building2 size={16} /> },
    { id: "contacts", label: "Contacts", icon: <Users size={16} /> },
    { id: "deals", label: "Deals", icon: <Briefcase size={16} /> },
    { id: "activities", label: "Activities", icon: <Activity size={16} /> },
  ] as const;

  const dealStages = ["prospecting", "qualification", "proposal", "negotiation", "won", "lost"];
  const activityIcons: Record<string, React.ReactNode> = {
    email: <Mail size={14} className="text-blue-400" />,
    call: <Phone size={14} className="text-emerald-400" />,
    meeting: <Calendar size={14} className="text-purple-400" />,
    note: <StickyNote size={14} className="text-amber-400" />
  };

  return (
    <div className="space-y-6 animate-fade-in fade-in max-w-7xl mx-auto pb-20">
      
      {/* Header & Tabs */}
      <div className="flex flex-col lg:flex-row justify-between lg:items-end gap-6 bg-gradient-to-br from-[var(--bg-1)] to-[var(--bg-2)] p-6 rounded-2xl border border-[var(--border)] shadow-xl relative overflow-hidden">
        {/* Abstract Background Element */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <h2 className="text-3xl font-extrabold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent drop-shadow-sm flex items-center gap-3">
            <BrainCircuit className="text-purple-400" size={32} />
            AI CRM Engine
          </h2>
          <p className="text-[var(--text-secondary)] mt-2 max-w-lg text-sm leading-relaxed">
            Manage your entire B2B sales pipeline, track accounts, log communications, and leverage AI to identify high-risk deals and predict revenue.
          </p>
        </div>
        
        <div className="flex bg-[var(--bg-1)] p-1.5 rounded-xl border border-[var(--border)] relative z-10 shadow-inner overflow-x-auto snap-x">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`snap-start flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 whitespace-nowrap ${
                activeTab === t.id 
                  ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/25 scale-100" 
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-2)] scale-95"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-32">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
        </div>
      ) : (
        <div className="mt-6">
          
          {/* DASHBOARD TAB */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              {/* Top Metrics Row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass p-5 rounded-2xl border border-[var(--border)] shadow-sm hover:shadow-md transition-shadow">
                  <div className="text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider mb-2">Total Pipeline Value</div>
                  <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">${pipelineValue.toLocaleString()}</div>
                  <div className="text-xs text-emerald-500 mt-2 flex items-center gap-1">↑ 12% vs last month</div>
                </div>
                <div className="glass p-5 rounded-2xl border border-[var(--border)] shadow-sm hover:shadow-md transition-shadow">
                  <div className="text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider mb-2">Active Deals</div>
                  <div className="text-3xl font-bold text-[var(--text-primary)]">{activeDeals.length}</div>
                  <div className="text-xs text-[var(--text-muted)] mt-2">Across all stages</div>
                </div>
                <div className="glass p-5 rounded-2xl border border-[var(--border)] shadow-sm hover:shadow-md transition-shadow">
                  <div className="text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider mb-2">Win Rate</div>
                  <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">{winRate}%</div>
                  <div className="text-xs text-[var(--text-muted)] mt-2">Historical average</div>
                </div>
                <div className="glass p-5 rounded-2xl border border-[var(--border)] shadow-sm hover:shadow-md transition-shadow">
                  <div className="text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider mb-2">Activities Logged</div>
                  <div className="text-3xl font-bold text-[var(--text-primary)]">{activities.length}</div>
                  <div className="text-xs text-blue-400 mt-2 flex items-center gap-1">Data syncing active</div>
                </div>
              </div>

              {/* AI Insights & Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 glass p-6 rounded-2xl border border-purple-500/30 relative overflow-hidden shadow-lg shadow-purple-500/10">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-blue-500"></div>
                  <div className="flex items-center gap-3 mb-4">
                    <BrainCircuit className="text-purple-400 animate-pulse" size={24} />
                    <h3 className="font-bold text-lg text-[var(--text-primary)]">AI Sales Copilot</h3>
                  </div>
                  <p className="text-[var(--text-secondary)] leading-relaxed mb-6">
                    {aiSuggestion}
                  </p>
                  <div className="bg-[var(--bg-1)] border border-[var(--border)] rounded-xl p-4">
                    <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Predicted Closures This Week</h4>
                    {activeDeals.filter(d => d.probability >= 70).length > 0 ? (
                      <div className="space-y-3">
                        {activeDeals.filter(d => d.probability >= 70).map(d => (
                          <div key={d.id} className="flex justify-between items-center text-sm">
                            <span className="font-medium text-[var(--text-primary)]">{d.title}</span>
                            <span className="text-emerald-400">${d.amount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-[var(--text-secondary)] italic">No high-probability deals closing this week.</div>
                    )}
                  </div>
                </div>
                
                <div className="glass p-6 rounded-2xl border border-[var(--border)] shadow-sm">
                  <h3 className="font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                    <Activity size={18} className="text-blue-400" />
                    Recent Pulse
                  </h3>
                  <div className="space-y-4">
                    {activities.slice(0, 4).map(act => (
                      <div key={act.id} className="flex gap-3 items-start">
                        <div className="p-2 bg-[var(--bg-1)] rounded-full border border-[var(--border)]">
                          {activityIcons[act.type]}
                        </div>
                        <div>
                          <p className="text-sm text-[var(--text-primary)] leading-tight">{act.notes}</p>
                          <p className="text-xs text-[var(--text-muted)] mt-1">{new Date(act.date).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                    {activities.length === 0 && <div className="text-sm text-[var(--text-muted)]">No recent activity</div>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* COMPANIES TAB */}
          {activeTab === "companies" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 glass rounded-2xl border border-[var(--border)] overflow-hidden flex flex-col">
                <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-1)]/50 backdrop-blur-md">
                  <h3 className="font-semibold text-[var(--text-primary)]">Business Accounts</h3>
                </div>
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-[var(--bg-2)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                      <tr>
                        <th className="p-4 font-semibold">Company Name</th>
                        <th className="p-4 font-semibold">Industry</th>
                        <th className="p-4 font-semibold">Website</th>
                        <th className="p-4 font-semibold">Contacts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {companies.map((c) => (
                        <tr key={c.id} className="hover:bg-[var(--bg-1)]/50 transition-colors">
                          <td className="p-4 font-medium text-[var(--text-primary)] flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-blue-500/20">
                              <Building2 size={14} className="text-blue-400" />
                            </div>
                            {c.name}
                          </td>
                          <td className="p-4 text-[var(--text-secondary)]">{c.industry || "—"}</td>
                          <td className="p-4 text-blue-400 hover:underline cursor-pointer">{c.website || "—"}</td>
                          <td className="p-4 text-[var(--text-secondary)]">
                            <span className="px-2.5 py-1 bg-[var(--bg-2)] rounded-full text-xs font-mono">
                              {contacts.filter(con => con.companyId === c.id).length}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {companies.length === 0 && (
                        <tr><td colSpan={4} className="p-8 text-center text-[var(--text-muted)]">No companies tracked yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="glass rounded-2xl border border-[var(--border)] p-6 h-fit sticky top-6">
                <h3 className="font-semibold mb-4 text-[var(--text-primary)] flex items-center gap-2">
                  <Plus size={18} className="text-emerald-400" /> Add Account
                </h3>
                <form onSubmit={handleCreateCompany} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Company Name *</label>
                    <input required type="text" value={newCompany.name} onChange={e => setNewCompany({...newCompany, name: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none transition-all placeholder:text-[var(--text-muted)]" placeholder="Stark Industries" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Industry</label>
                    <input type="text" value={newCompany.industry} onChange={e => setNewCompany({...newCompany, industry: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none transition-all placeholder:text-[var(--text-muted)]" placeholder="Defense Technology" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Website</label>
                    <input type="url" value={newCompany.website} onChange={e => setNewCompany({...newCompany, website: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none transition-all placeholder:text-[var(--text-muted)]" placeholder="https://stark.com" />
                  </div>
                  <button type="submit" className="w-full py-2.5 mt-2 bg-[var(--bg-primary)] hover:bg-[var(--bg-primary-hover)] text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-blue-500/20 active:scale-[0.98]">
                    Save Account
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* CONTACTS TAB */}
          {activeTab === "contacts" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 glass rounded-2xl border border-[var(--border)] overflow-hidden flex flex-col">
                <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-1)]/50 backdrop-blur-md">
                  <h3 className="font-semibold text-[var(--text-primary)]">People Directory</h3>
                </div>
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-[var(--bg-2)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                      <tr>
                        <th className="p-4 font-semibold">Name</th>
                        <th className="p-4 font-semibold">Email</th>
                        <th className="p-4 font-semibold">Company</th>
                        <th className="p-4 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {contacts.map((c) => (
                        <tr key={c.id} className="hover:bg-[var(--bg-1)]/50 transition-colors">
                          <td className="p-4 font-medium text-[var(--text-primary)]">{c.name}</td>
                          <td className="p-4 text-[var(--text-secondary)]">{c.email}</td>
                          <td className="p-4 text-[var(--text-secondary)]">
                            {companies.find(cmp => cmp.id === c.companyId)?.name || "—"}
                          </td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${
                              c.status === 'lead' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 
                              c.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 
                              'bg-zinc-500/10 text-zinc-500 border border-zinc-500/20'
                            }`}>
                              {c.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {contacts.length === 0 && (
                        <tr><td colSpan={4} className="p-8 text-center text-[var(--text-muted)]">No contacts yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="glass rounded-2xl border border-[var(--border)] p-6 h-fit sticky top-6">
                <h3 className="font-semibold mb-4 text-[var(--text-primary)] flex items-center gap-2">
                  <Plus size={18} className="text-purple-400" /> Add Contact
                </h3>
                <form onSubmit={handleCreateContact} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Full Name *</label>
                    <input required type="text" value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500/50 outline-none transition-all placeholder:text-[var(--text-muted)]" placeholder="Tony Stark" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Email Address *</label>
                    <input required type="email" value={newContact.email} onChange={e => setNewContact({...newContact, email: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500/50 outline-none transition-all placeholder:text-[var(--text-muted)]" placeholder="tony@stark.com" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Company</label>
                    <select value={newContact.companyId} onChange={e => setNewContact({...newContact, companyId: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500/50 outline-none transition-all text-[var(--text-primary)]">
                      <option value="">None / Independent</option>
                      {companies.map(cmp => <option key={cmp.id} value={cmp.id}>{cmp.name}</option>)}
                    </select>
                  </div>
                  <button type="submit" className="w-full py-2.5 mt-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-purple-500/20 active:scale-[0.98]">
                    Save Contact
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* DEALS TAB */}
          {activeTab === "deals" && (
            <div className="flex flex-col h-[calc(100vh-250px)] min-h-[600px] gap-6">
              {/* Kanban Board */}
              <div className="flex-1 flex gap-4 overflow-x-auto pb-4 snap-x">
                {dealStages.map(stage => {
                  const stageDeals = deals.filter(d => d.stage === stage);
                  const stageValue = stageDeals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
                  
                  return (
                    <div key={stage} className="flex-none w-80 flex flex-col bg-[var(--bg-1)]/30 rounded-2xl border border-[var(--border)] snap-start overflow-hidden">
                      <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-1)]/80 backdrop-blur-sm sticky top-0 z-10 flex justify-between items-center">
                        <div>
                          <h4 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">{stage.replace("-", " ")}</h4>
                          <span className="text-xs font-medium text-[var(--text-muted)]">${stageValue.toLocaleString()}</span>
                        </div>
                        <span className="w-6 h-6 rounded-full bg-[var(--bg-2)] flex items-center justify-center text-xs font-bold text-[var(--text-secondary)] border border-[var(--border)]">
                          {stageDeals.length}
                        </span>
                      </div>
                      
                      <div className="flex-1 p-3 space-y-3 overflow-y-auto custom-scrollbar">
                        {stageDeals.map(d => {
                          const contact = contacts.find(c => c.id === d.contactId);
                          const company = companies.find(cmp => cmp.id === contact?.companyId);
                          
                          return (
                            <div key={d.id} className="glass p-4 rounded-xl border border-[var(--border)] shadow-sm hover:border-blue-500/40 hover:shadow-blue-500/5 transition-all group">
                              <div className="flex justify-between items-start mb-2">
                                <div className="font-semibold text-[var(--text-primary)] text-sm leading-tight group-hover:text-blue-400 transition-colors">{d.title}</div>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  d.probability >= 70 ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 
                                  d.probability >= 40 ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 
                                  'bg-red-500/10 text-red-500 border border-red-500/20'
                                }`}>
                                  {d.probability}% AI
                                </span>
                              </div>
                              
                              <div className="text-xs text-[var(--text-secondary)] mb-3 flex items-center gap-1">
                                <Users size={12} className="text-[var(--text-muted)]" />
                                {contact?.name || "Unknown"}
                                {company && <span className="opacity-60">• {company.name}</span>}
                              </div>
                              
                              <div className="flex justify-between items-center mt-auto pt-3 border-t border-[var(--border)]">
                                <span className="text-emerald-400 font-mono text-sm font-medium">${Number(d.amount).toLocaleString()}</span>
                                <select 
                                  value={d.stage}
                                  onChange={(e) => moveDeal(d.id, e.target.value)}
                                  className="bg-[var(--bg-2)] border border-[var(--border)] text-xs rounded-lg px-2 py-1.5 text-[var(--text-secondary)] outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer appearance-none hover:bg-[var(--bg-1)] transition-colors"
                                >
                                  {dealStages.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add Deal Bar */}
              <div className="glass p-4 rounded-2xl border border-[var(--border)] flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Deal Title</label>
                  <input required type="text" value={newDeal.title} onChange={e => setNewDeal({...newDeal, title: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none placeholder:text-[var(--text-muted)]" placeholder="Q3 License Upgrade" />
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Contact</label>
                  <select required value={newDeal.contactId} onChange={e => setNewDeal({...newDeal, contactId: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none">
                    <option value="" disabled>Select...</option>
                    {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="w-32">
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Amount ($)</label>
                  <input required type="number" value={newDeal.amount} onChange={e => setNewDeal({...newDeal, amount: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none" placeholder="10000" />
                </div>
                <div className="w-24">
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">AI Prob (%)</label>
                  <input required type="number" min="0" max="100" value={newDeal.probability} onChange={e => setNewDeal({...newDeal, probability: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none" placeholder="50" />
                </div>
                <button onClick={handleCreateDeal} disabled={contacts.length === 0 || !newDeal.title} className="py-2 px-6 bg-[var(--bg-primary)] hover:bg-[var(--bg-primary-hover)] text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-blue-500/20 active:scale-[0.98] disabled:opacity-50">
                  + Add Deal
                </button>
              </div>
            </div>
          )}

          {/* ACTIVITIES TAB */}
          {activeTab === "activities" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 glass rounded-2xl border border-[var(--border)] p-6">
                <h3 className="font-bold text-lg text-[var(--text-primary)] mb-6 border-b border-[var(--border)] pb-4 flex items-center gap-2">
                  <Activity className="text-blue-400" size={20} /> Team Activity Feed
                </h3>
                
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-[var(--border)] before:to-transparent">
                  {activities.map(act => {
                    const contact = contacts.find(c => c.id === act.contactId);
                    const deal = deals.find(d => d.id === act.dealId);
                    
                    return (
                      <div key={act.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-[var(--bg-0)] bg-[var(--bg-2)] shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 text-[var(--text-primary)]">
                          {activityIcons[act.type]}
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-2xl bg-[var(--bg-1)] border border-[var(--border)] shadow-sm group-hover:border-blue-500/30 transition-colors">
                          <div className="flex items-center justify-between mb-1 text-xs text-[var(--text-muted)] font-medium">
                            <span className="uppercase tracking-wider text-blue-400">{act.type}</span>
                            <time>{new Date(act.date).toLocaleDateString()} {new Date(act.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</time>
                          </div>
                          <p className="text-sm text-[var(--text-primary)] leading-relaxed mt-2">{act.notes}</p>
                          {(contact || deal) && (
                            <div className="mt-3 pt-3 border-t border-[var(--border)] flex flex-wrap gap-2 text-xs">
                              {contact && <span className="px-2 py-1 bg-[var(--bg-2)] rounded-md text-[var(--text-secondary)] border border-[var(--border)]">👤 {contact.name}</span>}
                              {deal && <span className="px-2 py-1 bg-[var(--bg-2)] rounded-md text-[var(--text-secondary)] border border-[var(--border)]">💼 {deal.title}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {activities.length === 0 && <div className="text-center text-[var(--text-muted)] py-10 relative z-10 bg-[var(--bg-0)]">No activities logged yet.</div>}
                </div>
              </div>

              <div className="glass rounded-2xl border border-[var(--border)] p-6 h-fit sticky top-6">
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6">
                  <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <BrainCircuit size={14} /> Coming Soon: AI Email Sync
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    We will soon introduce automated Gmail/Outlook syncing. For now, log your activities manually below to train the AI context engine.
                  </p>
                </div>
                
                <h3 className="font-semibold mb-4 text-[var(--text-primary)]">Log New Activity</h3>
                <form onSubmit={handleCreateActivity} className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    {["email", "call", "meeting", "note"].map((type) => (
                      <label key={type} className={`flex items-center justify-center gap-2 p-2 rounded-lg border text-xs font-medium cursor-pointer transition-all ${newActivity.type === type ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' : 'bg-[var(--bg-1)] border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-2)]'}`}>
                        <input type="radio" name="type" value={type} checked={newActivity.type === type} onChange={() => setNewActivity({...newActivity, type})} className="hidden" />
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </label>
                    ))}
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Related Contact (Optional)</label>
                    <select value={newActivity.contactId} onChange={e => setNewActivity({...newActivity, contactId: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none text-[var(--text-primary)]">
                      <option value="">None</option>
                      {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Related Deal (Optional)</label>
                    <select value={newActivity.dealId} onChange={e => setNewActivity({...newActivity, dealId: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none text-[var(--text-primary)]">
                      <option value="">None</option>
                      {deals.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Activity Notes *</label>
                    <textarea required value={newActivity.notes} onChange={e => setNewActivity({...newActivity, notes: e.target.value})} rows={4} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none transition-all placeholder:text-[var(--text-muted)] resize-none" placeholder="Discussed pricing for Q3 deployment..."></textarea>
                  </div>
                  
                  <button type="submit" className="w-full py-2.5 mt-2 bg-[var(--bg-primary)] hover:bg-[var(--bg-primary-hover)] text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-blue-500/20 active:scale-[0.98]">
                    Save Activity
                  </button>
                </form>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
