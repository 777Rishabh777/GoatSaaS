"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";

// ─────────────────────────────────────────────
// Scroll reveal hook
// ─────────────────────────────────────────────
function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

// ─────────────────────────────────────────────
// Animated counter
// ─────────────────────────────────────────────
function Counter({ end, suffix = "", prefix = "" }: { end: number; suffix?: string; prefix?: string }) {
  const [val, setVal] = useState(0);
  const { ref, visible } = useReveal(0.3);
  useEffect(() => {
    if (!visible) return;
    const duration = 1800;
    const start = performance.now();
    const tick = (now: number) => {
      const pct = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - pct, 3);
      setVal(Math.floor(ease * end));
      if (pct < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [visible, end]);
  return (
    <span ref={ref} className="tabular-nums">
      {prefix}{val.toLocaleString()}{suffix}
    </span>
  );
}

// ─────────────────────────────────────────────
// Dashboard mock — cycles through 5 "screens"
// ─────────────────────────────────────────────
const MOCK_SCREENS = [
  {
    label: "AI Analyst",
    color: "from-purple-600/20 to-blue-600/20",
    border: "border-purple-500/30",
    accent: "#8b5cf6",
    ui: (
      <div className="space-y-3">
        <div className="flex gap-2 items-center">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-lg">🤖</div>
          <div>
            <div className="h-2 w-24 bg-purple-500/40 rounded-full" />
            <div className="h-1.5 w-16 bg-zinc-700 rounded-full mt-1.5" />
          </div>
        </div>
        {["Revenue dipped 8% on Tuesday…", "Anomaly in /api/inference endpoint…", "User churn risk: 3 enterprise accounts…"].map((t, i) => (
          <div key={i} className="rounded-xl bg-zinc-900/80 border border-zinc-800 p-3">
            <div className="text-[10px] text-zinc-300 font-mono">{t}</div>
            <div className="flex gap-1 mt-2">
              {[60, 45, 80].map((w, j) => <div key={j} style={{ width: w }} className="h-1 bg-purple-500/50 rounded-full" />)}
            </div>
          </div>
        ))}
        <div className="h-16 rounded-xl bg-gradient-to-r from-purple-600/10 to-blue-600/10 border border-purple-500/20 flex items-center justify-center">
          <div className="text-[10px] font-mono text-purple-300 animate-pulse">Groq LLM streaming response…▋</div>
        </div>
      </div>
    ),
  },
  {
    label: "NL → SQL Terminal",
    color: "from-blue-600/20 to-cyan-600/20",
    border: "border-blue-500/30",
    accent: "#3b82f6",
    ui: (
      <div className="space-y-3 font-mono">
        <div className="text-[10px] text-blue-400">$ Show me top 10 users by revenue last 30 days</div>
        <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-3 space-y-1">
          {["SELECT u.name, SUM(r.amount) AS revenue", "FROM users u JOIN revenue r ON u.id = r.user_id", "WHERE r.created_at >= NOW() - INTERVAL '30 days'", "GROUP BY u.name ORDER BY revenue DESC LIMIT 10"].map((l, i) => (
            <div key={i} className="text-[9px]">
              <span className="text-blue-400">{["SELECT", "FROM", "WHERE", "GROUP"][i]} </span>
              <span className="text-zinc-300">{l.replace(/SELECT |FROM |WHERE |GROUP /,"")}</span>
            </div>
          ))}
        </div>
        <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 overflow-hidden">
          <div className="grid grid-cols-3 border-b border-zinc-800 px-3 py-1.5">
            {["Name","Revenue","Rank"].map(h => <div key={h} className="text-[8px] text-zinc-500 font-semibold uppercase">{h}</div>)}
          </div>
          {[["Alice Chen","$42,100","1"],["Bob Kim","$38,500","2"],["Sara Patel","$31,200","3"]].map((r,i) => (
            <div key={i} className="grid grid-cols-3 px-3 py-1 border-b border-zinc-900">
              {r.map((c,j) => <div key={j} className="text-[9px] text-zinc-300">{c}</div>)}
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    label: "Knowledge Base",
    color: "from-emerald-600/20 to-teal-600/20",
    border: "border-emerald-500/30",
    accent: "#10b981",
    ui: (
      <div className="space-y-3">
        <div className="rounded-xl border-2 border-dashed border-emerald-500/30 p-4 flex flex-col items-center justify-center gap-2 bg-emerald-500/5">
          <div className="text-2xl">📁</div>
          <div className="text-[10px] text-emerald-400 font-mono">Drop PDFs, CSVs, Markdown…</div>
        </div>
        {[{name:"Q4_Report.pdf",chunks:842,type:"pdf"},{name:"user_research.csv",chunks:311,type:"csv"},{name:"API_Docs.md",chunks:128,type:"md"}].map((d,i) => (
          <div key={i} className="flex items-center justify-between rounded-xl bg-zinc-900/60 border border-zinc-800 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">{d.type==="pdf"?"📄":d.type==="csv"?"📊":"📝"}</span>
              <span className="text-[9px] text-zinc-300 font-mono">{d.name}</span>
            </div>
            <span className="text-[8px] text-emerald-400 font-mono">{d.chunks} chunks</span>
          </div>
        ))}
        <div className="h-8 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center px-3 gap-2">
          <span className="text-[9px] text-zinc-600">🔍</span>
          <div className="h-1.5 w-32 bg-zinc-800 rounded-full" />
          <div className="text-[8px] text-emerald-400 ml-auto animate-pulse">Semantic search…</div>
        </div>
      </div>
    ),
  },
  {
    label: "Telemetry & Anomalies",
    color: "from-red-600/15 to-orange-600/15",
    border: "border-red-500/30",
    accent: "#ef4444",
    ui: (
      <div className="space-y-3">
        <div className="flex gap-3">
          {[{l:"Mean",v:"142ms",c:"purple"},{l:"Alerts",v:"2",c:"red"},{l:"Z-Score",v:"3.1",c:"amber"}].map((s,i)=>(
            <div key={i} className="flex-1 rounded-xl bg-zinc-900/60 border border-zinc-800 p-2 text-center">
              <div className={`text-sm font-bold font-mono ${s.c==="red"?"text-red-400":s.c==="amber"?"text-amber-400":"text-purple-400"}`}>{s.v}</div>
              <div className="text-[8px] text-zinc-500 mt-0.5">{s.l}</div>
            </div>
          ))}
        </div>
        {/* Mini sparkline */}
        <div className="h-16 rounded-xl bg-zinc-950 border border-zinc-800 p-2 relative overflow-hidden">
          <svg viewBox="0 0 200 50" className="w-full h-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4"/>
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0"/>
              </linearGradient>
            </defs>
            <path d="M0,40 C20,35 40,30 60,32 C80,34 90,20 100,18 C110,16 120,38 140,10 C160,5 180,35 200,32 L200,50 L0,50Z" fill="url(#sg)"/>
            <path d="M0,40 C20,35 40,30 60,32 C80,34 90,20 100,18 C110,16 120,38 140,10 C160,5 180,35 200,32" fill="none" stroke="#8b5cf6" strokeWidth="1.5"/>
            <circle cx="140" cy="10" r="3" fill="#ef4444"/>
          </svg>
          <div className="absolute top-1 right-2 text-[7px] text-red-400 font-mono">⚠ Anomaly</div>
        </div>
        {[{msg:"Latency spike on /api/inference",z:"3.4"},{msg:"Memory usage 94% threshold",z:"2.9"}].map((a,i)=>(
          <div key={i} className="flex items-center gap-2 rounded-xl bg-zinc-900/60 border border-red-500/20 px-3 py-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse flex-shrink-0"/>
            <span className="text-[9px] text-zinc-300 flex-1">{a.msg}</span>
            <span className="text-[8px] text-red-400 font-mono">z={a.z}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    label: "Admin Cockpit",
    color: "from-amber-600/15 to-orange-600/15",
    border: "border-amber-500/30",
    accent: "#f59e0b",
    ui: (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {[{l:"Total Users",v:"5,128",icon:"👥"},{l:"Pro Plans",v:"1,840",icon:"⭐"},{l:"MRR",v:"$112K",icon:"💰"},{l:"Uptime",v:"99.98%",icon:"⚡"}].map((m,i)=>(
            <div key={i} className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-2.5">
              <div className="text-base">{m.icon}</div>
              <div className="text-sm font-bold text-white font-mono mt-1">{m.v}</div>
              <div className="text-[8px] text-zinc-500">{m.l}</div>
            </div>
          ))}
        </div>
        <div className="rounded-xl bg-zinc-950 border border-zinc-800 overflow-hidden">
          <div className="px-3 py-2 border-b border-zinc-800 text-[9px] text-zinc-500 font-semibold uppercase">Recent Users</div>
          {[{n:"Alice Chen",p:"pro",s:"active"},{n:"Bob Kim",p:"enterprise",s:"active"},{n:"Sam Lee",p:"free",s:"suspended"}].map((u,i)=>(
            <div key={i} className="flex items-center gap-2 px-3 py-2 border-b border-zinc-900 last:border-0">
              <div className="w-5 h-5 rounded-full bg-purple-600/40 flex items-center justify-center text-[8px] font-bold">{u.n[0]}</div>
              <span className="text-[9px] text-zinc-300 flex-1">{u.n}</span>
              <span className={`text-[7px] px-1.5 py-0.5 rounded-full border font-mono ${u.s==="active"?"bg-emerald-500/10 text-emerald-400 border-emerald-500/20":"bg-red-500/10 text-red-400 border-red-500/20"}`}>{u.s}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

function DashboardMockup() {
  const [active, setActive] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const switchTo = useCallback((i: number) => {
    if (i === active) return;
    setTransitioning(true);
    setTimeout(() => { setActive(i); setTransitioning(false); }, 300);
  }, [active]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTransitioning(true);
      setTimeout(() => {
        setActive(p => (p + 1) % MOCK_SCREENS.length);
        setTransitioning(false);
      }, 300);
    }, 3500);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const screen = MOCK_SCREENS[active];

  return (
    <div className="relative">
      {/* Glow behind */}
      <div
        className="absolute inset-0 blur-3xl opacity-30 transition-all duration-700 rounded-3xl scale-110"
        style={{ background: `radial-gradient(ellipse, ${screen.accent}40, transparent 70%)` }}
      />

      {/* Browser chrome */}
      <div className="relative rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl" style={{ background: "#0a0a0f" }}>
        {/* Browser bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800" style={{ background: "#050508" }}>
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-amber-500/60" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
          </div>
          <div className="flex-1 mx-3">
            <div className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1 text-[10px] font-mono text-zinc-500 flex items-center gap-2">
              <span className="text-emerald-500">🔒</span>
              app.goatsaas.ai/dashboard
            </div>
          </div>
        </div>

        {/* Sidebar + Content */}
        <div className="flex" style={{ height: 380 }}>
          {/* Mini sidebar */}
          <div className="w-36 border-r border-zinc-900 flex flex-col py-3 gap-0.5 flex-shrink-0" style={{ background: "#04040a" }}>
            {MOCK_SCREENS.map((s, i) => (
              <button
                key={i}
                onClick={() => { if (intervalRef.current) clearInterval(intervalRef.current); switchTo(i); }}
                className={`flex items-center gap-2 mx-2 px-2 py-1.5 rounded-lg text-left transition-all text-[9px] font-medium ${active === i ? "bg-purple-500/15 text-purple-300" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"}`}
              >
                <span className={`w-1 h-1 rounded-full flex-shrink-0 ${active === i ? "bg-purple-400" : "bg-zinc-700"}`} />
                {s.label}
              </button>
            ))}
            <div className="mt-auto mx-2 border-t border-zinc-900 pt-2">
              <div className="flex items-center gap-1.5 px-2 py-1">
                <div className="w-4 h-4 rounded-full bg-purple-600/40 flex items-center justify-center text-[6px] font-bold">J</div>
                <div className="text-[8px] text-zinc-500 truncate">jane@acme.io</div>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div
            className={`flex-1 p-4 overflow-hidden transition-all duration-300 bg-gradient-to-br ${screen.color} ${transitioning ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`}
          >
            <div className="text-[10px] font-semibold text-zinc-300 mb-3 flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse inline-block" />
              {screen.label}
            </div>
            <div className={`border ${screen.border} rounded-xl p-3 h-[calc(100%-28px)] overflow-hidden`} style={{ background: "rgba(0,0,0,0.4)" }}>
              {screen.ui}
            </div>
          </div>
        </div>
      </div>

      {/* Screen label */}
      <div className="flex justify-center gap-2 mt-4">
        {MOCK_SCREENS.map((_, i) => (
          <button
            key={i}
            onClick={() => { if (intervalRef.current) clearInterval(intervalRef.current); switchTo(i); }}
            className={`transition-all duration-300 rounded-full ${active === i ? "w-6 h-1.5 bg-purple-500" : "w-1.5 h-1.5 bg-zinc-700 hover:bg-zinc-500"}`}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Feature section (Samsung alternating layout)
// ─────────────────────────────────────────────
interface FeatureSectionProps {
  eyebrow: string;
  headline: string;
  sub: string;
  bullets: string[];
  visual: React.ReactNode;
  reverse?: boolean;
  accent?: string;
}

function FeatureSection({ eyebrow, headline, sub, bullets, visual, reverse, accent = "#8b5cf6" }: FeatureSectionProps) {
  const { ref, visible } = useReveal(0.12);
  return (
    <section
      ref={ref}
      className={`py-32 px-6 md:px-16 lg:px-24 max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center transition-all duration-1000 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-16"}`}
    >
      <div className={`space-y-6 ${reverse ? "md:order-2" : ""}`}>
        <span
          className="text-xs font-mono font-semibold px-3 py-1.5 rounded-full border inline-block"
          style={{ color: accent, borderColor: `${accent}40`, background: `${accent}10` }}
        >
          {eyebrow}
        </span>
        <h2 className="text-4xl md:text-5xl font-black text-white leading-tight">
          {headline}
        </h2>
        <p className="text-zinc-400 text-lg leading-relaxed">{sub}</p>
        <ul className="space-y-3">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-3 text-zinc-300">
              <span className="mt-1 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs" style={{ background: `${accent}20`, color: accent }}>✓</span>
              <span className="text-sm leading-relaxed">{b}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className={`${reverse ? "md:order-1" : ""} transition-all duration-1000 delay-200 ${visible ? "opacity-100 translate-x-0" : `opacity-0 ${reverse ? "-translate-x-12" : "translate-x-12"}`}`}>
        {visual}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// Animated Gradient Orb
// ─────────────────────────────────────────────
function GradientOrb({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`absolute rounded-full blur-3xl pointer-events-none ${className}`}
      style={{ animation: "orb-float 8s ease-in-out infinite", ...style }}
    />
  );
}

// ─────────────────────────────────────────────
// Feature visual cards
// ─────────────────────────────────────────────
function VisualCard({ children, accent = "#8b5cf6" }: { children: React.ReactNode; accent?: string }) {
  return (
    <div
      className="rounded-2xl border p-6 shadow-2xl relative overflow-hidden"
      style={{ background: "#07070e", borderColor: `${accent}30` }}
    >
      <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl opacity-20" style={{ background: accent }} />
      <div className="relative">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Testimonials
// ─────────────────────────────────────────────
const TESTIMONIALS = [
  { name: "Marcus Reid", role: "CTO @ Vercel Clone", text: "GOATSaaS replaced 4 internal tools. The AI analyst alone saves our team 3 hours every morning.", avatar: "MR" },
  { name: "Priya Sharma", role: "Head of Eng @ Fintech Startup", text: "The NL→SQL terminal is insane. Our analysts write zero SQL now. It just works.", avatar: "PS" },
  { name: "Alex Thompson", role: "Founder @ DevOps SaaS", text: "The anomaly detection caught a production incident 12 minutes before our Datadog alert fired.", avatar: "AT" },
  { name: "Chen Wei", role: "Principal Eng @ AI Startup", text: "Telemetry + Knowledge Base combined = the AI grounding feature we've been building for 6 months, done in a day.", avatar: "CW" },
];

function Testimonials() {
  const { ref, visible } = useReveal(0.1);
  return (
    <section
      ref={ref}
      className={`py-24 px-6 md:px-16 max-w-7xl mx-auto transition-all duration-1000 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-16"}`}
    >
      <div className="text-center mb-16">
        <span className="text-xs font-mono text-purple-400 border border-purple-500/30 px-3 py-1.5 rounded-full bg-purple-500/5 inline-block mb-6">What engineers say</span>
        <h2 className="text-4xl md:text-5xl font-black text-white">Loved by teams who ship.</h2>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        {TESTIMONIALS.map((t, i) => (
          <div
            key={i}
            className="rounded-2xl border border-zinc-800 p-6 space-y-4 transition-all duration-700 hover:border-purple-500/30 hover:-translate-y-1"
            style={{ background: "#07070e", transitionDelay: `${i * 80}ms` }}
          >
            <div className="flex text-amber-400 text-sm gap-0.5">{"★★★★★"}</div>
            <p className="text-zinc-300 leading-relaxed text-sm">&ldquo;{t.text}&rdquo;</p>
            <div className="flex items-center gap-3 pt-2 border-t border-zinc-900">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-xs font-bold text-white">{t.avatar}</div>
              <div>
                <div className="text-sm font-semibold text-white">{t.name}</div>
                <div className="text-xs text-zinc-500">{t.role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// Pricing
// ─────────────────────────────────────────────
const PLANS = [
  {
    name: "Starter", price: "Free", desc: "Perfect for solo devs",
    features: ["AI Analyst (50 calls/day)", "NL→SQL Terminal", "Knowledge Base (10 docs)", "Cloud Map", "Basic Telemetry"],
    cta: "Get started free", href: "/sign-up", highlight: false,
  },
  {
    name: "Pro", price: "$29", period: "/mo", desc: "For growing SaaS teams",
    features: ["Unlimited AI calls", "RAG with 500 docs", "Anomaly Detection", "Full Telemetry + Exports", "Admin Panel", "Priority support"],
    cta: "Start free trial", href: "/sign-up", highlight: true,
  },
  {
    name: "Enterprise", price: "Custom", desc: "For large orgs",
    features: ["Unlimited everything", "Dedicated infra", "SOC 2 / HIPAA", "SSO / SAML", "Custom models", "SLA + white-glove"],
    cta: "Talk to us", href: "/sign-up", highlight: false,
  },
];

function Pricing() {
  const { ref, visible } = useReveal(0.1);
  return (
    <section
      ref={ref}
      id="pricing"
      className={`py-24 px-6 md:px-16 max-w-6xl mx-auto transition-all duration-1000 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-16"}`}
    >
      <div className="text-center mb-16">
        <span className="text-xs font-mono text-purple-400 border border-purple-500/30 px-3 py-1.5 rounded-full bg-purple-500/5 inline-block mb-6">Transparent pricing</span>
        <h2 className="text-4xl md:text-5xl font-black text-white">Start free. Scale infinitely.</h2>
        <p className="text-zinc-400 mt-4 text-lg">No credit card required. Upgrade when you need.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        {PLANS.map((plan, i) => (
          <div
            key={i}
            className={`rounded-2xl border p-8 space-y-6 transition-all duration-500 hover:-translate-y-2 relative overflow-hidden ${plan.highlight ? "border-purple-500/50 shadow-[0_0_60px_rgba(139,92,246,0.15)]" : "border-zinc-800"}`}
            style={{ background: plan.highlight ? "linear-gradient(135deg, #0d0b1a, #0a0a12)" : "#07070e", transitionDelay: `${i * 100}ms` }}
          >
            {plan.highlight && (
              <>
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500 to-transparent" />
                <div className="absolute top-4 right-4">
                  <span className="text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-1 rounded-full">Most popular</span>
                </div>
              </>
            )}
            <div>
              <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-2">{plan.name}</div>
              <div className="flex items-end gap-1">
                <span className="text-4xl font-black text-white">{plan.price}</span>
                {plan.period && <span className="text-zinc-500 mb-1">{plan.period}</span>}
              </div>
              <p className="text-sm text-zinc-500 mt-1">{plan.desc}</p>
            </div>
            <ul className="space-y-3">
              {plan.features.map((f, j) => (
                <li key={j} className="flex items-center gap-2 text-sm text-zinc-400">
                  <span className="text-purple-400 text-xs">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href={plan.href}
              className={`block text-center py-3 px-6 rounded-xl text-sm font-semibold transition-all ${plan.highlight ? "bg-purple-600 hover:bg-purple-500 text-white" : "border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white"}`}
            >
              {plan.cta} →
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// Hero Section
// ─────────────────────────────────────────────
function HeroSection() {
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-6" style={{ paddingTop: 80 }}>
      {/* Background orbs */}
      <GradientOrb className="w-[600px] h-[600px] -top-40 left-1/2 -translate-x-1/2 opacity-30" style={{ background: "radial-gradient(circle, #8b5cf6, #3b82f6, transparent)" }} />
      <GradientOrb className="w-96 h-96 bottom-0 right-0 opacity-15" style={{ background: "radial-gradient(circle, #10b981, transparent)", animationDelay: "-3s" }} />
      <GradientOrb className="w-64 h-64 top-1/4 left-0 opacity-10" style={{ background: "radial-gradient(circle, #f59e0b, transparent)", animationDelay: "-6s" }} />

      {/* Noise grain overlay */}
      <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }} />

      {/* Content */}
      <div
        className="relative text-center max-w-4xl mx-auto"
        style={{ transform: `translateY(${scrollY * 0.25}px)`, opacity: 1 - scrollY * 0.0015 }}
      >
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-zinc-900/80 border border-zinc-800 rounded-full px-4 py-2 text-xs font-mono text-zinc-400 mb-8 backdrop-blur-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
          Now with RAG Knowledge Base + Live Telemetry
          <span className="text-purple-400 font-semibold">↗ What&apos;s new</span>
        </div>

        {/* Headline */}
        <h1 className="text-6xl md:text-8xl font-black leading-[0.95] tracking-tight mb-8">
          <span className="text-white">Your SaaS.</span>
          <br />
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(135deg, #8b5cf6 0%, #3b82f6 40%, #10b981 100%)" }}
          >
            Fully Autonomous.
          </span>
        </h1>

        <p className="text-xl md:text-2xl text-zinc-400 max-w-2xl mx-auto leading-relaxed mb-10">
          One command center to run your entire SaaS — AI diagnostics, natural language SQL, live telemetry, anomaly detection, and RAG knowledge base.{" "}
          <span className="text-zinc-200">Zero context switching.</span>
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <Link
            href="/sign-up"
            className="group px-8 py-4 rounded-2xl text-base font-semibold text-white transition-all duration-300 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}
          >
            <span className="relative z-10">Start for free →</span>
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: "linear-gradient(135deg, #8b5cf6, #3b82f6)" }} />
          </Link>
          <Link
            href="/dashboard"
            className="px-8 py-4 rounded-2xl text-base font-semibold text-zinc-300 border border-zinc-700 hover:border-zinc-500 hover:text-white transition-all duration-300"
          >
            View live demo
          </Link>
        </div>

        {/* Social proof strip */}
        <div className="flex items-center justify-center gap-6 text-xs text-zinc-600 mb-16">
          {["No credit card", "Free forever plan", "Deploy in 60 seconds"].map((t, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="text-emerald-500">✓</span>
              {t}
            </div>
          ))}
        </div>
      </div>

      {/* Dashboard mockup */}
      <div
        className="w-full max-w-4xl mx-auto relative"
        style={{ transform: `translateY(${scrollY * 0.08}px)` }}
      >
        <DashboardMockup />
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
        <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">Scroll to explore</div>
        <div className="w-px h-8 bg-gradient-to-b from-zinc-600 to-transparent" />
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// Stats bar
// ─────────────────────────────────────────────
function StatsBar() {
  const { ref, visible } = useReveal(0.2);
  const STATS = [
    { label: "Engineers using GOATSaaS", end: 5000, suffix: "+" },
    { label: "AI queries answered daily", end: 14400, suffix: "" },
    { label: "Anomalies caught per week", end: 847, suffix: "" },
    { label: "Minutes saved per engineer / day", end: 180, suffix: "+" },
  ];
  return (
    <section
      ref={ref}
      className={`py-20 border-y border-zinc-900 transition-all duration-1000 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
      style={{ background: "linear-gradient(90deg, rgba(139,92,246,0.03), transparent, rgba(59,130,246,0.03))" }}
    >
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-12">
        {STATS.map((s, i) => (
          <div key={i} className="text-center">
            <div className="text-4xl md:text-5xl font-black text-white mb-2">
              <Counter end={s.end} suffix={s.suffix} />
            </div>
            <div className="text-xs text-zinc-500 leading-relaxed">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// Feature visuals
// ─────────────────────────────────────────────
function AiVisual() {
  return (
    <VisualCard accent="#8b5cf6">
      <div className="space-y-3 font-mono text-xs">
        <div className="flex items-center gap-2 text-zinc-400 mb-4">
          <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
          <span className="text-purple-400 font-semibold">AI Analyst — Live Stream</span>
        </div>
        {[
          { role: "user", text: "Why did revenue drop 12% on Thursday?" },
          { role: "ai", text: "Thursday's revenue declined due to 3 factors: (1) Payment gateway timeout at 14:23 UTC affecting 847 transactions, (2) Churn spike in the EU region — 23 Pro cancellations — correlated with a competitor announcement, (3) Anomalous latency on /api/checkout averaging 2,340ms vs baseline 142ms…" },
        ].map((m, i) => (
          <div key={i} className={`rounded-xl p-3 ${m.role === "user" ? "bg-zinc-800/60 border border-zinc-700 ml-6" : "bg-purple-500/10 border border-purple-500/20 mr-6"}`}>
            <div className={`text-[9px] font-semibold mb-1 ${m.role === "ai" ? "text-purple-400" : "text-zinc-400"}`}>
              {m.role === "ai" ? "🤖 Groq LLM" : "You"}
            </div>
            <div className="text-zinc-300 leading-relaxed text-[10px]">{m.text}</div>
            {m.role === "ai" && <span className="text-purple-400 animate-pulse">▋</span>}
          </div>
        ))}
      </div>
    </VisualCard>
  );
}

function SqlVisual() {
  return (
    <VisualCard accent="#3b82f6">
      <div className="space-y-4">
        <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-4">
          <div className="text-[9px] text-zinc-500 mb-2 font-mono">Natural language →</div>
          <div className="text-sm text-zinc-200 font-medium">&ldquo;Show me monthly revenue by plan type for the last 6 months&rdquo;</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-gradient-to-r from-blue-500/50 to-transparent" />
          <span className="text-[10px] font-mono text-blue-400">Translating…</span>
          <div className="flex-1 h-px bg-gradient-to-l from-blue-500/50 to-transparent" />
        </div>
        <div className="bg-zinc-950 rounded-xl border border-blue-500/20 p-4 font-mono text-[10px]">
          <div><span className="text-blue-400">SELECT </span><span className="text-zinc-300">plan_type, DATE_TRUNC(</span><span className="text-amber-400">&apos;month&apos;</span><span className="text-zinc-300">, created_at) as month,</span></div>
          <div><span className="text-zinc-600 ml-4">SUM</span><span className="text-zinc-300">(amount) as total_revenue</span></div>
          <div><span className="text-blue-400">FROM </span><span className="text-emerald-400">revenue</span></div>
          <div><span className="text-blue-400">WHERE </span><span className="text-zinc-300">created_at &gt;= NOW() - INTERVAL </span><span className="text-amber-400">&apos;6 months&apos;</span></div>
          <div><span className="text-blue-400">GROUP BY </span><span className="text-zinc-300">1, 2 </span><span className="text-blue-400">ORDER BY </span><span className="text-zinc-300">2 DESC</span></div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[{plan:"Pro",rev:"$68.4K"},{plan:"Enterprise",rev:"$29.1K"},{plan:"Free",rev:"$0"}].map((r,i)=>(
            <div key={i} className="bg-zinc-900/60 rounded-lg border border-zinc-800 p-2 text-center">
              <div className="text-[9px] text-zinc-500 font-mono">{r.plan}</div>
              <div className="text-xs font-bold text-white font-mono">{r.rev}</div>
            </div>
          ))}
        </div>
      </div>
    </VisualCard>
  );
}

function TelemetryVisual() {
  return (
    <VisualCard accent="#ef4444">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-white">Live Latency Monitor</span>
          <span className="flex items-center gap-1.5 text-[9px] text-emerald-400 font-mono">
            <span className="w-1 h-1 bg-emerald-400 rounded-full animate-pulse" />
            Live
          </span>
        </div>
        <svg viewBox="0 0 300 80" className="w-full" style={{ height: 80 }}>
          <defs>
            <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.5"/>
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0"/>
            </linearGradient>
          </defs>
          <path d="M0,60 C30,55 50,50 80,52 C100,53 110,40 130,35 C150,30 160,55 180,15 C190,5 200,65 230,58 C250,54 270,48 300,50 L300,80 L0,80Z" fill="url(#tg)"/>
          <path d="M0,60 C30,55 50,50 80,52 C100,53 110,40 130,35 C150,30 160,55 180,15 C190,5 200,65 230,58 C250,54 270,48 300,50" fill="none" stroke="#8b5cf6" strokeWidth="2"/>
          <circle cx="180" cy="15" r="5" fill="#ef4444"/>
          <line x1="180" y1="15" x2="180" y2="80" stroke="#ef4444" strokeWidth="1" strokeDasharray="3 2" opacity="0.4"/>
        </svg>
        <div className="rounded-xl bg-zinc-950/80 border border-red-500/20 p-3 flex items-start gap-3">
          <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-xs font-semibold text-red-300">Anomaly Detected — z=3.4</div>
            <div className="text-[10px] text-zinc-500 mt-0.5">Latency spike: 1,840ms vs 142ms baseline · /api/inference</div>
          </div>
          <button className="ml-auto text-[9px] text-purple-400 border border-purple-500/30 px-2 py-1 rounded-lg flex-shrink-0">🤖 Explain</button>
        </div>
      </div>
    </VisualCard>
  );
}

function KbVisual() {
  return (
    <VisualCard accent="#10b981">
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-white">Knowledge Base</span>
          <span className="text-[9px] font-mono text-emerald-400">3 docs · 1,281 chunks</span>
        </div>
        <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-3 space-y-1.5 font-mono text-[9px]">
          <div className="text-zinc-500">Search your knowledge base…</div>
          <div className="text-emerald-400">&gt; What are the refund policy terms?</div>
        </div>
        <div className="space-y-2">
          {[
            { doc: "Refund_Policy.pdf", text: "Customers may request a full refund within 30 days of subscription start. Enterprise plans require 14-day written notice…", score: 0.97 },
            { doc: "Terms_of_Service.md", text: "Section 4.2 — Billing and Refunds: All refund requests must be submitted via support ticket with order reference…", score: 0.88 },
          ].map((r, i) => (
            <div key={i} className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-semibold text-emerald-400">{r.doc}</span>
                <span className="text-[8px] font-mono text-zinc-500">score: {r.score}</span>
              </div>
              <p className="text-[9px] text-zinc-400 leading-relaxed">{r.text}</p>
            </div>
          ))}
        </div>
      </div>
    </VisualCard>
  );
}

// ─────────────────────────────────────────────
// Logo strip (tech stack)
// ─────────────────────────────────────────────
function TechStrip() {
  const { ref, visible } = useReveal(0.2);
  const techs = [
    { name: "Next.js 16", icon: "▲" },
    { name: "Python FastAPI", icon: "⚡" },
    { name: "Groq AI", icon: "🤖" },
    { name: "Three.js", icon: "🌐" },
    { name: "Neon Postgres", icon: "🗄️" },
    { name: "Recharts", icon: "📊" },
    { name: "asyncpg", icon: "🔗" },
    { name: "Tailwind", icon: "🎨" },
  ];
  return (
    <section
      ref={ref}
      className={`py-16 px-6 transition-all duration-1000 ${visible ? "opacity-100" : "opacity-0"}`}
    >
      <div className="max-w-5xl mx-auto text-center">
        <div className="text-xs font-mono text-zinc-600 uppercase tracking-widest mb-8">Built on the modern stack</div>
        <div className="flex flex-wrap justify-center gap-4">
          {techs.map((t, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-zinc-800 bg-zinc-900/40 text-xs text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 transition-all cursor-default"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <span>{t.icon}</span>
              {t.name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// Main scroll story engine
// ─────────────────────────────────────────────
export default function ScrollStoryEngine() {
  return (
    <>
      <style>{`
        @keyframes orb-float {
          0%, 100% { transform: translateY(0px) scale(1); }
          33% { transform: translateY(-30px) scale(1.05); }
          66% { transform: translateY(20px) scale(0.97); }
        }
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>

      <HeroSection />

      <StatsBar />

      <TechStrip />

      {/* Feature 1 — AI Analyst */}
      <FeatureSection
        eyebrow="AI Business Analyst"
        headline={"Ask anything.\nGet answers in seconds."}
        sub="Natural language questions answered by Groq LLaMA-3-70b with full context of your database, telemetry, and business metrics. No dashboards required."
        bullets={[
          "Multi-model routing: Groq, Gemini, HuggingFace — auto-selected by query type",
          "Streams token-by-token like ChatGPT, grounded in your real Postgres data",
          "RAG mode: answers augmented by your private Knowledge Base documents",
          "Diagnostic explain: paste any error, get a root-cause breakdown instantly",
        ]}
        visual={<AiVisual />}
        accent="#8b5cf6"
      />

      {/* Feature 2 — NL→SQL */}
      <FeatureSection
        eyebrow="Natural Language → SQL"
        headline={"Zero SQL.\nFull database power."}
        sub="Type a business question in plain English. Get a production-ready SQL query, live results table, and one-click CSV export — all in under 2 seconds."
        bullets={[
          "Understands your real schema — no mapping or config required",
          "Explains each query in plain English before running it",
          "Export results to CSV or PDF directly from the terminal",
          "Query history with full diff — see how your data changed over time",
        ]}
        visual={<SqlVisual />}
        reverse
        accent="#3b82f6"
      />

      {/* Feature 3 — Telemetry */}
      <FeatureSection
        eyebrow="Live Telemetry + Anomaly Detection"
        headline={"Catch incidents\nbefore your users do."}
        sub="Z-score powered anomaly detection runs in the background 24/7. The moment a latency spike, error rate, or usage pattern deviates from baseline — you know."
        bullets={[
          "Real-time latency chart with anomaly scatter overlay (Recharts ComposedChart)",
          "Configurable Z-score threshold (1.0–5.0) with debounced live backend sync",
          "Per-anomaly AI Explain: stream a Groq LLM root-cause analysis in-place",
          "One-click Resolve/Unresolve with optimistic UI + server sync",
        ]}
        visual={<TelemetryVisual />}
        accent="#ef4444"
      />

      {/* Feature 4 — Knowledge Base */}
      <FeatureSection
        eyebrow="RAG Knowledge Base"
        headline={"Your docs.\nInside every AI answer."}
        sub="Drag-and-drop PDFs, CSVs, and Markdown files. They're chunked, embedded, and surfaced automatically whenever the AI Analyst answers a question about your product."
        bullets={[
          "Drag-and-drop upload with real-time indexing progress and chunk count",
          "Semantic search across all documents — powered by vector embeddings",
          "Toggle RAG grounding per query — AI answers cite exact document passages",
          "Full document management: type badges, delete, refresh from the admin panel",
        ]}
        visual={<KbVisual />}
        reverse
        accent="#10b981"
      />

      <Testimonials />

      <Pricing />
    </>
  );
}