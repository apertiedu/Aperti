import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Edit2, Trash2, Library, ChevronDown, ChevronUp } from "lucide-react";
import { fetchJSON, postJSON, putJSON } from "@/lib/api";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const CATEGORIES = ["general", "billing", "technical", "academic", "account", "privacy", "features"];

function ArticleCard({ article, onEdit, onDelete }: any) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-700 flex-shrink-0`}>{article.category}</span>
          <p className="font-medium text-gray-900 truncate">{article.title}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-gray-400">{new Date(article.updatedAt).toLocaleDateString()}</span>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-gray-100">
              <p className="text-sm text-gray-700 mt-3 whitespace-pre-wrap">{article.content}</p>
              <div className="flex gap-2 mt-4">
                <button onClick={() => onEdit(article)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <Edit2 className="w-3 h-3" /> Edit
                </button>
                <button onClick={() => onDelete(article.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function KBPage() {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", category: "general", language: "en" });
  const qc = useQueryClient();

  const { data: articles } = useQuery({
    queryKey: ["kb-articles", search],
    queryFn: () => fetchJSON(`/api/admin/kb?search=${search}`),
  });

  const saveMutation = useMutation({
    mutationFn: () => editing
      ? putJSON(`/api/admin/kb/${editing.id}`, form)
      : postJSON("/api/admin/kb", form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["kb-articles"] }); toast.success("Article saved"); setShowModal(false); setEditing(null); setForm({ title: "", content: "", category: "general", language: "en" }); },
    onError: () => toast.error("Save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin/kb/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${localStorage.getItem("aperti_token")}` } }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["kb-articles"] }); toast.success("Article deleted"); },
    onError: () => toast.error("Delete failed"),
  });

  const openEdit = (article: any) => {
    setEditing(article);
    setForm({ title: article.title, content: article.content, category: article.category, language: article.language });
    setShowModal(true);
  };

  const articleList: any[] = (articles as any[]) || [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
          <p className="text-sm text-gray-500">{articleList.length} articles</p>
        </div>
        <button onClick={() => { setEditing(null); setForm({ title: "", content: "", category: "general", language: "en" }); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors">
          <Plus className="w-4 h-4" /> New Article
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search articles…" className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400 bg-white" />
      </div>

      {articleList.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <Library className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No articles yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {articleList.map((a: any) => (
            <ArticleCard key={a.id} article={a} onEdit={openEdit} onDelete={(id: number) => { if (confirm("Delete this article?")) deleteMutation.mutate(id); }} />
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-5">{editing ? "Edit" : "New"} Article</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
                <input value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select value={form.category} onChange={(e) => setForm(p => ({ ...p, category: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400">
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                  <select value={form.language} onChange={(e) => setForm(p => ({ ...p, language: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400">
                    <option value="en">English</option>
                    <option value="ar">Arabic</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content <span className="text-red-500">*</span></label>
                <textarea value={form.content} onChange={(e) => setForm(p => ({ ...p, content: e.target.value }))} rows={10} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400 font-mono text-xs" placeholder="Article content (Markdown supported)…" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowModal(false); setEditing(null); }} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700">Cancel</button>
              <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="flex-1 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
                {saveMutation.isPending ? "Saving…" : "Save Article"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
