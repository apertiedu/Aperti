import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { fetchJSON, postJSON, putJSON } from "@/lib/api";
import { toast } from "sonner";
import { Plus, FileText, CheckCircle2, Clock, Shield, Zap, Megaphone, Edit2, Eye } from "lucide-react";

const TYPE_META: Record<string, { label: string; color: string; icon: any }> = {
  major:        { label: "Major",        color: "bg-purple-100 text-purple-700", icon: Zap },
  minor:        { label: "Minor",        color: "bg-blue-100 text-blue-700",     icon: FileText },
  bugfix:       { label: "Bugfix",       color: "bg-orange-100 text-orange-700", icon: FileText },
  security:     { label: "Security",     color: "bg-red-100 text-red-700",       icon: Shield },
  announcement: { label: "Announcement", color: "bg-primary/15 text-primary",     icon: Megaphone },
};

const EMPTY = { title: "", summary: "", content: "", type: "minor", version: "", status: "draft", feature_id: "" };

export default function ReleaseNotesAdminPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(EMPTY);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["admin-release-notes"],
    queryFn: () => fetchJSON("/api/admin/release-notes"),
  });

  const saveMutation = useMutation({
    mutationFn: () => editing ? putJSON(`/api/admin/release-notes/${editing.id}`, form) : postJSON("/api/admin/release-notes", form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-release-notes"] }); toast.success(editing ? "Updated" : "Created"); closeModal(); },
    onError: () => toast.error("Save failed"),
  });

  const publishMutation = useMutation({
    mutationFn: (id: number) => putJSON(`/api/admin/release-notes/${id}`, { status: "published" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-release-notes"] }); toast.success("Published"); },
  });

  function openCreate() { setEditing(null); setForm(EMPTY); setShowModal(true); }
  function openEdit(n: any) { setEditing(n); setForm({ ...n, feature_id: n.feature_id || "" }); setShowModal(true); }
  function closeModal() { setShowModal(false); setEditing(null); setForm(EMPTY); }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Release Notes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create and publish release notes and changelogs</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/80 transition-colors">
          <Plus className="w-4 h-4" /> New Release Note
        </button>
      </div>

      <div className="space-y-3">
        {isLoading && [1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse space-y-2">
            <div className="h-4 bg-gray-100 rounded w-48" />
            <div className="h-3 bg-gray-100 rounded w-72" />
          </div>
        ))}
        {!isLoading && notes.length === 0 && (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-100 shadow-sm">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No release notes yet. Create your first one.</p>
          </div>
        )}
        {notes.map((n: any) => {
          const meta = TYPE_META[n.type] || TYPE_META.minor;
          const TypeIcon = meta.icon;
          return (
            <motion.div key={n.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                  <TypeIcon className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>{meta.label}</span>
                    {n.version && <span className="text-xs text-gray-400 font-mono">v{n.version}</span>}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${n.status === "published" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{n.status}</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm">{n.title}</h3>
                  {n.summary && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.summary}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    {n.published_at ? `Published ${new Date(n.published_at).toLocaleDateString()}` : `Created ${new Date(n.created_at).toLocaleDateString()}`}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {n.status !== "published" && (
                  <button onClick={() => publishMutation.mutate(n.id)} className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors">
                    <CheckCircle2 className="w-3 h-3" /> Publish
                  </button>
                )}
                <button onClick={() => openEdit(n)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors"><Edit2 className="w-4 h-4" /></button>
              </div>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900">{editing ? "Edit Release Note" : "New Release Note"}</h2>
              </div>
              <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
                    <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Summary</label>
                    <input value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                    <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Version</label>
                    <input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="12.0.0" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="scheduled">Scheduled</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Linked Feature ID</label>
                    <input value={form.feature_id} onChange={(e) => setForm({ ...form, feature_id: e.target.value })} placeholder="Optional" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Content (Markdown)</label>
                    <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={8} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none font-mono" placeholder="## What's New&#10;&#10;- Feature A&#10;- Feature B" />
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
                <button onClick={closeModal} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={() => saveMutation.mutate()} disabled={!form.title || saveMutation.isPending} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/80 transition-colors disabled:opacity-50">
                  {saveMutation.isPending ? "Saving..." : editing ? "Update" : "Create"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
