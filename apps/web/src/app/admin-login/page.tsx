"use client";
import { useState, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { useRouter } from "next/navigation";

function AdminSignInContent() {
  const { adminLogin } = useAuth();
  const router = useRouter();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await adminLogin(email, password);
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
      setError("An unexpected error occurred.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-zinc-950 font-sans">
      <div className="w-full flex flex-col justify-center px-8 sm:px-16 lg:px-24 xl:px-32 relative z-10">
        <div className="w-full max-w-md mx-auto">
          {/* Logo */}
          <Link href="/" className="inline-flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white font-black text-lg">G</div>
            <span className="text-xl font-bold text-white">GOAT<span className="text-red-400">SaaS</span> Admin</span>
          </Link>
          
          <h1 className="text-3xl font-bold text-white mb-2">Admin Portal</h1>
          <p className="text-zinc-400 mb-8">
            Restricted access. Sign in with administrator credentials.
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Admin Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-dark w-full rounded-xl px-4 py-3 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500"
                placeholder="admin@company.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-dark w-full rounded-xl px-4 py-3 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500"
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
              type="submit"
              disabled={loading}
              className="bg-red-600 hover:bg-red-500 text-white w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed mt-2 transition-all"
            >
              {loading ? "Authenticating..." : "Access Admin Portal →"}
            </button>
          </form>

          <p className="text-center text-zinc-500 text-sm mt-8">
            Not an administrator?{" "}
            <Link href="/sign-in" className="text-zinc-400 hover:text-white font-medium transition-colors">
              Return to User Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AdminSignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex bg-zinc-950 items-center justify-center text-zinc-500">Loading...</div>}>
      <AdminSignInContent />
    </Suspense>
  );
}
