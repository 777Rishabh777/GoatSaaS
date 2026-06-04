"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

const ScrollStoryEngine = dynamic(() => import("@/components/ScrollStory"), { ssr: false });

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const NAV_LINKS = [
    { label: "AI Analyst", href: "#features" },
    { label: "NL→SQL", href: "#features" },
    { label: "Telemetry", href: "#features" },
    { label: "Knowledge Base", href: "#features" },
    { label: "Pricing", href: "#pricing" },
  ];

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
      style={{
        background: scrolled ? "rgba(4,4,8,0.95)" : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "none",
        boxShadow: scrolled ? "0 4px 40px rgba(0,0,0,0.4)" : "none",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center group">
          <img src="/logo.png" alt="GOATSaaS Logo" className="h-16 w-auto object-contain drop-shadow-md transition-transform group-hover:scale-105" />
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map(l => (
            <a
              key={l.label}
              href={l.href}
              className="text-sm text-zinc-400 hover:text-white transition-colors duration-200 relative group"
            >
              {l.label}
              <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-purple-500 transition-all duration-300 group-hover:w-full" />
            </a>
          ))}
        </div>

        {/* CTA buttons */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/sign-in"
            className="text-sm text-zinc-400 hover:text-white transition-colors px-4 py-2 rounded-xl"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="text-sm font-semibold text-white px-5 py-2.5 rounded-xl transition-all duration-300 hover:opacity-90 hover:-translate-y-0.5"
            style={{ background: "linear-gradient(135deg, #00e5ff, #0088cc)" }}
          >
            Get started →
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-zinc-400 hover:text-white p-2 rounded-lg"
          onClick={() => setOpen(o => !o)}
        >
          <div className="space-y-1.5">
            <span className={`block w-6 h-0.5 bg-current transition-all ${open ? "rotate-45 translate-y-2" : ""}`} />
            <span className={`block w-6 h-0.5 bg-current transition-all ${open ? "opacity-0" : ""}`} />
            <span className={`block w-6 h-0.5 bg-current transition-all ${open ? "-rotate-45 -translate-y-2" : ""}`} />
          </div>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div
          className="md:hidden border-t border-zinc-900 px-6 py-4 space-y-2"
          style={{ background: "rgba(4,4,8,0.98)", backdropFilter: "blur(20px)" }}
        >
          {NAV_LINKS.map(l => (
            <a key={l.label} href={l.href} onClick={() => setOpen(false)} className="block text-sm text-zinc-400 hover:text-white py-2 transition-colors">
              {l.label}
            </a>
          ))}
          <div className="pt-4 flex flex-col gap-2 border-t border-zinc-900">
            <Link href="/sign-in" onClick={() => setOpen(false)} className="text-sm text-center text-zinc-400 py-2">Sign in</Link>
            <Link href="/sign-up" onClick={() => setOpen(false)} className="text-sm font-semibold text-white text-center py-2.5 rounded-xl" style={{ background: "linear-gradient(135deg, #00e5ff, #0088cc)" }}>
              Get started →
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

function Footer() {
  return (
    <footer className="border-t border-zinc-900 py-20 px-6 md:px-16" style={{ background: "#020204" }}>
      <div className="max-w-6xl mx-auto">
        {/* Final CTA block */}
        <div
          className="text-center mb-20 py-20 rounded-3xl relative overflow-hidden border border-purple-500/10"
          style={{ background: "radial-gradient(ellipse at 50% -20%, rgba(0,229,255,0.15) 0%, transparent 70%)" }}
        >
          <div className="absolute inset-0 rounded-3xl" style={{ background: "linear-gradient(180deg, rgba(0,229,255,0.05), transparent)" }} />
          <div className="relative">
            <span className="text-xs font-mono text-purple-400 border border-purple-500/30 px-3 py-1.5 rounded-full bg-purple-500/5 inline-block mb-8">
              Start for free — no credit card required
            </span>
            <h2 className="text-5xl md:text-6xl font-black text-white mb-4 leading-tight">
              The last dashboard
              <br />
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(135deg, #00e5ff, #ff007f, #0088cc)" }}>
                you&apos;ll ever need.
              </span>
            </h2>
            <p className="text-zinc-400 max-w-lg mx-auto mb-10 text-lg">
              Join 5,000+ engineers running their entire SaaS on GOATSaaS. Free forever, upgrade when you scale.
            </p>
            <Link
              href="/sign-up"
              className="inline-block px-10 py-4 rounded-2xl text-base font-semibold text-white transition-all hover:opacity-90 hover:-translate-y-1 duration-300"
              style={{ background: "linear-gradient(135deg, #00e5ff, #0088cc)" }}
            >
              Launch your command center →
            </Link>
          </div>
        </div>

        {/* Footer links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-14">
          <div>
            <div className="flex items-center mb-5">
              <img src="/logo.png" alt="GOATSaaS Logo" className="h-12 w-auto object-contain" />
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed">The autonomous AI command center for modern SaaS engineering teams.</p>
          </div>
          {[
            { title: "Product", links: ["Dashboard", "AI Analyst", "NL→SQL", "Telemetry", "Knowledge Base", "Admin Panel", "Cloud Map"] },
            { title: "Stack", links: ["Next.js 16", "Python FastAPI", "Three.js", "Groq AI", "Neon Postgres", "Recharts"] },
            { title: "Company", links: ["Sign In", "Sign Up", "Documentation", "Changelog", "Support", "Status"] },
          ].map(col => (
            <div key={col.title}>
              <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-5">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map(l => (
                  <li key={l}>
                    <span className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer">{l}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-zinc-900 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-zinc-700">© 2025 GOATSaaS. Built with Next.js + Python + Three.js + Groq.</p>
          <div className="flex gap-6 text-xs text-zinc-700">
            {["Privacy", "Terms", "Security"].map(l => (
              <span key={l} className="hover:text-zinc-400 cursor-pointer transition-colors">{l}</span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function MarketingPage() {
  return (
    <div className="min-h-screen" style={{ background: "#040408" }}>
      <Navbar />
      <main>
        <ScrollStoryEngine />
      </main>
      <Footer />
    </div>
  );
}