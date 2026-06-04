"use client";

import { useState, useEffect } from "react";
import { Plus, FolderKanban, Server, CreditCard, Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function ProjectsPanel() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", description: "", budget: "" });
  
  // AI Agent states
  const [analyzingProject, setAnalyzingProject] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/v1/projects");
      const data = await res.json();
      if (data.projects) {
        setProjects(data.projects);
      }
    } catch (error) {
      console.error("Failed to fetch projects", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/v1/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProject.name,
          description: newProject.description,
          budget: newProject.budget ? parseFloat(newProject.budget) : null,
        }),
      });
      if (res.ok) {
        setShowCreateModal(false);
        setNewProject({ name: "", description: "", budget: "" });
        fetchProjects();
      }
    } catch (error) {
      console.error("Failed to create project", error);
    }
  };

  const analyzeProject = async (projectId: string) => {
    setAnalyzingProject(projectId);
    
    const llmProvider = localStorage.getItem("LLM_PROVIDER");
    const llmKey = localStorage.getItem("LLM_API_KEY");

    const headers: Record<string, string> = {};
    if (llmProvider) headers["X-LLM-Provider"] = llmProvider;
    if (llmKey) headers["X-LLM-Key"] = llmKey;

    try {
      const res = await fetch(`/api/v1/projects/${projectId}/ai-analysis`, {
        headers,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAnalysisResult({ projectId, analysis: data.analysis });
      } else {
        console.error("Analysis failed:", data.error);
        alert(data.error || "Analysis failed");
      }
    } catch (e) {
      console.error(e);
      alert("Network error during analysis");
    }
    setAnalyzingProject(null);
  };

  if (loading) return <div className="p-8 text-zinc-400 animate-pulse">Loading projects...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 font-sans">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <FolderKanban className="w-8 h-8 text-purple-500" />
            Project Hub
          </h2>
          <p className="text-zinc-400 mt-2">Manage API keys, SaaS subscriptions, and track AI agent costs per project.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-purple-600 hover:bg-purple-500 text-white px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-12 text-center">
          <FolderKanban className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-white mb-2">No projects yet</h3>
          <p className="text-zinc-500 max-w-sm mx-auto mb-6">Create a project to start organizing your API connections and tracking costs intelligently.</p>
          <button onClick={() => setShowCreateModal(true)} className="bg-white text-black px-6 py-2 rounded-lg font-medium">Create First Project</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map(project => (
            <div key={project.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-colors">
              <div className="p-6">
                <h3 className="text-xl font-semibold text-white mb-1">{project.name}</h3>
                <p className="text-sm text-zinc-500 line-clamp-2 min-h-[40px]">{project.description || "No description provided."}</p>
                
                <div className="mt-6 flex flex-col gap-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400 flex items-center gap-2"><CreditCard className="w-4 h-4"/> Budget</span>
                    <span className="text-white font-medium">{project.budget ? `$${project.budget.toLocaleString()}` : 'Unset'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400 flex items-center gap-2"><Server className="w-4 h-4"/> SaaS Cost</span>
                    <span className="text-white font-medium">
                      ${(project.saas?.reduce((acc: number, sub: any) => acc + (sub.amount || 0), 0) || 0).toLocaleString()}
                    </span>
                  </div>
                  
                  {project.budget && (
                    <div className="mt-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-500">Usage</span>
                        <span className={(project.saas?.reduce((acc: number, sub: any) => acc + (sub.amount || 0), 0) || 0) > project.budget ? "text-red-400" : "text-emerald-400"}>
                          {Math.round(((project.saas?.reduce((acc: number, sub: any) => acc + (sub.amount || 0), 0) || 0) / project.budget) * 100)}%
                        </span>
                      </div>
                      <div className="w-full bg-zinc-800 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${((project.saas?.reduce((acc: number, sub: any) => acc + (sub.amount || 0), 0) || 0)) > project.budget ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min((((project.saas?.reduce((acc: number, sub: any) => acc + (sub.amount || 0), 0) || 0)) / project.budget) * 100, 100)}%` }}></div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm pt-2">
                    <span className="text-zinc-400 flex items-center gap-2">Created</span>
                    <span className="text-zinc-300">{formatDistanceToNow(new Date(project.createdAt), {addSuffix: true})}</span>
                  </div>
                </div>

                {project.saas && project.saas.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-zinc-800/50">
                    <span className="text-zinc-500 text-xs uppercase tracking-wider mb-2 block">Linked Infrastructure</span>
                    <div className="flex flex-wrap gap-2">
                      {project.saas.map((sub: any) => (
                        <span key={sub.id} className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-md text-xs border border-emerald-500/20 flex items-center gap-1">
                          🔌 {sub.name} <span className="opacity-75 text-[10px]">(${sub.amount})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-6 pt-6 border-t border-zinc-800">
                  <button 
                    onClick={() => analyzeProject(project.id)}
                    disabled={analyzingProject === project.id}
                    className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {analyzingProject === project.id ? (
                      <span className="animate-pulse">Analyzing connections...</span>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        AI Cost Agent
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* AI Analysis Result Section */}
              {analysisResult && analysisResult.projectId === project.id && (
                <div className="bg-zinc-950 p-6 border-t border-zinc-800 text-sm">
                  <div className="flex items-center gap-2 mb-4">
                    {analysisResult.analysis.health_score > 70 ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-rose-500" />
                    )}
                    <span className="font-semibold text-white">Health Score: {analysisResult.analysis.health_score}/100</span>
                  </div>
                  
                  <p className="text-zinc-300 mb-4">{analysisResult.analysis.roi_analysis}</p>
                  
                  {analysisResult.analysis.cost_saving_recommendations.length > 0 && (
                    <div className="mb-4">
                      <span className="text-zinc-500 text-xs uppercase tracking-wider mb-2 block">Recommendations</span>
                      <ul className="space-y-1">
                        {analysisResult.analysis.cost_saving_recommendations.map((rec: string, i: number) => (
                          <li key={i} className="text-amber-400/90 flex items-start gap-2">
                            <span className="mt-1.5 w-1 h-1 rounded-full bg-amber-500 flex-shrink-0" />
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {analysisResult.analysis.unused_connections.length > 0 && (
                    <div>
                      <span className="text-zinc-500 text-xs uppercase tracking-wider mb-2 block">Unused Connections Detected</span>
                      <div className="flex flex-wrap gap-2">
                        {analysisResult.analysis.unused_connections.map((conn: string, i: number) => (
                          <span key={i} className="px-2 py-1 bg-rose-500/10 text-rose-400 rounded-md text-xs border border-rose-500/20">
                            {conn}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-zinc-800">
              <h3 className="text-xl font-semibold text-white">Create New Project</h3>
            </div>
            <form onSubmit={handleCreateProject} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Project Name</label>
                <input
                  type="text"
                  required
                  value={newProject.name}
                  onChange={(e) => setNewProject({...newProject, name: e.target.value})}
                  className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition-colors"
                  placeholder="e.g. Acme Backend Migration"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Description (Optional)</label>
                <textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject({...newProject, description: e.target.value})}
                  className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition-colors resize-none"
                  placeholder="What is this project for?"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Monthly Budget (Optional)</label>
                <div className="relative">
                  <span className="absolute left-4 top-2.5 text-zinc-500">$</span>
                  <input
                    type="number"
                    value={newProject.budget}
                    onChange={(e) => setNewProject({...newProject, budget: e.target.value})}
                    className="w-full bg-black border border-zinc-800 rounded-lg pl-8 pr-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition-colors"
                    placeholder="1000"
                  />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-2.5 text-zinc-400 hover:text-white font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-500 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
