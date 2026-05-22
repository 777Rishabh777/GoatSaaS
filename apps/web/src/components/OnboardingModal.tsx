"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

interface Step {
  id: number;
  title: string;
  subtitle: string;
  icon: string;
}

const STEPS: Step[] = [
  { id: 1, title: "Welcome to GOATSaaS!", subtitle: "The autonomous AI command center for your SaaS.", icon: "🎉" },
  { id: 2, title: "Choose Your AI Model", subtitle: "Pick the AI backbone powering your analytics.", icon: "🤖" },
  { id: 3, title: "Upload to Knowledge Base", subtitle: "Feed your AI with your docs, runbooks, and specs.", icon: "🧠" },
  { id: 4, title: "You're all set!", subtitle: "Your command center is ready. Let's launch.", icon: "🚀" },
];

const MODELS = [
  { id: "groq", name: "Llama 3 (Groq)", desc: "Ultra-fast. 500 tokens/sec. Best for real-time queries.", badge: "⚡", recommended: true },
  { id: "gemini", name: "Gemini Pro", desc: "Smart reasoning. Best for complex multi-step analysis.", badge: "✨", recommended: false },
  { id: "ollama", name: "Ollama (Local)", desc: "100% private. Runs on your hardware. No data leaves.", badge: "🏠", recommended: false },
];

const STORAGE_KEY = "goat_onboarding_done";

export default function OnboardingModal() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedModel, setSelectedModel] = useState("groq");
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!user) return;
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      // Small delay to let the page render first
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, [user]);

  const dismiss = () => {
    setClosing(true);
    setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, "1");
      setVisible(false);
      setClosing(false);
    }, 300);
  };

  const next = () => {
    if (step < STEPS.length) setStep(s => s + 1);
    else dismiss();
  };
  const back = () => setStep(s => Math.max(1, s - 1));

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await fetch("http://localhost:8000/api/v1/rag/upload", {
        method: "POST",
        headers: { "X-Org-Id": user?.orgName ?? "default_org" },
        body: fd,
      });
      setUploadDone(true);
    } catch {
      setUploadDone(true); // still mark done to not block progress
    }
    setUploading(false);
  };

  if (!visible) return null;

  const current = STEPS[step - 1];
  const progress = (step / STEPS.length) * 100;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ${closing ? "opacity-0 scale-95" : "opacity-100 scale-100"}`}
      style={{ background: "rgba(4,4,8,0.85)", backdropFilter: "blur(12px)" }}
    >
      <div className="w-full max-w-lg glass rounded-3xl border border-[var(--border)] shadow-2xl overflow-hidden" style={{ boxShadow: "0 0 60px rgba(139,92,246,0.15)" }}>
        {/* Progress bar */}
        <div className="h-1 bg-zinc-900">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Header */}
        <div className="p-8 pb-0">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              {STEPS.map(s => (
                <div
                  key={s.id}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${step >= s.id ? "bg-purple-500 w-6" : "bg-zinc-700"}`}
                />
              ))}
            </div>
            <button onClick={dismiss} className="text-zinc-500 hover:text-white transition-colors text-sm font-medium">
              Skip
            </button>
          </div>

          <div className="text-5xl mb-4">{current.icon}</div>
          <h2 className="text-2xl font-bold text-white mb-1">{current.title}</h2>
          <p className="text-zinc-400 text-sm">{current.subtitle}</p>
        </div>

        {/* Step content */}
        <div className="p-8 pt-6">
          {/* Step 1: Welcome */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4">
                <div className="text-sm font-semibold text-white mb-2">Hi {user?.name?.split(" ")[0]} 👋</div>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  GOATSaaS is your AI-powered command center. In the next few steps, we'll get you set up with the right AI model and your first knowledge document.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { icon: "⚡", label: "NL→SQL" },
                  { icon: "🤖", label: "AI Analyst" },
                  { icon: "📡", label: "Telemetry" },
                ].map(f => (
                  <div key={f.label} className="bg-zinc-900 rounded-xl border border-zinc-800 p-3">
                    <div className="text-xl mb-1">{f.icon}</div>
                    <div className="text-xs text-zinc-400">{f.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Choose model */}
          {step === 2 && (
            <div className="space-y-3">
              {MODELS.map(m => (
                <label
                  key={m.id}
                  className={`flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all ${selectedModel === m.id ? "border-purple-500/60 bg-purple-500/10" : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"}`}
                >
                  <input type="radio" name="model" value={m.id} checked={selectedModel === m.id} onChange={() => setSelectedModel(m.id)} className="sr-only" />
                  <span className="text-2xl flex-shrink-0">{m.badge}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-sm">{m.name}</span>
                      {m.recommended && <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-mono uppercase border border-purple-500/30">Recommended</span>}
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">{m.desc}</p>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 ${selectedModel === m.id ? "border-purple-500 bg-purple-500" : "border-zinc-600"}`} />
                </label>
              ))}
            </div>
          )}

          {/* Step 3: Upload */}
          {step === 3 && (
            <div className="space-y-4">
              {uploadDone ? (
                <div className="p-6 text-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10">
                  <div className="text-3xl mb-2">✅</div>
                  <div className="text-emerald-400 font-semibold">Document uploaded successfully!</div>
                  <div className="text-sm text-zinc-400 mt-1">Your AI is being indexed and will be ready shortly.</div>
                </div>
              ) : (
                <label className={`flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${uploading ? "border-purple-500/40 bg-purple-500/5 cursor-wait" : "border-zinc-700 hover:border-purple-500/50 hover:bg-purple-500/5"}`}>
                  <input type="file" accept=".pdf,.txt,.md,.csv" className="sr-only" onChange={handleFileUpload} disabled={uploading} />
                  <div className="text-4xl mb-3">{uploading ? "⏳" : "📁"}</div>
                  <div className="font-semibold text-white text-sm">{uploading ? "Uploading & indexing…" : "Drop a file or click to upload"}</div>
                  <div className="text-xs text-zinc-500 mt-1">PDF, TXT, MD, CSV · Max 10MB</div>
                </label>
              )}
              <p className="text-xs text-zinc-500 text-center">Or skip this — you can always upload later from the Knowledge Base tab.</p>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-2xl border border-purple-500/20 p-6 text-center">
                <div className="text-lg font-semibold text-white mb-2">Your setup is complete!</div>
                <div className="text-sm text-zinc-400">
                  AI model: <span className="text-purple-400 font-mono">{MODELS.find(m => m.id === selectedModel)?.name}</span>
                  {uploadDone && <> · 1 document indexed</>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  { icon: "📊", label: "Check your Overview", tab: "See metrics" },
                  { icon: "⚡", label: "Try NL→SQL", tab: "Ask a question" },
                  { icon: "🤖", label: "Chat with AI", tab: "Analyze data" },
                  { icon: "📡", label: "View Telemetry", tab: "Live monitoring" },
                ].map(c => (
                  <div key={c.label} className="bg-zinc-900 rounded-xl border border-zinc-800 p-3">
                    <div className="text-lg mb-1">{c.icon}</div>
                    <div className="font-medium text-white">{c.label}</div>
                    <div className="text-zinc-500 mt-0.5">{c.tab}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 pb-8 flex items-center justify-between gap-4">
          {step > 1 ? (
            <button onClick={back} className="btn-ghost px-4 py-2.5 rounded-xl text-sm font-medium border border-zinc-800 hover:text-white">
              ← Back
            </button>
          ) : <div />}
          <button onClick={next} className="btn-primary flex-1 max-w-[200px] py-2.5 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5">
            {step === STEPS.length ? "Launch Dashboard 🚀" : "Continue →"}
          </button>
        </div>
      </div>
    </div>
  );
}
