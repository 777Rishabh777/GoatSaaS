"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Scatter, ComposedChart, ScatterChart,
} from "recharts";

interface TelemetryRow {
  id: number;
  latency_ms: number;
  endpoint: string;
  timestamp: string;
  email?: string;
  plan_type?: string;
}

interface AnomalyAlert {
  id: number;
  latency_ms: number;
  threshold_z: number;
  z_score: number;
  message: string;
  timestamp: string;
  resolved: boolean;
}

interface AnomalyStats {
  mean: number;
  std_dev: number;
  threshold: number;
  count: number;
}

interface ExplainState {
  [anomalyId: number]: { open: boolean; text: string; loading: boolean };
}

const API = "http://localhost:8000";

const TOOLTIP_STYLE = {
  background: "rgba(10,10,15,0.97)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 10,
  color: "#fff",
  fontSize: 12,
};

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch { return iso; }
}

function formatDateTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " +
      d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

function exportCsv(filename: string, data: Record<string, unknown>[]) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(h => {
      let cell = row[h] === null || row[h] === undefined ? "" : row[h];
      cell = typeof cell === "object" ? JSON.stringify(cell) : String(cell);
      cell = (cell as string).replace(/"/g, '""');
      return /("|,|\n)/.test(cell as string) ? `"${cell}"` : cell;
    }).join(",")
  );
  const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function exportPdf(title: string, columns: string[], data: Record<string, unknown>[]) {
  const pw = window.open("", "_blank");
  if (!pw) return;
  const headers = columns.map(c =>
    `<th style="text-align:left;padding:10px;background:#8b5cf6;color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:.05em">${c}</th>`
  ).join("");
  const rows = data.map(row =>
    `<tr>${columns.map(c =>
      `<td style="padding:9px 10px;border-bottom:1px solid #e2e8f0;font-size:12px">${row[c] === undefined || row[c] === null ? "" : typeof row[c] === "object" ? JSON.stringify(row[c]) : String(row[c])}</td>`
    ).join("")}</tr>`
  ).join("");
  pw.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
    <style>body{font-family:system-ui,sans-serif;color:#1e293b;padding:40px}h1{font-size:22px;margin-bottom:4px}p{font-size:12px;color:#64748b;margin-bottom:28px}table{width:100%;border-collapse:collapse}@media print{button{display:none}}</style>
    </head><body>
    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e2e8f0;padding-bottom:16px;margin-bottom:24px">
      <div><h1>${title}</h1><p>Exported: ${new Date().toLocaleString()} · GOATSaaS</p></div>
      <button onclick="window.print()" style="padding:8px 16px;background:#8b5cf6;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px">Print / Save PDF</button>
    </div>
    <table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>
    <script>window.onload=()=>setTimeout(()=>window.print(),500);</script>
    </body></html>`);
  pw.document.close();
}

export default function TelemetryPanel() {
  const { user } = useAuth();
  const orgId = user?.orgName || "default_org";
  const headers = { "X-Org-Id": orgId, "Content-Type": "application/json" };

  const [telemetry, setTelemetry] = useState<TelemetryRow[]>([]);
  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);
  const [stats, setStats] = useState<AnomalyStats>({ mean: 0, std_dev: 0, threshold: 2.5, count: 0 });
  const [thresholdInput, setThresholdInput] = useState(2.5);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [explains, setExplains] = useState<ExplainState>({});
  const thresholdDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [telRes, alertRes, statsRes] = await Promise.allSettled([
        fetch(`${API}/api/v1/telemetry/live`, { headers: { "X-Org-Id": orgId } }),
        fetch(`${API}/api/v1/anomalies/alerts`, { headers: { "X-Org-Id": orgId } }),
        fetch(`${API}/api/v1/anomalies/stats`),
      ]);

      if (telRes.status === "fulfilled" && telRes.value.ok) {
        const data = await telRes.value.json();
        setTelemetry(Array.isArray(data) ? data : []);
      }
      if (alertRes.status === "fulfilled" && alertRes.value.ok) {
        const data = await alertRes.value.json();
        setAlerts(Array.isArray(data) ? data : []);
      }
      if (statsRes.status === "fulfilled" && statsRes.value.ok) {
        const data = await statsRes.value.json();
        setStats(data);
        setThresholdInput(data.threshold);
      }
      setLastRefreshed(new Date());
    } catch {}
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 15000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const handleThresholdChange = (val: number) => {
    setThresholdInput(val);
    if (thresholdDebounce.current) clearTimeout(thresholdDebounce.current);
    thresholdDebounce.current = setTimeout(async () => {
      try {
        await fetch(`${API}/api/v1/anomalies/threshold`, {
          method: "POST",
          headers,
          body: JSON.stringify({ threshold: val }),
        });
        await fetchAll();
      } catch {}
    }, 600);
  };

  const handleSimulate = async () => {
    setSimulating(true);
    try {
      await fetch(`${API}/api/v1/db/simulate-anomaly`, {
        method: "POST",
        headers,
        body: JSON.stringify({ latency_ms: Math.floor(1500 + Math.random() * 1000) }),
      });
      await fetchAll();
    } catch {}
    setSimulating(false);
  };

  const handleResolve = async (alert: AnomalyAlert) => {
    // Optimistic update
    setAlerts(prev =>
      prev.map(a => a.id === alert.id ? { ...a, resolved: !a.resolved } : a)
    );
    try {
      await fetch(`${API}/api/v1/anomalies/${alert.id}/resolve`, {
        method: "PATCH",
        headers,
      });
      // Sync real state from server
      await fetchAll();
    } catch {
      // Revert on error
      setAlerts(prev =>
        prev.map(a => a.id === alert.id ? { ...a, resolved: alert.resolved } : a)
      );
    }
  };

  const handleExplain = async (alert: AnomalyAlert) => {
    const id = alert.id;
    const isOpen = explains[id]?.open;

    if (isOpen) {
      setExplains(prev => ({ ...prev, [id]: { ...prev[id], open: false } }));
      return;
    }

    setExplains(prev => ({ ...prev, [id]: { open: true, text: "", loading: true } }));

    try {
      const res = await fetch(`${API}/api/v1/ai/diagnostic-explain`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          metric_name: "latency_ms",
          current_value: alert.latency_ms,
          previous_value: stats.mean,
          date_range: formatDateTime(alert.timestamp),
          context_logs: alert.message,
          model: "groq",
          use_rag: false,
        }),
      });

      if (!res.body) throw new Error("No stream body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let reply = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        chunk.split("\n").forEach(line => {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            try {
              const j = JSON.parse(data);
              if (j.choices?.[0]?.delta?.content) {
                reply += j.choices[0].delta.content;
                setExplains(prev => ({ ...prev, [id]: { open: true, text: reply, loading: true } }));
              }
            } catch {
              if (!data.startsWith("{") && data !== "[DONE]") {
                reply += data + "\n";
                setExplains(prev => ({ ...prev, [id]: { open: true, text: reply, loading: true } }));
              }
            }
          }
        });
      }
      setExplains(prev => ({ ...prev, [id]: { open: true, text: reply, loading: false } }));
    } catch {
      setExplains(prev => ({
        ...prev,
        [id]: { open: true, text: "⚠ AI service offline. Start the Python server on port 8000.", loading: false },
      }));
    }
  };

  // Build chart data: merge telemetry with anomaly markers
  const alertTimestamps = new Set(alerts.map(a => a.timestamp));
  const chartData = telemetry.map(row => ({
    label: formatTime(row.timestamp),
    latency: row.latency_ms,
    endpoint: row.endpoint,
    anomaly: alertTimestamps.has(row.timestamp) ? row.latency_ms : undefined,
  }));

  // Add anomalies that aren't already in telemetry (they come from system_anomalies table)
  const anomalyDots = alerts.map(a => ({
    label: formatTime(a.timestamp),
    latency: a.latency_ms,
    z_score: a.z_score,
  }));

  const maxLatency = Math.max(...telemetry.map(r => r.latency_ms), 100);
  const meanLine = Math.round(stats.mean);

  return (
    <div className="space-y-6 fade-in-up font-sans">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Telemetry & Anomalies 📡</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">
            Real-time latency monitoring with Z-score anomaly detection powered by Neon Postgres.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {lastRefreshed && (
            <span className="text-[10px] font-mono text-[var(--text-muted)] hidden sm:block">
              Updated {lastRefreshed.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchAll}
            className="btn-ghost px-3 py-1.5 rounded-lg text-xs border border-[var(--border)] flex items-center gap-1.5"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Mean Latency", value: `${stats.mean.toFixed(1)} ms`, icon: "📊", color: "purple" },
          { label: "Std Deviation", value: `±${stats.std_dev.toFixed(1)} ms`, icon: "📉", color: "blue" },
          { label: "Z-Threshold", value: stats.threshold.toFixed(1), icon: "⚡", color: "amber" },
          { label: "Sample Size", value: stats.count.toLocaleString(), icon: "🗄️", color: "emerald" },
        ].map((s, i) => (
          <div
            key={i}
            className={`glass rounded-2xl p-4 border flex flex-col gap-1
              ${s.color === "purple" ? "border-purple-500/20 bg-purple-500/5" :
                s.color === "blue" ? "border-blue-500/20 bg-blue-500/5" :
                s.color === "amber" ? "border-amber-500/20 bg-amber-500/5" :
                "border-emerald-500/20 bg-emerald-500/5"}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)] font-mono uppercase tracking-wider">{s.label}</span>
              <span className="text-lg">{s.icon}</span>
            </div>
            <div className="text-xl font-bold text-[var(--text-primary)] font-mono">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Live Latency Chart + Anomaly Scatter */}
      <div className="glass rounded-2xl border border-[var(--border)] p-6">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold text-[var(--text-primary)]">Live Latency Monitor</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">Last {telemetry.length} requests · Red dots = detected anomalies</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
            <span className="text-xs text-[var(--text-muted)]">latency</span>
            <span className="w-2 h-2 rounded-full bg-red-400 inline-block ml-2" />
            <span className="text-xs text-[var(--text-muted)]">anomaly</span>
            <button
              onClick={() => exportCsv("Telemetry_Latency", telemetry.map(r => ({ timestamp: r.timestamp, endpoint: r.endpoint, latency_ms: r.latency_ms, email: r.email ?? "", plan: r.plan_type ?? "" })))}
              className="text-[10px] btn-ghost px-2 py-1 rounded-lg border border-[var(--border)] hover:text-white font-mono flex items-center gap-1 ml-2"
              title="Export CSV"
            >
              📥 CSV
            </button>
            <button
              onClick={() => exportPdf("Telemetry Latency Report", ["timestamp", "endpoint", "latency_ms", "email", "plan"], telemetry.map(r => ({ timestamp: r.timestamp, endpoint: r.endpoint, latency_ms: r.latency_ms, email: r.email ?? "", plan: r.plan_type ?? "" })))}
              className="text-[10px] btn-ghost px-2 py-1 rounded-lg border border-[var(--border)] hover:text-white font-mono flex items-center gap-1"
              title="Export PDF"
            >
              📄 PDF
            </button>
          </div>
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center text-[var(--text-muted)] text-sm animate-pulse">
            Loading telemetry data…
          </div>
        ) : telemetry.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
            <div className="text-4xl opacity-40">📡</div>
            <div className="text-sm">No telemetry data available. Hit &ldquo;Simulate Anomaly&rdquo; to inject a test spike.</div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="latGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                  <stop offset="50%" stopColor="#ef4444" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="label"
                stroke="#52525b"
                tick={{ fontSize: 10, fill: "#52525b" }}
                interval={Math.floor(chartData.length / 6)}
              />
              <YAxis
                stroke="#52525b"
                tick={{ fontSize: 10, fill: "#52525b" }}
                tickFormatter={v => `${v}ms`}
                domain={[0, Math.ceil(maxLatency * 1.2)]}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v: number, name: string) => [
                  name === "latency" ? `${v} ms` : `${v} ms (anomaly)`,
                  name === "latency" ? "Latency" : "⚠ Anomaly"
                ]}
              />
              {meanLine > 0 && (
                <ReferenceLine
                  y={meanLine}
                  stroke="rgba(139,92,246,0.4)"
                  strokeDasharray="4 4"
                  label={{ value: `μ ${meanLine}ms`, fill: "#a78bfa", fontSize: 10, position: "insideTopRight" }}
                />
              )}
              <Area
                type="monotone"
                dataKey="latency"
                stroke="#8b5cf6"
                fill="url(#latGrad)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#8b5cf6" }}
              />
              {/* Anomaly scatter overlay */}
              {anomalyDots.length > 0 && (
                <Scatter
                  data={anomalyDots}
                  dataKey="latency"
                  fill="#ef4444"
                  opacity={0.9}
                  r={5}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Controls Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Threshold Slider */}
        <div className="glass rounded-2xl border border-[var(--border)] p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Z-Score Threshold</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Anomalies fire when |z| &gt; {thresholdInput.toFixed(1)}. Changes apply to the background detector in real time.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)]">Sensitive (1.0)</span>
              <span className="text-lg font-bold font-mono text-amber-400">{thresholdInput.toFixed(1)}</span>
              <span className="text-xs text-[var(--text-muted)]">Strict (5.0)</span>
            </div>
            <input
              id="z-threshold-slider"
              type="range"
              min={1.0}
              max={5.0}
              step={0.1}
              value={thresholdInput}
              onChange={e => handleThresholdChange(parseFloat(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${((thresholdInput - 1) / 4) * 100}%, rgba(255,255,255,0.1) ${((thresholdInput - 1) / 4) * 100}%, rgba(255,255,255,0.1) 100%)`
              }}
            />
          </div>
        </div>

        {/* Simulate Anomaly */}
        <div className="glass rounded-2xl border border-[var(--border)] p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Anomaly Simulator</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Inject a high-latency spike directly into Postgres and trigger the detector.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              id="simulate-anomaly-btn"
              onClick={handleSimulate}
              disabled={simulating}
              className="btn-primary px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-60"
            >
              {simulating ? (
                <>
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin inline-block" />
                  Injecting…
                </>
              ) : (
                <>⚡ Simulate Anomaly</>
              )}
            </button>
            <span className="text-xs text-[var(--text-muted)]">Auto-refreshes chart</span>
          </div>
        </div>
      </div>

      {/* Anomaly Alert Feed */}
      <div className="glass rounded-2xl border border-[var(--border)] overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)] gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Anomaly Alert Feed
              {alerts.length > 0 && (
                <span className="ml-2 text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                  {alerts.filter(a => !a.resolved).length} active
                </span>
              )}
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Last 10 detected anomalies · Auto-refreshes every 15s</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportCsv("Anomaly_Alerts", alerts.map(a => ({ id: a.id, timestamp: a.timestamp, latency_ms: a.latency_ms, z_score: a.z_score, threshold_z: a.threshold_z, resolved: a.resolved, message: a.message })))}
              className="text-[10px] btn-ghost px-2 py-1 rounded-lg border border-[var(--border)] hover:text-white font-mono flex items-center gap-1"
              title="Export alerts as CSV"
            >
              📥 CSV
            </button>
            <button
              onClick={() => exportPdf("Anomaly Alert Report", ["id", "timestamp", "latency_ms", "z_score", "threshold_z", "resolved", "message"], alerts.map(a => ({ id: a.id, timestamp: a.timestamp, latency_ms: a.latency_ms, z_score: a.z_score, threshold_z: a.threshold_z, resolved: String(a.resolved), message: a.message })))}
              className="text-[10px] btn-ghost px-2 py-1 rounded-lg border border-[var(--border)] hover:text-white font-mono flex items-center gap-1"
              title="Export alerts as PDF"
            >
              📄 PDF
            </button>
            <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono ml-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot inline-block" />
              Live
            </span>
          </div>
        </div>

        {alerts.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <div className="text-4xl opacity-40">✅</div>
            <div className="text-sm text-[var(--text-muted)]">No anomalies detected. System is healthy.</div>
            <div className="text-xs text-[var(--text-muted)]">Click &ldquo;Simulate Anomaly&rdquo; to test the detector.</div>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {alerts.map(alert => {
              const explain = explains[alert.id];
              return (
                <div key={alert.id} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${alert.resolved ? "bg-emerald-400" : "bg-red-400 animate-pulse"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-[var(--text-primary)] truncate">{alert.message}</span>
                          {alert.resolved ? (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex-shrink-0">RESOLVED</span>
                          ) : (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 flex-shrink-0">ACTIVE</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-[var(--text-muted)] font-mono flex-wrap">
                          <span>z-score: <span className="text-red-400 font-semibold">{alert.z_score.toFixed(2)}</span></span>
                          <span>latency: <span className="text-amber-400 font-semibold">{alert.latency_ms}ms</span></span>
                          <span>threshold: {alert.threshold_z.toFixed(1)}</span>
                          <span>{formatDateTime(alert.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleResolve(alert)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                          alert.resolved
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                        }`}
                        title={alert.resolved ? "Mark as active" : "Mark as resolved"}
                      >
                        {alert.resolved ? "↩ Unresolve" : "✓ Resolve"}
                      </button>
                      <button
                        onClick={() => handleExplain(alert)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                          explain?.open
                            ? "bg-purple-500/15 border-purple-500/30 text-purple-300"
                            : "btn-ghost border-[var(--border)]"
                        }`}
                      >
                        {explain?.loading ? (
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full border border-white/30 border-t-white animate-spin inline-block" />
                            Streaming…
                          </span>
                        ) : explain?.open ? "▲ Close" : "🤖 AI Explain"}
                      </button>
                    </div>
                  </div>

                  {/* AI Explain Collapsible Drawer */}
                  {explain?.open && (
                    <div className="mt-4 ml-5 p-4 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-2">
                      <div className="flex items-center gap-2 text-xs text-purple-400 font-mono font-semibold">
                        <span>🤖</span>
                        <span>Groq LLM Analysis</span>
                        {explain.loading && (
                          <span className="ml-auto text-[10px] text-zinc-500 animate-pulse">Streaming response…</span>
                        )}
                      </div>
                      <pre className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed font-sans">
                        {explain.text || (explain.loading ? "" : "No explanation available.")}
                        {explain.loading && explain.text && <span className="cursor-blink ml-0.5">▋</span>}
                        {explain.loading && !explain.text && (
                          <span className="text-zinc-600 animate-pulse">Generating AI analysis…</span>
                        )}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
