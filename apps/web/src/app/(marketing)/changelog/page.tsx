import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Changelog | GOATSaaS",
  description: "What's new in GOATSaaS — full version history, bug fixes, and feature launches.",
};

const entries = [
  {
    version: "v2.5.0",
    date: "May 21, 2026",
    badge: "latest",
    badgeColor: "purple",
    highlights: ["Feature Flags panel (Upstash Redis)", "Full Audit Log with SOC2-ready append-only storage", "AI Quota Dashboard per tenant", "Broadcast Email via Resend", "Grafana metrics embed in System Health", "Onboarding wizard for new users", "Password change in Settings"],
    changes: [
      { type: "feat", text: "Feature Flags: Toggle any feature on/off per tenant without deploying. Backed by Upstash Redis." },
      { type: "feat", text: "Audit Log: Immutable append-only log of every user action. Filter by user, action type, and date range. Export CSV." },
      { type: "feat", text: "AI Quota Dashboard: Bar chart + table of AI API calls per org per day. Highlights orgs over 80% of daily limit." },
      { type: "feat", text: "Broadcast Email: Compose, preview, and send announcements to All / Free / Pro / Enterprise user segments via Resend." },
      { type: "feat", text: "Grafana embed: Connect a self-hosted Grafana instance via NEXT_PUBLIC_GRAFANA_URL env var for real p95/error rate metrics." },
      { type: "feat", text: "Onboarding wizard: 4-step wizard on first login (AI model selection, KB upload, launch). Dismissible via localStorage." },
      { type: "feat", text: "Password change: New PATCH /api/settings/profile endpoint with bcrypt verification + audit log." },
      { type: "feat", text: "Invite emails: Team invitations now send real emails via Resend (with dev-mode fallback to console)." },
      { type: "feat", text: "Plan change: Admins can now change any user's plan directly from the user management table." },
      { type: "fix", text: "Admin sidebar expanded from 6 to 9 tabs with cleaner organization." },
      { type: "fix", text: "Theme transition now uses CSS transitions instead of instant swap." },
    ],
  },
  {
    version: "v2.4.0",
    date: "May 14, 2026",
    badge: "",
    badgeColor: "",
    highlights: ["Real-time anomaly notifications", "Knowledge Base RAG panel", "3D Cloud Map WebGL"],
    changes: [
      { type: "feat", text: "Notification bell with live anomaly alerts polling from Python service every 5s." },
      { type: "feat", text: "Knowledge Base panel with PDF upload, chunk viewer, and RAG-augmented AI chat." },
      { type: "feat", text: "3D Cloud Map: WebGL visualization of 50 global server nodes using Three.js." },
      { type: "feat", text: "AI usage heatmap (84-day GitHub-style contribution graph for API calls)." },
      { type: "fix", text: "Streaming AI responses now correctly handle multi-line SSE payloads." },
    ],
  },
  {
    version: "v2.3.0",
    date: "May 7, 2026",
    badge: "",
    badgeColor: "",
    highlights: ["NL→SQL Terminal", "Saved queries", "Multi-model support"],
    changes: [
      { type: "feat", text: "NL→SQL Terminal with real-time streaming output from Groq/Gemini/Ollama." },
      { type: "feat", text: "Saved queries: Star any query, give it a name, access it instantly from the sidebar." },
      { type: "feat", text: "Multi-model selector: Switch between Llama 3 (Groq), Gemini Pro, and Ollama Local." },
      { type: "feat", text: "CSV and PDF export on all dashboard charts and activity tables." },
    ],
  },
  {
    version: "v2.2.0",
    date: "Apr 28, 2026",
    badge: "",
    badgeColor: "",
    highlights: ["Team workspaces", "Invite system", "Role-based access"],
    changes: [
      { type: "feat", text: "Multi-tenant org system: Users belong to organizations with owner/admin/member roles." },
      { type: "feat", text: "Team invite flow: Send invitations to teammates with role assignment." },
      { type: "feat", text: "Workspace settings: Rename org, view all members, manage pending invites." },
      { type: "fix", text: "JWT tokens now include orgId, orgName, orgRole for all downstream authorization." },
    ],
  },
  {
    version: "v2.1.0",
    date: "Apr 15, 2026",
    badge: "",
    badgeColor: "",
    highlights: ["Settings panel", "Billing plans", "API key manager"],
    changes: [
      { type: "feat", text: "Settings panel with Profile, Team, Notifications, Billing, and API Keys tabs." },
      { type: "feat", text: "3-tier billing: Free / Pro ($79/mo) / Enterprise ($299/mo) with plan-gated features." },
      { type: "feat", text: "API Key generator with masked display and one-click copy." },
      { type: "feat", text: "Notification preferences: Email channels, Slack webhook config, PagerDuty (Enterprise)." },
    ],
  },
  {
    version: "v2.0.0",
    date: "Apr 1, 2026",
    badge: "major",
    badgeColor: "amber",
    highlights: ["AI Business Analyst", "Python FastAPI service", "Streaming responses"],
    changes: [
      { type: "feat", text: "AI Business Analyst: Conversational AI backed by Groq/Gemini with streaming SSE responses." },
      { type: "feat", text: "Python FastAPI AI service: Handles NL→SQL, diagnostic explanations, anomaly detection, and RAG." },
      { type: "feat", text: "Telemetry panel: Real p95 latency monitoring with Z-score anomaly detection." },
      { type: "breaking", text: "Auth now uses JWT cookies instead of localStorage tokens." },
    ],
  },
];

const TYPE_STYLES: Record<string, string> = {
  feat: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  fix: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  breaking: "text-red-400 bg-red-500/10 border-red-500/20",
};
const TYPE_LABELS: Record<string, string> = {
  feat: "Feature",
  fix: "Fix",
  breaking: "Breaking",
};

export default function ChangelogPage() {
  return (
    <div className="min-h-screen" style={{ background: "#040408" }}>
      {/* Navbar */}
      <nav className="border-b border-zinc-900 px-6 py-4 flex items-center justify-between" style={{ background: "rgba(4,4,8,0.95)" }}>
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-black text-base" style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}>G</div>
          <span className="font-black text-lg text-white tracking-tight">GOAT<span className="text-purple-400">SaaS</span></span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm text-zinc-400 hover:text-white transition-colors">← Home</Link>
          <Link href="/sign-in" className="text-sm text-zinc-400 hover:text-white transition-colors">Sign in</Link>
          <Link href="/sign-up" className="text-sm font-semibold text-white px-4 py-2 rounded-xl" style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}>Get started →</Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-3xl mx-auto px-6 pt-20 pb-12">
        <div className="inline-block text-xs font-mono text-purple-400 border border-purple-500/30 px-3 py-1.5 rounded-full bg-purple-500/5 mb-6">
          Release Notes
        </div>
        <h1 className="text-5xl font-black text-white mb-4 leading-tight">
          Changelog
        </h1>
        <p className="text-zinc-400 text-lg leading-relaxed">
          Every feature, fix, and improvement — shipped fast and documented thoroughly.
          GOATSaaS moves fast. Stay in the loop.
        </p>
      </div>

      {/* Entries */}
      <div className="max-w-3xl mx-auto px-6 pb-32 space-y-16">
        {entries.map((entry, ei) => (
          <div key={entry.version} className="relative">
            {/* Timeline connector */}
            {ei < entries.length - 1 && (
              <div className="absolute left-5 top-16 bottom-0 w-px bg-zinc-800 -mb-8" />
            )}

            <div className="flex gap-6">
              {/* Version dot */}
              <div className="flex-shrink-0 pt-1">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-lg font-black relative z-10 ${entry.badgeColor === "purple" ? "bg-purple-600 border-purple-500" : entry.badgeColor === "amber" ? "bg-amber-600 border-amber-500" : "bg-zinc-800 border-zinc-700"}`}>
                  {ei === 0 ? "✦" : "○"}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-2xl font-black text-white">{entry.version}</span>
                  {entry.badge && (
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border uppercase tracking-wider ${entry.badgeColor === "purple" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>
                      {entry.badge}
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-500 font-mono mb-4">{entry.date}</div>

                {/* Highlights */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {entry.highlights.map(h => (
                    <span key={h} className="text-xs px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300">{h}</span>
                  ))}
                </div>

                {/* Change list */}
                <div className="space-y-3">
                  {entry.changes.map((c, ci) => (
                    <div key={ci} className="flex items-start gap-3">
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border flex-shrink-0 mt-0.5 ${TYPE_STYLES[c.type]}`}>
                        {TYPE_LABELS[c.type]}
                      </span>
                      <p className="text-sm text-zinc-400 leading-relaxed">{c.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* End of log */}
        <div className="text-center pt-8">
          <div className="inline-flex items-center gap-2 text-xs text-zinc-600 font-mono">
            <div className="w-4 h-px bg-zinc-800" />
            GOATSaaS began development in 2026
            <div className="w-4 h-px bg-zinc-800" />
          </div>
        </div>
      </div>
    </div>
  );
}
