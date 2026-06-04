"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  plan: "free" | "pro" | "enterprise";
  avatar?: string;
  orgId?: string;
  orgName?: string;
  orgRole?: "owner" | "admin" | "member";
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  adminLogin: (email: string, password: string) => Promise<{ error?: string }>;
  signup: (name: string, email: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshUser = async () => {
    try {
      const r = await fetch("/api/auth/me", { credentials: "include" });
      if (r.status === 401) {
        // Stale or invalid cookie — clear it so the user isn't stuck in a loop
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
        setUser(null);
        return;
      }
      const data = await r.json();
      if (data.user) setUser(data.user);
      else setUser(null);
    } catch (e) {
      // Network error (server starting up) — don't log out, just set null
      console.warn("Could not reach /api/auth/me:", e);
      setUser(null);
    }
  };

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      return { error: (data?.hint || data?.detail || data?.error || "Login failed") as string };
    }
    setUser(data.user);
    // Small delay so the cookie is committed before navigation
    await new Promise(r => setTimeout(r, 100));
    router.push(data.user.role === "admin" ? "/admin" : "/dashboard");
    return {};
  };

  const signup = async (name: string, email: string, password: string) => {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      return { error: (data?.hint || data?.detail || data?.error || "Signup failed") as string };
    }
    setUser(data.user);
    await new Promise(r => setTimeout(r, 100));
    router.push("/dashboard");
    return {};
  };

  const adminLogin = async (email: string, password: string) => {
    const res = await fetch("/api/auth/admin-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      return { error: (data?.hint || data?.detail || data?.error || "Login failed") as string };
    }
    setUser(data.user);
    await new Promise(r => setTimeout(r, 100));
    router.push("/admin");
    return {};
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
    router.push("/sign-in");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, adminLogin, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
