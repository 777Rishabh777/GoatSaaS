"use client";

import { useState } from "react";

export default function AiTerminal() {
  const [output, setOutput] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const runDiagnostic = async () => {
    setIsAnalyzing(true);
    setOutput("");

    try {
      // Hitting your Python Microservice running on Port 8000
      const res = await fetch("http://localhost:8000/api/v1/ai/diagnostic-explain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          metric_name: "Database Throughput",
          current_value: 450,
          previous_value: 1200,
          date_range: "Last 15 Minutes",
          context_logs: "ERR [PgPool]: Connections exhausted. WARN [Redis]: Cache miss rate spiked to 84%.",
        }),
      });

      if (!res.body) throw new Error("No response body");

      // Reading the live stream from Python
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          
          // Split the chunk by lines to handle multiple SSE events
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            // Ignore empty lines and the [DONE] signal
            if (line.trim() === '' || line.trim() === 'data: [DONE]') continue;
            
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6);
              
              try {
                // Safely extract just the text token from Groq's JSON
                const data = JSON.parse(dataStr);
                if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                  setOutput((prev) => prev + data.choices[0].delta.content);
                }
              } catch (e) {
                // Fallback for non-JSON text (like our custom error messages)
                if (!dataStr.startsWith('{')) {
                   setOutput((prev) => prev + dataStr + '\n');
                }
              }
            }
          }
        }
      }
    } catch (error) {
      setOutput(">> CONNECTION FAILED: Make sure the Python AI microservice is running on port 8000.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="relative aspect-video bg-neutral-900 border border-neutral-800 rounded-xl p-6 flex flex-col shadow-2xl overflow-hidden w-full h-80">
      {/* Terminal Header */}
      <div className="flex justify-between items-center mb-4 border-b border-neutral-800 pb-4">
        <div className="flex space-x-2">
          <div className="w-3 h-3 rounded-full bg-red-500/50" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
          <div className="w-3 h-3 rounded-full bg-green-500/50" />
        </div>
        <button
          onClick={runDiagnostic}
          disabled={isAnalyzing}
          className="text-xs font-mono bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded transition-colors disabled:opacity-50"
        >
          {isAnalyzing ? "ANALYZING..." : "RUN ROOT CAUSE DIAGNOSTIC"}
        </button>
      </div>

      {/* Terminal Output Screen */}
      <div className="flex-1 overflow-y-auto font-mono text-xs md:text-sm text-neutral-400 space-y-2 leading-relaxed">
        {output ? (
          <div className="whitespace-pre-wrap text-emerald-300">{output}</div>
        ) : (
          <>
            <p className="text-neutral-500">{`> INGEST_PIPE: Active [Neon PostgreSQL Engine]`}</p>
            <p className="text-neutral-500">{`> VECTOR_INDEX: Synced [Qdrant Native Cluster]`}</p>
            <p className="animate-pulse text-white mt-4">{`> WAITING FOR COGNITIVE INFERENCE QUERY...`}</p>
          </>
        )}
      </div>
    </div>
  );
}