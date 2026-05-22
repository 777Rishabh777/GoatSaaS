"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

export default function CrmPanel() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"contacts" | "deals">("contacts");
  
  const [contacts, setContacts] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [newContact, setNewContact] = useState({ name: "", email: "", phone: "", company: "" });
  const [newDeal, setNewDeal] = useState({ contactId: "", title: "", amount: "", stage: "prospecting" });

  const fetchCrmData = async () => {
    setLoading(true);
    try {
      const [cRes, dRes] = await Promise.all([
        fetch("/api/v1/crm/contacts", { headers: { "X-Org-Id": user?.orgName || "default_org" } }),
        fetch("/api/v1/crm/deals", { headers: { "X-Org-Id": user?.orgName || "default_org" } })
      ]);
      const cData = await cRes.json();
      const dData = await dRes.json();
      setContacts(cData.contacts || []);
      setDeals(dData.deals || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchCrmData();
  }, [user]);

  const addContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContact.name || !newContact.email) return;
    try {
      const res = await fetch("/api/v1/crm/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Org-Id": user?.orgName || "default_org" },
        body: JSON.stringify(newContact)
      });
      if (res.ok) {
        setNewContact({ name: "", email: "", phone: "", company: "" });
        fetchCrmData();
      }
    } catch (e) { console.error(e); }
  };

  const addDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeal.title || !newDeal.contactId) return;
    try {
      const res = await fetch("/api/v1/crm/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Org-Id": user?.orgName || "default_org" },
        body: JSON.stringify(newDeal)
      });
      if (res.ok) {
        setNewDeal({ contactId: "", title: "", amount: "", stage: "prospecting" });
        fetchCrmData();
      }
    } catch (e) { console.error(e); }
  };

  const moveDeal = async (dealId: string, stage: string) => {
    try {
      await fetch("/api/v1/crm/deals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Org-Id": user?.orgName || "default_org" },
        body: JSON.stringify({ dealId, stage })
      });
      fetchCrmData();
    } catch (e) { console.error(e); }
  };

  const stages = ["prospecting", "qualification", "proposal", "negotiation", "won", "lost"];

  return (
    <div className="space-y-6 animate-fade-in fade-in max-w-7xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            CRM Dashboard
          </h2>
          <p className="text-[var(--text-secondary)] mt-1">Manage customer relationships and track active deals.</p>
        </div>
        <div className="flex gap-2 bg-[var(--bg-1)] p-1 rounded-xl border border-[var(--border)]">
          <button
            onClick={() => setActiveTab("contacts")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "contacts" ? "bg-purple-600 text-white shadow-lg" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
          >
            Contacts
          </button>
          <button
            onClick={() => setActiveTab("deals")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "deals" ? "bg-purple-600 text-white shadow-lg" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
          >
            Deals Pipeline
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-[var(--text-muted)] animate-pulse">Loading CRM Data...</div>
      ) : activeTab === "contacts" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass rounded-2xl border border-[var(--border)] overflow-hidden">
            <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-1)]">
              <h3 className="font-semibold">Customer Directory</h3>
              <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full">{contacts.length} Contacts</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--bg-2)] text-[var(--text-muted)]">
                  <tr>
                    <th className="p-4 font-medium">Name</th>
                    <th className="p-4 font-medium">Email</th>
                    <th className="p-4 font-medium">Company</th>
                    <th className="p-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {contacts.map((c) => (
                    <tr key={c.id} className="hover:bg-[var(--bg-1)]/50 transition-colors">
                      <td className="p-4 font-medium text-[var(--text-primary)]">{c.name}</td>
                      <td className="p-4 text-[var(--text-secondary)]">{c.email}</td>
                      <td className="p-4 text-[var(--text-secondary)]">{c.company || "—"}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${c.status === 'lead' ? 'bg-amber-500/10 text-amber-500' : c.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-500/10 text-zinc-500'}`}>
                          {c.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {contacts.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-[var(--text-muted)]">No contacts found. Add one to get started.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass rounded-2xl border border-[var(--border)] p-6 h-fit sticky top-6">
            <h3 className="font-semibold mb-4 text-[var(--text-primary)]">Add New Contact</h3>
            <form onSubmit={addContact} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Full Name</label>
                <input required type="text" value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50" placeholder="John Doe" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Email Address</label>
                <input required type="email" value={newContact.email} onChange={e => setNewContact({...newContact, email: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50" placeholder="john@example.com" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Company (Optional)</label>
                <input type="text" value={newContact.company} onChange={e => setNewContact({...newContact, company: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50" placeholder="Acme Corp" />
              </div>
              <button type="submit" className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg text-sm font-medium transition-all transform active:scale-[0.98] shadow-lg shadow-purple-500/20 mt-2">
                Create Contact
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
              {stages.map(stage => (
                <div key={stage} className="flex-1 min-w-[280px] bg-[var(--bg-1)]/50 rounded-xl p-4 border border-[var(--border)] snap-start">
                  <h4 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-4 border-b border-[var(--border)] pb-2">
                    {stage.replace("-", " ")}
                  </h4>
                  <div className="space-y-3">
                    {deals.filter(d => d.stage === stage).map(d => {
                      const contact = contacts.find(c => c.id === d.contactId);
                      return (
                        <div key={d.id} className="glass p-3 rounded-lg border border-[var(--border)] shadow-sm hover:border-purple-500/30 transition-colors">
                          <div className="font-medium text-sm text-[var(--text-primary)] mb-1">{d.title}</div>
                          <div className="text-xs text-[var(--text-secondary)] mb-2">{contact?.name || "Unknown"}</div>
                          <div className="flex justify-between items-center">
                            <span className="text-emerald-400 font-mono text-sm">${d.amount.toLocaleString()}</span>
                            <select 
                              value={d.stage}
                              onChange={(e) => moveDeal(d.id, e.target.value)}
                              className="bg-zinc-900 border border-zinc-700 text-xs rounded px-1 py-0.5 text-zinc-300 outline-none focus:ring-1 focus:ring-purple-500"
                            >
                              {stages.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                    {deals.filter(d => d.stage === stage).length === 0 && (
                      <div className="text-xs text-center text-[var(--text-muted)] py-4 border border-dashed border-[var(--border)] rounded-lg">No deals</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="glass rounded-2xl border border-[var(--border)] p-6 h-fit sticky top-6">
            <h3 className="font-semibold mb-4 text-[var(--text-primary)]">New Deal</h3>
            <form onSubmit={addDeal} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Deal Title</label>
                <input required type="text" value={newDeal.title} onChange={e => setNewDeal({...newDeal, title: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50" placeholder="Enterprise License" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Select Contact</label>
                <select required value={newDeal.contactId} onChange={e => setNewDeal({...newDeal, contactId: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50">
                  <option value="" disabled>Choose contact...</option>
                  {contacts.map(c => <option key={c.id} value={c.id}>{c.name} ({c.company || c.email})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Amount ($)</label>
                <input required type="number" value={newDeal.amount} onChange={e => setNewDeal({...newDeal, amount: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50" placeholder="5000" />
              </div>
              <button type="submit" disabled={contacts.length === 0} className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-all transform active:scale-[0.98] shadow-lg shadow-purple-500/20 mt-2">
                Create Deal
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
