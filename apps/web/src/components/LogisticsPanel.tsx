"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

export default function LogisticsPanel() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"fleet" | "shipments">("fleet");
  
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [newVehicle, setNewVehicle] = useState({ driverName: "", status: "offline" });
  const [newShipment, setNewShipment] = useState({ origin: "", destination: "", vehicleId: "" });

  const fetchLogisticsData = async () => {
    setLoading(true);
    try {
      const [vRes, sRes] = await Promise.all([
        fetch("/api/v1/logistics/vehicles", { headers: { "X-Org-Id": user?.orgName || "default_org" } }),
        fetch("/api/v1/logistics/shipments", { headers: { "X-Org-Id": user?.orgName || "default_org" } })
      ]);
      const vData = await vRes.json();
      const sData = await sRes.json();
      setVehicles(vData.vehicles || []);
      setShipments(sData.shipments || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchLogisticsData();
  }, [user]);

  const addVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVehicle.driverName) return;
    try {
      const res = await fetch("/api/v1/logistics/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Org-Id": user?.orgName || "default_org" },
        body: JSON.stringify(newVehicle)
      });
      if (res.ok) {
        setNewVehicle({ driverName: "", status: "offline" });
        fetchLogisticsData();
      }
    } catch (e) { console.error(e); }
  };

  const addShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShipment.origin || !newShipment.destination) return;
    try {
      const res = await fetch("/api/v1/logistics/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Org-Id": user?.orgName || "default_org" },
        body: JSON.stringify(newShipment)
      });
      if (res.ok) {
        setNewShipment({ origin: "", destination: "", vehicleId: "" });
        fetchLogisticsData();
      }
    } catch (e) { console.error(e); }
  };

  const updateShipmentStatus = async (shipmentId: string, status: string) => {
    try {
      await fetch("/api/v1/logistics/shipments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Org-Id": user?.orgName || "default_org" },
        body: JSON.stringify({ shipmentId, status })
      });
      fetchLogisticsData();
    } catch (e) { console.error(e); }
  };

  const updateVehicleStatus = async (vehicleId: string, status: string) => {
    try {
      await fetch("/api/v1/logistics/vehicles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Org-Id": user?.orgName || "default_org" },
        body: JSON.stringify({ vehicleId, status })
      });
      fetchLogisticsData();
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-6 animate-fade-in fade-in max-w-7xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent flex items-center gap-2">
            <span>🚚</span> Logistics & Fleet Tracking
          </h2>
          <p className="text-[var(--text-secondary)] mt-1">Monitor real-time fleet activity and manage active shipments.</p>
        </div>
        <div className="flex gap-2 bg-[var(--bg-1)] p-1 rounded-xl border border-[var(--border)]">
          <button
            onClick={() => setActiveTab("fleet")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "fleet" ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
          >
            Fleet Dashboard
          </button>
          <button
            onClick={() => setActiveTab("shipments")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "shipments" ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
          >
            Active Shipments
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-[var(--text-muted)] animate-pulse">Loading Operations Data...</div>
      ) : activeTab === "fleet" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass rounded-2xl border border-[var(--border)] overflow-hidden">
            <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-1)]">
              <h3 className="font-semibold">Registered Vehicles</h3>
              <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full">{vehicles.length} Total</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--bg-2)] text-[var(--text-muted)]">
                  <tr>
                    <th className="p-4 font-medium">Driver Name</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium">Last Ping</th>
                    <th className="p-4 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {vehicles.map((v) => (
                    <tr key={v.id} className="hover:bg-[var(--bg-1)]/50 transition-colors">
                      <td className="p-4 font-medium text-[var(--text-primary)] flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs">
                           {v.driverName.charAt(0)}
                        </div>
                        {v.driverName}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 text-xs rounded-full flex items-center gap-1.5 w-fit ${v.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : v.status === 'maintenance' ? 'bg-amber-500/10 text-amber-500' : 'bg-zinc-500/10 text-zinc-500'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${v.status === 'active' ? 'bg-emerald-500 animate-pulse' : v.status === 'maintenance' ? 'bg-amber-500' : 'bg-zinc-500'}`}></span>
                          {v.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4 text-[var(--text-secondary)] font-mono text-xs">
                        {v.lastPing ? new Date(v.lastPing).toLocaleTimeString() : "No signal"}
                      </td>
                      <td className="p-4">
                         <select 
                            value={v.status}
                            onChange={(e) => updateVehicleStatus(v.id, e.target.value)}
                            className="bg-zinc-900 border border-zinc-700 text-xs rounded px-2 py-1.5 text-zinc-300 outline-none focus:ring-1 focus:ring-emerald-500"
                          >
                            <option value="active">Active</option>
                            <option value="maintenance">Maintenance</option>
                            <option value="offline">Offline</option>
                          </select>
                      </td>
                    </tr>
                  ))}
                  {vehicles.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-[var(--text-muted)]">No vehicles registered. Add a driver to get started.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass rounded-2xl border border-[var(--border)] p-6 h-fit sticky top-6">
            <h3 className="font-semibold mb-4 text-[var(--text-primary)] flex items-center gap-2">
              <span className="text-emerald-400">➕</span> Add Vehicle
            </h3>
            <form onSubmit={addVehicle} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Driver Name</label>
                <input required type="text" value={newVehicle.driverName} onChange={e => setNewVehicle({...newVehicle, driverName: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50" placeholder="Jane Smith" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Initial Status</label>
                <select value={newVehicle.status} onChange={e => setNewVehicle({...newVehicle, status: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
                  <option value="offline">Offline</option>
                  <option value="active">Active</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>
              <button type="submit" className="w-full py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-lg text-sm font-medium transition-all transform active:scale-[0.98] shadow-lg shadow-emerald-500/20 mt-2">
                Register Vehicle
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
             <div className="glass rounded-2xl border border-[var(--border)] overflow-hidden">
              <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-1)]">
                <h3 className="font-semibold text-[var(--text-primary)]">Shipments Overview</h3>
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {shipments.map(s => {
                  const vehicle = vehicles.find(v => v.id === s.vehicleId);
                  return (
                    <div key={s.id} className="bg-[var(--bg-0)] p-4 rounded-xl border border-[var(--border)] flex flex-col gap-3 relative overflow-hidden group">
                      <div className={`absolute top-0 left-0 w-1 h-full ${s.status === 'delivered' ? 'bg-emerald-500' : s.status === 'in_transit' ? 'bg-blue-500' : s.status === 'delayed' ? 'bg-red-500' : 'bg-amber-500'}`}></div>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-[10px] font-mono text-[var(--text-muted)] mb-1">ID: {s.id}</div>
                          <div className="flex items-center gap-2 text-sm text-[var(--text-primary)] font-medium">
                            <span className="truncate max-w-[100px]">{s.origin}</span>
                            <span className="text-zinc-600">→</span>
                            <span className="truncate max-w-[100px]">{s.destination}</span>
                          </div>
                        </div>
                        <select 
                          value={s.status}
                          onChange={(e) => updateShipmentStatus(s.id, e.target.value)}
                          className={`text-xs rounded-full px-2 py-1 font-medium border-none outline-none appearance-none cursor-pointer ${s.status === 'delivered' ? 'bg-emerald-500/20 text-emerald-400' : s.status === 'in_transit' ? 'bg-blue-500/20 text-blue-400' : s.status === 'delayed' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}
                        >
                          <option value="pending">PENDING</option>
                          <option value="in_transit">IN TRANSIT</option>
                          <option value="delivered">DELIVERED</option>
                          <option value="delayed">DELAYED</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2 text-xs mt-2 border-t border-[var(--border)] pt-3 text-[var(--text-secondary)]">
                        <span className="flex items-center gap-1">
                           🚚 {vehicle ? vehicle.driverName : "Unassigned"}
                        </span>
                        <span className="mx-2 text-zinc-700">•</span>
                        <span>{s.estimatedDelivery ? new Date(s.estimatedDelivery).toLocaleDateString() : "TBD"}</span>
                      </div>
                    </div>
                  );
                })}
                {shipments.length === 0 && (
                  <div className="col-span-2 text-center py-10 text-[var(--text-muted)]">No active shipments.</div>
                )}
              </div>
            </div>
          </div>
          
          <div className="glass rounded-2xl border border-[var(--border)] p-6 h-fit sticky top-6">
            <h3 className="font-semibold mb-4 text-[var(--text-primary)]">Dispatch Shipment</h3>
            <form onSubmit={addShipment} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Origin Address / Hub</label>
                <input required type="text" value={newShipment.origin} onChange={e => setNewShipment({...newShipment, origin: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50" placeholder="New York, NY" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Destination</label>
                <input required type="text" value={newShipment.destination} onChange={e => setNewShipment({...newShipment, destination: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50" placeholder="Los Angeles, CA" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Assign Driver (Optional)</label>
                <select value={newShipment.vehicleId} onChange={e => setNewShipment({...newShipment, vehicleId: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
                  <option value="">Unassigned</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.driverName} ({v.status})</option>)}
                </select>
              </div>
              <button type="submit" className="w-full py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-lg text-sm font-medium transition-all transform active:scale-[0.98] shadow-lg shadow-emerald-500/20 mt-2">
                Create Shipment
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
