"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";

interface RagDocument {
  id: number;
  name: string;
  file_type: string;
  chunks_count: number;
  created_at: string;
}

interface RagChunk {
  id: number;
  content: string;
  doc_name: string;
  embedding?: number[] | null;
}

interface RagStats {
  documents: number;
  total_chunks: number;
  last_indexed: string | null;
}

interface UploadingFile {
  name: string;
  status: "indexing" | "done" | "error";
  chunks?: number;
}

const API = "http://localhost:8000";

export default function KnowledgeBasePanel() {
  const { user } = useAuth();
  const orgId = user?.orgName || "default_org";

  const [stats, setStats] = useState<RagStats>({ documents: 0, total_chunks: 0, last_indexed: null });
  const [documents, setDocuments] = useState<RagDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<RagChunk[]>([]);
  const [searching, setSearching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const headers = { "X-Org-Id": orgId };

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/rag/stats`, { headers });
      const data = await res.json();
      setStats(data);
    } catch {}
  }, [orgId]);

  const fetchDocuments = useCallback(async () => {
    setDocsLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/rag/documents`, { headers });
      const data = await res.json();
      setDocuments(Array.isArray(data) ? data : []);
    } catch {
      setDocuments([]);
    }
    setDocsLoading(false);
  }, [orgId]);

  useEffect(() => {
    fetchStats();
    fetchDocuments();
  }, [fetchStats, fetchDocuments]);

  const uploadFiles = async (files: File[]) => {
    const validFiles = files.filter(f =>
      ["pdf", "txt", "md", "csv"].includes(f.name.split(".").pop()?.toLowerCase() || "")
    );
    if (!validFiles.length) return;

    const newUploads: UploadingFile[] = validFiles.map(f => ({ name: f.name, status: "indexing" }));
    setUploadingFiles(prev => [...prev, ...newUploads]);

    for (const file of validFiles) {
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch(`${API}/api/v1/rag/upload`, {
          method: "POST",
          headers,
          body: fd,
        });
        const data = await res.json();
        setUploadingFiles(prev =>
          prev.map(u => u.name === file.name
            ? { ...u, status: res.ok ? "done" : "error", chunks: data.chunks_count }
            : u
          )
        );
        if (res.ok) {
          await fetchStats();
          await fetchDocuments();
        }
      } catch {
        setUploadingFiles(prev =>
          prev.map(u => u.name === file.name ? { ...u, status: "error" } : u)
        );
      }
    }

    // Auto-clear done items after 4 seconds
    setTimeout(() => {
      setUploadingFiles(prev => prev.filter(u => u.status === "indexing"));
    }, 4000);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    uploadFiles(files);
  };

  const handleDelete = async (docId: number) => {
    setDeletingId(docId);
    try {
      await fetch(`${API}/api/v1/rag/documents/${docId}`, { method: "DELETE", headers });
      await fetchStats();
      await fetchDocuments();
    } catch {}
    setDeletingId(null);
  };

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`${API}/api/v1/rag/query?q=${encodeURIComponent(q)}`, { headers });
        const data = await res.json();
        setSearchResults(Array.isArray(data) ? data : []);
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 400);
  };

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
    catch { return iso; }
  };

  const fileTypeColor: Record<string, string> = {
    pdf: "bg-red-500/10 text-red-400 border-red-500/20",
    txt: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    md: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    csv: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  };

  return (
    <div className="space-y-6 fade-in-up font-sans">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Knowledge Base 🧠</h1>
        <p className="text-[var(--text-secondary)] text-sm mt-1">
          Upload documents to ground AI responses with your private organizational knowledge.
        </p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="glass rounded-2xl p-5 border border-purple-500/20 bg-purple-500/5 flex flex-col gap-1">
          <div className="text-xs text-[var(--text-muted)] font-mono uppercase tracking-wider">Total Documents</div>
          <div className="text-3xl font-bold text-[var(--text-primary)]">{stats.documents}</div>
          <div className="text-xs text-purple-400">Indexed files</div>
        </div>
        <div className="glass rounded-2xl p-5 border border-blue-500/20 bg-blue-500/5 flex flex-col gap-1">
          <div className="text-xs text-[var(--text-muted)] font-mono uppercase tracking-wider">Total Chunks</div>
          <div className="text-3xl font-bold text-[var(--text-primary)]">{stats.total_chunks.toLocaleString()}</div>
          <div className="text-xs text-blue-400">Searchable segments</div>
        </div>
        <div className="col-span-2 sm:col-span-1 glass rounded-2xl p-5 border border-emerald-500/20 bg-emerald-500/5 flex flex-col gap-1">
          <div className="text-xs text-[var(--text-muted)] font-mono uppercase tracking-wider">Last Indexed</div>
          <div className="text-lg font-bold text-[var(--text-primary)] truncate">
            {stats.last_indexed ? formatDate(stats.last_indexed) : "—"}
          </div>
          <div className="text-xs text-emerald-400">Most recent upload</div>
        </div>
      </div>

      {/* Drag-and-Drop Upload Zone */}
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer
          flex flex-col items-center justify-center gap-3 py-12 px-6
          ${isDragging
            ? "border-purple-500 bg-purple-500/10 shadow-[0_0_40px_rgba(139,92,246,0.2)]"
            : "border-[var(--border)] hover:border-purple-500/50 hover:bg-purple-500/5"
          }
        `}
        id="kb-upload-zone"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md,.csv"
          multiple
          className="hidden"
          onChange={e => uploadFiles(Array.from(e.target.files || []))}
        />
        <div className={`text-5xl transition-transform duration-300 ${isDragging ? "scale-125" : ""}`}>
          {isDragging ? "📂" : "📁"}
        </div>
        <div className="text-center">
          <div className="text-sm font-semibold text-[var(--text-primary)]">
            {isDragging ? "Drop to start indexing…" : "Drag & drop files here"}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            or click to browse · Supports PDF, TXT, MD, CSV
          </div>
        </div>
        {isDragging && (
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              background: "radial-gradient(ellipse at center, rgba(139,92,246,0.15) 0%, transparent 70%)",
            }}
          />
        )}
      </div>

      {/* Active Upload Progress */}
      {uploadingFiles.length > 0 && (
        <div className="glass rounded-2xl border border-[var(--border)] p-4 space-y-2">
          <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
            Upload Queue
          </div>
          {uploadingFiles.map((uf, i) => (
            <div key={i} className="flex items-center justify-between py-2 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
              <div className="flex items-center gap-3">
                <span className="text-lg">
                  {uf.status === "indexing" ? "⏳" : uf.status === "done" ? "✅" : "❌"}
                </span>
                <span className="text-sm text-[var(--text-primary)] font-medium truncate max-w-xs">{uf.name}</span>
              </div>
              <div className="flex-shrink-0">
                {uf.status === "indexing" && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 pulse-dot inline-block" />
                    Indexing…
                  </span>
                )}
                {uf.status === "done" && (
                  <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {uf.chunks} chunks indexed
                  </span>
                )}
                {uf.status === "error" && (
                  <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                    Upload failed
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Semantic Search Bar */}
      <div className="glass rounded-2xl border border-[var(--border)] p-4 space-y-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm">🔍</span>
            <input
              id="kb-search-input"
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              className="input-dark w-full rounded-xl pl-9 pr-4 py-2.5 text-sm"
              placeholder="Semantic search across your knowledge base…"
            />
            {searching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)] animate-pulse">
                Searching…
              </span>
            )}
          </div>
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(""); setSearchResults([]); }}
              className="btn-ghost px-3 py-2.5 rounded-xl text-sm border border-[var(--border)]"
            >
              ✕ Clear
            </button>
          )}
        </div>

        {searchResults.length > 0 && (
          <div className="space-y-3">
            <div className="text-xs text-[var(--text-muted)] font-mono">
              {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for &ldquo;{searchQuery}&rdquo;
            </div>
            {searchResults.map((chunk, i) => (
              <div
                key={chunk.id}
                className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] transition-all space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-semibold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">
                    #{i + 1} · {chunk.doc_name}
                  </span>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">chunk #{chunk.id}</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-4">
                  {chunk.content}
                </p>
              </div>
            ))}
          </div>
        )}

        {searchQuery && !searching && searchResults.length === 0 && (
          <div className="py-6 text-center text-xs text-[var(--text-muted)]">
            No matching chunks found for &ldquo;{searchQuery}&rdquo;
          </div>
        )}
      </div>

      {/* Documents Table */}
      <div className="glass rounded-2xl border border-[var(--border)] overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Ingested Documents</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {documents.length} document{documents.length !== 1 ? "s" : ""} in your knowledge base
            </p>
          </div>
          <button
            onClick={fetchDocuments}
            className="btn-ghost px-3 py-1.5 rounded-lg text-xs border border-[var(--border)] flex items-center gap-1.5"
          >
            🔄 Refresh
          </button>
        </div>

        {docsLoading ? (
          <div className="p-12 text-center">
            <div className="text-[var(--text-muted)] text-sm animate-pulse">Loading documents…</div>
          </div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <div className="text-4xl opacity-40">🧠</div>
            <div className="text-sm text-[var(--text-muted)]">No documents indexed yet.</div>
            <div className="text-xs text-[var(--text-muted)]">Drag and drop files above to get started.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider px-5 py-3">Document</th>
                  <th className="text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider px-5 py-3">Type</th>
                  <th className="text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider px-5 py-3">Chunks</th>
                  <th className="text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider px-5 py-3">Indexed</th>
                  <th className="text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {documents.map(doc => (
                  <tr key={doc.id} className="table-row-hover">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="text-lg opacity-80">
                          {doc.file_type === "pdf" ? "📄" : doc.file_type === "csv" ? "📊" : doc.file_type === "md" ? "📝" : "📃"}
                        </span>
                        <span className="text-[var(--text-primary)] font-medium truncate max-w-xs" title={doc.name}>
                          {doc.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border uppercase ${fileTypeColor[doc.file_type] || "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>
                        {doc.file_type}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm font-mono text-[var(--text-primary)]">
                        {doc.chunks_count.toLocaleString()}
                      </span>
                      <span className="text-xs text-[var(--text-muted)] ml-1">chunks</span>
                    </td>
                    <td className="px-5 py-4 text-xs text-[var(--text-muted)] font-mono">
                      {formatDate(doc.created_at)}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => handleDelete(doc.id)}
                        disabled={deletingId === doc.id}
                        className="text-xs border border-red-500/20 bg-red-500/5 hover:bg-red-500/15 text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete document"
                      >
                        {deletingId === doc.id ? "Deleting…" : "🗑 Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Usage Tips */}
      <div className="glass rounded-2xl border border-[var(--border)] p-5">
        <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
          💡 How It Works
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: "📁", title: "Upload", desc: "Drag PDFs, TXT, Markdown, or CSV files. Content is extracted and chunked automatically." },
            { icon: "🔍", title: "Search", desc: "Use the semantic search bar to find relevant passages across all indexed documents." },
            { icon: "🤖", title: "AI Grounding", desc: "Enable \"Use Knowledge Base RAG\" in the AI Analyst tab to ground responses with your docs." },
          ].map((tip, i) => (
            <div key={i} className="flex gap-3">
              <span className="text-xl flex-shrink-0">{tip.icon}</span>
              <div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">{tip.title}</div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{tip.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
