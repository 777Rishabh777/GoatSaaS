"use client";

import { useState } from "react";

export default function NlToSqlTerminal() {
  const [query, setQuery] = useState("Find the emails of all enterprise users who experienced a latency_ms above 500.");
  const [sqlOutput, setSqlOutput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [tableData, setTableData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [dbError, setDbError] = useState("");

  const executeDatabaseQuery = async (sql: string) => {
    setIsExecuting(true);
    setDbError("");
    setTableData([]);
    setColumns([]);
    
    try {
      const res = await fetch("http://localhost:8000/api/v1/db/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql_query: sql }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Database execution failed");
      
      if (data.rows.length === 0) {
        setDbError("Query executed successfully, but returned 0 rows (No matches found).");
      } else {
        setColumns(data.columns);
        setTableData(data.rows);
      }
    } catch (error: any) {
      setDbError(error.message);
    } finally {
      setIsExecuting(false);
    }
  };

  const generateSQL = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setSqlOutput("");
    setTableData([]);
    setColumns([]);
    setDbError("");
    
    let fullGeneratedSql = "";

    try {
      const res = await fetch("http://localhost:8000/api/v1/ai/natural-sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          natural_query: query,
          database_schema_context: "Table 'users' (id, email, plan_type, created_at), Table 'telemetry' (id, user_id, endpoint, latency_ms, timestamp)",
        }),
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.trim() === '' || line.trim() === 'data: [DONE]') continue;
            
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6);
              try {
                const data = JSON.parse(dataStr);
                if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                  const token = data.choices[0].delta.content;
                  fullGeneratedSql += token;
                  
                  // REAL-TIME MARKDOWN STRIPPER: Instantly cleans the UI as it streams
                  const cleanDisplay = fullGeneratedSql
                    .replace(/```sql\n?/gi, "")
                    .replace(/```\n?/g, "")
                    .trimStart();
                    
                  setSqlOutput(cleanDisplay);
                }
              } catch (e) {
                if (!dataStr.startsWith('{')) {
                   fullGeneratedSql += dataStr + '\n';
                   setSqlOutput((prev) => prev + dataStr + '\n');
                }
              }
            }
          }
        }
      }
      

    } catch (error) {
      setSqlOutput("-- ERROR: Could not connect to Python AI Router.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto bg-black border border-neutral-800 rounded-xl overflow-hidden shadow-2xl">
      <div className="p-4 bg-neutral-950 border-b border-neutral-800">
        <form onSubmit={generateSQL} className="flex flex-col space-y-3">
          <label className="text-xs font-mono text-neutral-500 uppercase tracking-widest">
            Natural Language Query Intent
          </label>
          <div className="flex space-x-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors placeholder:text-neutral-600 font-mono"
            />
            <button
              type="submit"
              disabled={isGenerating || !query}
              className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {isGenerating ? "Translating..." : "Generate"}
            </button>
          </div>
        </form>
      </div>

      <div className="p-6 bg-[#0d0d0d] min-h-[150px] font-mono text-sm">
        <div className="text-xs text-neutral-600 mb-2 flex justify-between">
          <span>// GENERATED POSTGRESQL CODE</span>
          <span className="text-purple-400">TARGET: production_db</span>
        </div>
        {sqlOutput ? (
          <div>
            <pre className="text-blue-300 whitespace-pre-wrap mb-4">{sqlOutput}</pre>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => executeDatabaseQuery(sqlOutput)}
                disabled={isExecuting || isGenerating}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] border border-emerald-500/50"
              >
                {isExecuting ? "Executing..." : "Run SQL on Database"}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-neutral-700 animate-pulse mt-8 flex justify-center">
            Awaiting input sequence...
          </div>
        )}
      </div>

      {/* The Dynamic Data Table (Will now properly show database errors too!) */}
      {(columns.length > 0 || isExecuting || dbError) && (
        <div className="border-t border-neutral-800 bg-neutral-950 p-6 overflow-x-auto">
          {isExecuting && <div className="text-emerald-500 animate-pulse text-xs mb-4">EXECUTING QUERY AGAINST NEON POSTGRES...</div>}
          {dbError && <div className="text-red-500 text-xs mb-2">-- DATABASE ERROR: {dbError}</div>}
          
          {columns.length > 0 && !isExecuting && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  {columns.map(col => (
                    <th key={col} className="p-2 border-b border-neutral-800 text-xs text-neutral-500 font-mono uppercase tracking-wider">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, i) => (
                  <tr key={i} className="hover:bg-neutral-900/50 transition-colors">
                    {columns.map(col => (
                      <td key={col + i} className="p-2 border-b border-neutral-800/50 text-sm text-neutral-300 font-mono">
                        {row[col]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
