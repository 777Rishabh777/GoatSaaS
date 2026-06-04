"use client";
import { useState, useEffect, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function SignInContent() {
  const { login } = useAuth();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.error) {
        setError(result.error);
        setLoading(false);
      } else {
        // Reset loading state after 5 seconds to prevent UI freeze on slow route transitions
        setTimeout(() => {
          setLoading(false);
        }, 5000);
      }
    } catch (err) {
      if (err instanceof TypeError && (err as TypeError).message === 'Failed to fetch') {
        setError("Cannot connect to server. Please wait a moment and try again.");
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
      setLoading(false);
    }
  };

  const fillDemo = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await login("rishabh@goatsaas.com", "password");
      if (result.error) {
        setError(result.error);
        setLoading(false);
      }
    } catch (err) {
      setError("Cannot connect to server. Please wait and try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-zinc-950 font-sans">
      {/* Left side: Form */}
      <div className="w-full lg:w-[45%] flex flex-col justify-center px-8 sm:px-16 lg:px-24 xl:px-32 relative z-10">
        <div className="w-full max-w-md mx-auto">
          {/* Logo */}
          <Link href="/" className="inline-flex items-center mb-10">
            <img src="/logo.png" alt="GOATSaaS Logo" className="h-20 w-auto object-contain drop-shadow-md" />
          </Link>
          
          <h1 className="text-3xl font-bold text-white mb-2">Welcome back</h1>
          <p className="text-zinc-400 mb-8">
            Sign in to your AI command center.
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Email address</label>
              <input
                id="signin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-dark w-full rounded-xl px-4 py-3 text-sm"
                placeholder="you@company.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-zinc-300">Password</label>
                <a href="#" className="text-xs text-purple-400 hover:text-purple-300 transition-colors">Forgot password?</a>
              </div>
              <input
                id="signin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-dark w-full rounded-xl px-4 py-3 text-sm"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
                <span>⚠</span> {error}
              </div>
            )}

            <button
              id="signin-submit"
              type="submit"
              disabled={loading}
              className="btn-primary w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? "Signing in..." : "Sign in →"}
            </button>
          </form>

          {/* Hidden Demo quick-fill button for the user (only showing user demo to save them time) */}
          <button onClick={fillDemo} className="mt-6 w-full btn-ghost rounded-xl py-2 text-xs font-mono text-center text-zinc-500 hover:text-zinc-300 border border-transparent hover:border-zinc-800 transition-all">
            👤 One-click Demo Login
          </button>

          <p className="text-center text-zinc-500 text-sm mt-8">
            New to GOAT SaaS?{" "}
            <Link href="/sign-up" className="text-purple-400 hover:text-purple-300 font-medium transition-colors">
              Create an account
            </Link>
          </p>
        </div>
      </div>

      {/* Right side: Animated System Connecting Wallpaper */}
      <div className="hidden lg:flex w-[55%] relative items-center justify-center bg-zinc-900 border-l border-zinc-800 overflow-hidden">
        {/* Deep Background Gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-zinc-900 to-zinc-950" />
        
        {/* Animated Connecting Nodes */}
        <div className="absolute inset-0 opacity-40">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="lineGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0" />
                <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="lineGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0" />
                <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
              </linearGradient>
            </defs>
            <g className="animate-[pulse_4s_ease-in-out_infinite]">
              {/* Lines */}
              <line x1="20%" y1="30%" x2="50%" y2="50%" stroke="url(#lineGrad1)" strokeWidth="1" />
              <line x1="80%" y1="20%" x2="50%" y2="50%" stroke="url(#lineGrad2)" strokeWidth="1" />
              <line x1="50%" y1="50%" x2="30%" y2="80%" stroke="url(#lineGrad2)" strokeWidth="1" />
              <line x1="50%" y1="50%" x2="70%" y2="70%" stroke="url(#lineGrad1)" strokeWidth="1" />
              <line x1="30%" y1="80%" x2="70%" y2="70%" stroke="url(#lineGrad1)" strokeWidth="1" />
              
              {/* Nodes */}
              <circle cx="50%" cy="50%" r="6" fill="#8b5cf6" className="animate-ping origin-center" style={{ animationDuration: '3s' }} />
              <circle cx="50%" cy="50%" r="4" fill="#a855f7" />
              
              <circle cx="20%" cy="30%" r="3" fill="#3b82f6" />
              <circle cx="80%" cy="20%" r="3" fill="#8b5cf6" />
              <circle cx="30%" cy="80%" r="3" fill="#8b5cf6" />
              <circle cx="70%" cy="70%" r="3" fill="#3b82f6" />
            </g>
          </svg>
        </div>

        {/* Floating cards */}
        <div className="relative z-10 w-full max-w-lg mx-auto">
          <div className="glass bg-black/40 backdrop-blur-md rounded-2xl border border-zinc-800/50 p-6 mb-6 transform -translate-x-8 animate-[float_6s_ease-in-out_infinite]">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">🤖</div>
              <div>
                <div className="text-sm font-bold text-white">System Connecting</div>
                <div className="text-xs text-purple-400 font-mono">establishing secure link...</div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full w-2/3 animate-[pulse_2s_ease-in-out_infinite]"></div>
              </div>
              <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full w-1/2 animate-[pulse_2.5s_ease-in-out_infinite]"></div>
              </div>
            </div>
          </div>

          <div className="glass bg-black/40 backdrop-blur-md rounded-2xl border border-zinc-800/50 p-6 transform translate-x-12 animate-[float_7s_ease-in-out_infinite_reverse]">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs text-zinc-500 font-mono">TELEMETRY_SYNC</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[60, 80, 40, 90, 70, 50, 85, 30, 75].map((h, i) => (
                <div key={i} className="h-12 flex items-end justify-center">
                  <div className="w-full bg-emerald-500/20 rounded-sm" style={{ height: `${h}%` }}>
                    <div className="w-full bg-emerald-400/50 rounded-sm animate-[pulse_1.5s_ease-in-out_infinite]" style={{ height: '2px' }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex bg-zinc-950 items-center justify-center text-zinc-500">Loading...</div>}>
      <SignInContent />
    </Suspense>
  );
}
