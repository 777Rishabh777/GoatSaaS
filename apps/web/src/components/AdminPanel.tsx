"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

export default function AdminPanel() {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (user?.role === "admin") {
      fetchAdminData();
    }
  }, [user]);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      // Fetch users and global stats
      // In a real app this would hit a protected /api/v1/admin route
      // For now we'll simulate fetching all users from the DB
      const res = await fetch("/api/v1/admin/users", {
        headers: { "X-User-Role": user?.role || "user" }
      });
      
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setStats(data.stats || {
          totalRevenue: 24500,
          activeUsers: 142,
          serverLoad: "42%"
        });
      } else {
        // Fallback mock data if endpoint doesn't exist yet
        setUsers([
          { id: 1, email: "admin@goatsaas.com", role: "admin", plan: "Enterprise", status: "Active" },
          { id: 2, email: "rishabh@goatsaas.com", role: "user", plan: "Pro", status: "Active" },
          { id: 3, email: "test@example.com", role: "user", plan: "Basic", status: "Inactive" }
        ]);
        setStats({
          totalRevenue: 12450,
          activeUsers: 3,
          serverLoad: "18%"
        });
      }
    } catch (e) {
      console.error("Admin fetch failed", e);
    }
    setLoading(false);
  };

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)]">
        <span className="text-4xl mb-4">🔒</span>
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in fade-in max-w-7xl mx-auto pb-20">
      <div>
        <h2 className="text-2xl font-bold bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent flex items-center gap-2">
          <span>👑</span> Admin Control Panel
        </h2>
        <p className="text-[var(--text-secondary)] mt-1">Oversee all platform users, manage plans, and monitor global metrics.</p>
      </div>

      {loading ? (
        <div className="text-center py-20 text-[var(--text-muted)] animate-pulse">Loading Admin Data...</div>
      ) : (
        <div className="space-y-6">
          {/* Global Stats */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass rounded-2xl p-6 border border-[var(--border)]">
                <div className="text-sm font-medium text-[var(--text-secondary)] mb-2">Total MRR</div>
                <div className="text-3xl font-bold text-emerald-400">${stats.totalRevenue.toLocaleString()}</div>
              </div>
              <div className="glass rounded-2xl p-6 border border-[var(--border)]">
                <div className="text-sm font-medium text-[var(--text-secondary)] mb-2">Total Active Users</div>
                <div className="text-3xl font-bold text-[var(--text-primary)]">{stats.activeUsers}</div>
              </div>
              <div className="glass rounded-2xl p-6 border border-[var(--border)]">
                <div className="text-sm font-medium text-[var(--text-secondary)] mb-2">Global Server Load</div>
                <div className="text-3xl font-bold text-orange-400">{stats.serverLoad}</div>
              </div>
            </div>
          )}

          {/* User Directory */}
          <div className="glass rounded-2xl border border-[var(--border)] overflow-hidden">
            <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-1)] flex justify-between items-center">
              <h3 className="font-semibold text-[var(--text-primary)]">User Directory</h3>
              <div className="text-xs text-[var(--text-muted)]">Showing {users.length} users</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--bg-2)] text-[var(--text-muted)] border-b border-[var(--border)]">
                  <tr>
                    <th className="p-4 font-medium">User Email</th>
                    <th className="p-4 font-medium">Role</th>
                    <th className="p-4 font-medium">Plan</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {users.length > 0 ? (
                    users.map((u: any, idx: number) => (
                      <tr key={idx} className="hover:bg-[var(--bg-1)]/50 transition-colors">
                        <td className="p-4 text-[var(--text-primary)] font-medium">{u.email}</td>
                        <td className="p-4">
                          <span className={`text-xs px-2 py-1 rounded-full ${u.role === 'admin' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="p-4 text-[var(--text-secondary)]">{u.plan || "N/A"}</td>
                        <td className="p-4">
                          <span className={`text-xs px-2 py-1 rounded-full ${u.status === 'Active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-800 text-zinc-400'}`}>
                            {u.status || "Unknown"}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button className="text-xs bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded-lg border border-zinc-700 transition-colors">
                            Manage
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-[var(--text-muted)]">No users found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
