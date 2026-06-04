"use client";

import React, { useState, useEffect } from "react";
import { Key, Save, CheckCircle2, AlertCircle, RefreshCw, Trash2 } from "lucide-react";

interface LlmKey {
  provider: string;
  maskedKey: string;
}

export default function SettingsPanel() {
  const [provider, setProvider] = useState("gemini");
  const [apiKey, setApiKey] = useState("");
  const [keys, setKeys] = useState<LlmKey[]>([]);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error" | "none"; msg: string }>({ type: "none", msg: "" });

  const loadKeys = () => {
    fetch("/api/settings/llm")
      .then(res => res.json())
      .then(data => {
        if (data.keys) {
          setKeys(data.keys);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadKeys();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    if (apiKey.includes("****")) {
      setStatus({ type: "success", msg: "Configuration is already saved securely." });
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/settings/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey }),
      });
      if (res.ok) {
        setStatus({ type: "success", msg: "API Key saved securely to the database." });
        setApiKey("");
        loadKeys();
      } else {
        setStatus({ type: "error", msg: "Failed to save API key." });
      }
    } catch {
      setStatus({ type: "error", msg: "Network error occurred." });
    }
    setSaving(false);
  };

  const handleDelete = async (prov: string) => {
    try {
      const res = await fetch("/api/settings/llm", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: prov }),
      });
      if (res.ok) {
        setStatus({ type: "success", msg: "API Key deleted." });
        loadKeys();
      } else {
        setStatus({ type: "error", msg: "Failed to delete API key." });
      }
    } catch {
      setStatus({ type: "error", msg: "Network error occurred." });
    }
  };

  const handleTest = async (testProvider: string, testKey?: string) => {
    const keyToUse = testKey || (provider === testProvider ? apiKey : "");
    if (!keyToUse || keyToUse.includes("****")) {
      setStatus({ type: "error", msg: "Please enter a raw API key to test." });
      return;
    }
    
    setTesting(true);
    setStatus({ type: "none", msg: "" });
    
    try {
      const res = await fetch("/api/v1/ai/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-LLM-Provider": testProvider,
          "X-LLM-Key": keyToUse
        }
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        setStatus({ type: "success", msg: "Connection successful! AI features are ready." });
      } else {
        setStatus({ type: "error", msg: data.error || "Connection failed. Please check your API key." });
      }
    } catch (e) {
      setStatus({ type: "error", msg: "Network error occurred." });
    }
    setTesting(false);
  };

  return (
    <div className="space-y-6 fade-in-up">
      <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden max-w-3xl">
        <div className="p-6 border-b border-zinc-900 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
            <Key className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">AI Provider Settings</h3>
            <p className="text-sm text-zinc-400">Manage multiple LLM API keys for AI Analyst, NL→SQL, and AI Audit.</p>
          </div>
        </div>
        
        <form onSubmit={handleSave} className="p-6 space-y-6 border-b border-zinc-900">
          <h4 className="text-sm font-medium text-white mb-2">Add New Key</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="block text-sm font-medium text-zinc-300">LLM Provider</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setProvider("gemini")}
                  className={`p-3 rounded-xl border text-sm font-medium flex items-center gap-2 transition-all ${provider === "gemini" ? "bg-purple-500/10 border-purple-500 text-white" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800"}`}
                >
                  <span className="text-xl">✨</span> Gemini
                </button>
                <button
                  type="button"
                  onClick={() => setProvider("claude")}
                  className={`p-3 rounded-xl border text-sm font-medium flex items-center gap-2 transition-all ${provider === "claude" ? "bg-emerald-500/10 border-emerald-500 text-white" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800"}`}
                >
                  <span className="text-xl">🧠</span> Claude
                </button>
                <button
                  type="button"
                  onClick={() => setProvider("openai")}
                  className={`p-3 rounded-xl border text-sm font-medium flex items-center gap-2 transition-all ${provider === "openai" ? "bg-blue-500/10 border-blue-500 text-white" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800"}`}
                >
                  <span className="text-xl">🤖</span> OpenAI
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-zinc-300">API Key</label>
              <input
                type="password"
                required
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={provider === "gemini" ? "AIzaSy..." : provider === "claude" ? "sk-ant-..." : "sk-..."}
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors font-mono text-sm"
              />
              <p className="text-xs text-zinc-500 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                Key is saved securely in the database.
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-white text-black px-6 py-2.5 rounded-lg font-medium text-sm hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save Key"}
            </button>
            <button
              type="button"
              onClick={() => handleTest(provider, apiKey)}
              disabled={testing || !apiKey}
              className="flex items-center gap-2 bg-zinc-800 text-white px-6 py-2.5 rounded-lg font-medium text-sm hover:bg-zinc-700 border border-zinc-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${testing ? "animate-spin" : ""}`} />
              {testing ? "Testing..." : "Test Connection"}
            </button>
          </div>
        </form>

        <div className="p-6">
          <h4 className="text-sm font-medium text-white mb-4">Saved Keys</h4>
          {keys.length === 0 ? (
            <div className="text-sm text-zinc-500 italic">No keys saved yet.</div>
          ) : (
            <div className="space-y-3">
              {keys.map(k => (
                <div key={k.provider} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="text-xl">
                      {k.provider === 'gemini' ? '✨' : k.provider === 'claude' ? '🧠' : '🤖'}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white capitalize">{k.provider}</div>
                      <div className="text-xs text-zinc-400 font-mono mt-0.5">{k.maskedKey}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(k.provider)}
                    className="p-2 hover:bg-rose-500/10 text-zinc-400 hover:text-rose-500 rounded-lg transition-colors"
                    title="Delete Key"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {status.type !== "none" && (
            <div className={`mt-6 p-4 rounded-xl text-sm flex items-start gap-3 ${status.type === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"}`}>
              {status.type === "success" ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
              <span className="mt-0.5">{status.msg}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
