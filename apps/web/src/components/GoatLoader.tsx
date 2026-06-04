"use client";

import React from 'react';

export default function GoatLoader({ message = "Loading GOATSaaS..." }: { message?: string }) {
  return (
    <div className="fixed inset-0 bg-zinc-950 flex flex-col items-center justify-center z-[9999] font-sans">
      <div className="relative flex flex-col items-center">
        <div className="w-16 h-16 mb-6 animate-bounce" style={{ animationDuration: '0.8s' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full drop-shadow-[0_0_15px_rgba(16,185,129,0.4)]">
            <path d="M4 8c2-5 6-7 8-7s6 2 8 7" />
            <path d="M6 10l6 12 6-12" />
            <path d="M6 10c-2 0-3 1.5-3 3 0 1 1.5 1.5 1.5 1.5" />
            <path d="M18 10c2 0 3 1.5 3 3 0 1-1.5 1.5-1.5 1.5" />
            <path d="M10 13l2 3 2-3" fill="#10b981" stroke="none" />
          </svg>
        </div>
        
        {/* Loading Text */}
        <h2 className="text-white text-lg font-bold tracking-tight mb-4 animate-pulse">{message}</h2>
        
        {/* Loading Line Progress Bar */}
        <div className="w-48 h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-purple-500 via-emerald-400 to-purple-500 rounded-full animate-[loadingLine_1.5s_ease-in-out_infinite] w-full origin-left" />
        </div>
      </div>

      <style jsx global>{`
        @keyframes loadingLine {
          0% { transform: scaleX(0.1) translateX(-100%); opacity: 0.5; }
          50% { transform: scaleX(0.5) translateX(0%); opacity: 1; }
          100% { transform: scaleX(0.1) translateX(1000%); opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
