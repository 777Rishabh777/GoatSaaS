"use client";

import { useState, useRef, useEffect } from "react";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";
import { useAuth } from "@/context/AuthContext";

export default function PyroWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "ai"; content: string; dataContext?: any }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initial greeting
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        { 
          role: "ai", 
          content: "Baa! ✨ I'm Pyro AI. I'm natively connected to your live database. Click 'Scan Data' and I'll give you a real-time health check on your business!" 
        }
      ]);
    }
  }, [isOpen, messages.length]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch("/api/v1/ai/pyro-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!res.ok) throw new Error("API failed");

      const data = await res.json();
      
      setMessages(prev => [...prev, { 
        role: "ai", 
        content: data.reply,
        dataContext: data.dataContext // Raw data to potentially chart
      }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: "ai", content: "Oops! I lost connection to your database. Please try again." }]);
    }
    setLoading(false);
  };

  // The Cute Goat Face SVG (Pyro AI)
  const GoatFace = ({ blinking }: { blinking?: boolean }) => (
    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_12px_rgba(62,207,142,0.8)] animate-float">
      {/* Horns */}
      <path d="M 38 35 Q 32 15 38 8 Q 45 20 45 35" fill="#10B981" />
      <path d="M 62 35 Q 68 15 62 8 Q 55 20 55 35" fill="#10B981" />
      
      {/* Ears (Animated) */}
      <g className="origin-[30px_45px] animate-wiggle-left">
        <ellipse cx="20" cy="50" rx="16" ry="7" transform="rotate(-25 20 50)" fill="#ffffff" />
        <ellipse cx="20" cy="50" rx="10" ry="4" transform="rotate(-25 20 50)" fill="#3ECF8E" opacity="0.6" />
      </g>
      <g className="origin-[70px_45px] animate-wiggle-right">
        <ellipse cx="80" cy="50" rx="16" ry="7" transform="rotate(25 80 50)" fill="#ffffff" />
        <ellipse cx="80" cy="50" rx="10" ry="4" transform="rotate(25 80 50)" fill="#3ECF8E" opacity="0.6" />
      </g>
      
      {/* Head */}
      <path d="M 28 45 C 28 20, 72 20, 72 45 C 72 75, 60 85, 50 88 C 40 85, 28 75, 28 45 Z" fill="#ffffff" />
      
      {/* Blush Cheeks */}
      <ellipse cx="34" cy="62" rx="5" ry="3" fill="#f472b6" opacity="0.5" />
      <ellipse cx="66" cy="62" rx="5" ry="3" fill="#f472b6" opacity="0.5" />

      {/* Eyes (Big Anime Style) */}
      <g className={blinking ? "animate-blink" : ""}>
        <circle cx="38" cy="54" r="6" fill="#111" />
        <circle cx="62" cy="54" r="6" fill="#111" />
        {/* Eye Highlights */}
        <circle cx="39.5" cy="52" r="2.5" fill="#fff" />
        <circle cx="36" cy="55.5" r="1" fill="#fff" />
        <circle cx="63.5" cy="52" r="2.5" fill="#fff" />
        <circle cx="60" cy="55.5" r="1" fill="#fff" />
      </g>

      {/* Cute Nose & Mouth */}
      <circle cx="50" cy="65" r="3" fill="#3ECF8E" />
      <path d="M 46 72 Q 50 78 54 72" stroke="#111" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  );

  if (!user) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Chat Window */}
      {isOpen && (
        <div className="mb-4 w-[350px] max-w-[calc(100vw-32px)] h-[480px] max-h-[calc(100vh-120px)] rounded-3xl border border-[#3ECF8E]/30 flex flex-col shadow-[0_0_50px_rgba(62,207,142,0.15)] animate-fade-in-up overflow-hidden bg-black/40 backdrop-blur-2xl">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-950/60 to-teal-950/60 border-b border-[#3ECF8E]/30 p-3.5 flex items-center justify-between backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 flex-shrink-0 drop-shadow-md">
                <GoatFace blinking />
              </div>
              <div>
                <h3 className="font-bold text-white tracking-wide flex items-center gap-2 text-sm">
                  Pyro AI <span className="px-1.5 py-0.5 rounded-md bg-[#3ECF8E]/20 text-[#3ECF8E] text-[9px] uppercase border border-[#3ECF8E]/30">Beta</span>
                </h3>
                <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_5px_#3ECF8E]" />
                  Live DB Connection
                </div>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-emerald-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-emerald-500/20">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${msg.role === 'user' ? 'bg-zinc-800 text-white rounded-br-none border border-zinc-700' : 'bg-emerald-950/40 border border-[#3ECF8E]/20 text-emerald-50 rounded-bl-none backdrop-blur-md'}`}>
                  {/* Process bold text and lists from backend */}
                  {msg.content.split('\n').map((line, i) => {
                    const formattedLine = line
                      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>')
                      .replace(/^- (.*)/g, '<span class="text-[#3ECF8E] mr-1.5">•</span><span>$1</span>');
                    return (
                      <div key={i} className={`mb-1 last:mb-0 ${line.startsWith('- ') ? 'pl-2 flex items-start' : ''}`} dangerouslySetInnerHTML={{__html: formattedLine}} />
                    );
                  })}
                </div>
                
                {/* Visualizer: If AI returned data context, show a mini chart */}
                {msg.dataContext && (
                  <div className="mt-2 w-full max-w-[95%] p-4 rounded-xl border border-[#3ECF8E]/30 bg-black/50 backdrop-blur-md shadow-lg">
                    <div className="text-[10px] text-[#3ECF8E] font-mono mb-3 text-center uppercase tracking-widest font-bold">Live Metrics Overview</div>
                    <div className="h-[100px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={[
                          { name: 'Pending', val: msg.dataContext.pendingOrders },
                          { name: 'Orders', val: msg.dataContext.totalOrders },
                          { name: 'Active Deals', val: msg.dataContext.activeDeals },
                          { name: 'Won Deals', val: msg.dataContext.wonDeals },
                        ]}>
                          <defs>
                            <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3ECF8E" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#3ECF8E" stopOpacity={0.1}/>
                            </linearGradient>
                          </defs>
                          <Tooltip contentStyle={{ background: "rgba(10,10,15,0.9)", border: "1px solid rgba(62,207,142,0.4)", borderRadius: 12, fontSize: 11, color: "#fff", backdropFilter: "blur(8px)" }} />
                          <Area type="monotone" dataKey="val" stroke="#3ECF8E" strokeWidth={2} fillOpacity={1} fill="url(#colorVal)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex items-start">
                <div className="bg-emerald-950/40 border border-[#3ECF8E]/20 rounded-2xl rounded-bl-none px-4 py-3 flex gap-1.5 backdrop-blur-md">
                  <div className="w-1.5 h-1.5 bg-[#3ECF8E] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 bg-[#3ECF8E] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 bg-[#3ECF8E] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions (More things) */}
          <div className="px-3 pt-2 pb-1 bg-black/60 border-t border-[#3ECF8E]/20 flex gap-2 overflow-x-auto scrollbar-none">
            <button onClick={() => { setInput("Scan my data"); setTimeout(sendMessage, 10); }} className="whitespace-nowrap text-[10px] bg-[#3ECF8E]/10 hover:bg-[#3ECF8E]/20 text-[#3ECF8E] border border-[#3ECF8E]/30 px-3 py-1.5 rounded-full transition-colors">
              📊 Scan Database
            </button>
            <button onClick={() => { setInput("What are my active deals?"); setTimeout(sendMessage, 10); }} className="whitespace-nowrap text-[10px] bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 px-3 py-1.5 rounded-full transition-colors">
              🤝 Active Deals
            </button>
            <button onClick={() => { setInput("Check for anomalies"); setTimeout(sendMessage, 10); }} className="whitespace-nowrap text-[10px] bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 px-3 py-1.5 rounded-full transition-colors">
              🚨 Anomalies
            </button>
          </div>

          {/* Input Area */}
          <div className="p-3 bg-black/60 backdrop-blur-xl">
            <div className="flex gap-2 relative">
              <input 
                type="text" 
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendMessage()}
                placeholder="Ask Pyro AI..."
                className="flex-1 bg-zinc-900/80 border border-zinc-700 focus:border-[#3ECF8E] focus:ring-1 focus:ring-[#3ECF8E] rounded-xl px-4 py-2.5 text-sm text-white outline-none transition-all placeholder:text-zinc-500"
              />
              <button 
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="bg-gradient-to-r from-[#24B47E] to-[#3ECF8E] hover:from-[#1E9A6A] hover:to-[#24B47E] text-white rounded-xl w-11 h-11 flex items-center justify-center disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(62,207,142,0.4)] absolute right-0 top-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Widget Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-16 h-16 rounded-full bg-gradient-to-b from-[#3ECF8E] to-[#24B47E] p-2.5 shadow-[0_0_25px_rgba(62,207,142,0.5)] hover:shadow-[0_0_35px_rgba(62,207,142,0.7)] hover:scale-105 transition-all duration-300 relative group ${isOpen ? 'scale-90 opacity-0 pointer-events-none' : 'scale-100 opacity-100'}`}
      >
        <GoatFace blinking />
        {/* Tooltip */}
        <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-emerald-950/90 border border-[#3ECF8E]/50 text-white text-xs rounded-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-md">
          Chat with Pyro AI
          <div className="absolute top-1/2 -right-1 -translate-y-1/2 border-y-4 border-y-transparent border-l-4 border-l-[#3ECF8E]/50" />
        </div>
      </button>

      <style jsx global>{`
        @keyframes blink {
          0%, 96%, 98% { transform: scaleY(1); }
          97% { transform: scaleY(0.1); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes wiggleLeft {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-5deg); }
          75% { transform: rotate(5deg); }
        }
        @keyframes wiggleRight {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(5deg); }
          75% { transform: rotate(-5deg); }
        }
        .animate-blink {
          animation: blink 5s infinite;
          transform-origin: center 54px;
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
        .animate-wiggle-left {
          animation: wiggleLeft 3s ease-in-out infinite;
        }
        .animate-wiggle-right {
          animation: wiggleRight 3s ease-in-out infinite;
          animation-delay: 0.5s;
        }
      `}</style>
    </div>
  );
}
