import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { fetchJSON, postJSON, putJSON } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Megaphone, Edit2, X, Calendar, CheckCircle2, Clock, AlertCircle, Archive } from "lucide-react";

const TYPE_META: Record<string, { label: string; color: string }> = {
  info:     { label: "Info",     color: "bg-blue-100 text-blue-700" },
  warning:  { label: "Warning",  color: "bg-yellow-100 text-yellow-700" },
  success:  { label: "Success",  color: "bg-green-100 text-green-700" },
  critical: { label: "Critical", color: "bg-red-100 text-red-700" },
  feature:  { label: "Feature",  color: "bg-primary/15 text-primary" },
  maintenance: { label: "Maintenance", color: "bg-purple-100 text-purple-700" },
};


const EMPTY = {
  title: "", body: "", type: "info", audience: "all",
  is_pinned: false, expires_at: "", link_text: "", link_url: "",
};

export default function AnnouncementsAdminPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [filterType, setFilterType] = useState("");

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["admin-announcements", filterType],
    queryFn: () => {
      const p = new URLSearchParams();
      if (filterType) p.set("type", filterType);
      return fetchJSON(`/api/admin/announcements?${p}`);
    },
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      editing
        ? putJSON(`/api/admin/announcements/${editing.id}`, form)
        : postJSON("/api/admin/announcements", form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-announcements"] });
      toast.success(editing ? "Announcement updated" : "Announcement created");
      closeModal();
    },
    onError: () => toast.error("Save failed"),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: number) => putJSON(`/api/admin/announcements/${id}`, { is_active: false }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-announcements"] });
      toast.success("Announcement archived");
    },
  });

  const pinMutation = useMutation({
    mutationFn: ({ id, pinned }: { id: number; pinned: boolean }) =>
      putJSON(`/api/admin/announcements/${id}`, { is_pinned: pinned }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-announcements"] }),
  });

  function openCreate() { setEditing(null); setForm(EMPTY); setShowModal(true); }
  function openEdit(a: any) {
    setEditing(a);
    setForm({
      title: a.title, body: a.body, type: a.type || "info",
      audience: a.audience || "all", is_pinned: a.is_pinned || false,
      expires_at: a.expires_at ? a.expires_at.slice(0, 16) : "",
      link_text: a.link_text || "", link_url: a.link_url || "",
    });
    setShowModal(true);
  }
  function closeModal() { setShowModal(false); setEditing(null); setForm(EMPTY); }

  const filtered = announcements.filter((a: any) => !filterType || a.type === filterType);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create and manage platform-wide announcements for users</p>
        </div>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-xl shadow-sm hover:opacity-90 transition-opacity bg-primary text-primary-foreground">
          <Plus className="w-4 h-4" /> New Announcement
        </motion.button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilterType("")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${!filterType ? "border-primary text-primary bg-primary/8" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
          All
        </button>
        {Object.entries(TYPE_META).map(([key, meta]) => (
          <button key={key} onClick={() => setFilterType(filterType === key ? "" : key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${filterType === key ? "border-primary text-primary bg-primary/8" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
            {meta.label}
          </button>
        ))}
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total",  value: announcements.length, icon: Megaphone, color: "text-gray-600", bg: "bg-gray-50" },
          { label: "Active", value: announcements.filter((a: any) => a.is_active !== false).length, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
          { label: "Pinned", value: announcements.filter((a: any) => a.is_pinned).length, icon: AlertCircle, color: "text-yellow-600", bg: "bg-yellow-50" },
          { label: "Expiring soon", value: announcements.filter((a: any) => a.expires_at && new Date(a.expires_at) < new Date(Date.now() + 7 * 86400000)).length, icon: Clock, color: "text-orange-600", bg: "bg-orange-50" },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4`}>
            <s.icon className={`w-4 h-4 ${s.color} mb-2`} />
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[0,1,2].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
          <Megaphone className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-500">No announcements yet</p>
          <p className="text-sm text-gray-400 mt-1">Create one to broadcast to your users.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a: any) => {
            const meta = TYPE_META[a.type] ?? TYPE_META.info;
            const isArchived = a.is_active === false;
            return (
              <motion.div key={a.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className={`bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-start gap-4 ${isArchived ? "opacity-50" : ""}`}>
                <div className={`mt-0.5 px-2 py-0.5 rounded-full text-xs font-bold shrink-0 ${meta.color}`}>{meta.label}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-gray-900 text-sm">{a.title}</p>
                    {a.is_pinned && <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 font-bold">PINNED</span>}
                    {isArchived && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-bold">ARCHIVED</span>}
                  </div>
                  <p className="text-sm text-gray-500 line-clamp-2 mb-2">{a.body}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(a.created_at).toLocaleDateString()}</span>
                    {a.expires_at && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Expires {new Date(a.expires_at).toLocaleDateString()}</span>}
                    <span>Audience: {a.audience || "all"}</span>
                    {a.link_url && <a href={a.link_url} target="_blank" rel="noopener noreferrer" className="underline text-primary">{a.link_text || "Link"}</a>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => pinMutation.mutate({ id: a.id, pinned: !a.is_pinned })}
                    className={`p-1.5 rounded-lg transition-colors ${a.is_pinned ? "text-yellow-600 bg-yellow-50" : "text-gray-400 hover:bg-gray-100"}`} title={a.is_pinned ? "Unpin" : "Pin"}>
                    <AlertCircle className="w-4 h-4" />
                  </button>
                  <button onClick={() => openEdit(a)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {!isArchived && (
                    <button onClick={() => archiveMutation.mutate(a.id)} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors" title="Archive">
                      <Archive className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={closeModal}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", bounce: 0.15 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">{editing ? "Edit Announcement" : "New Announcement"}</h2>
                <button onClick={closeModal} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Title *</label>
                  <input value={form.title} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))} required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="e.g. New feature available now" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Body *</label>
                  <textarea value={form.body} onChange={e => setForm((f: any) => ({ ...f, body: e.target.value }))} rows={4}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                    placeholder="Full announcement text..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Type</label>
                    <select value={form.type} onChange={e => setForm((f: any) => ({ ...f, type: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                      {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Audience</label>
                    <select value={form.audience} onChange={e => setForm((f: any) => ({ ...f, audience: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                      {["all", "students", "teachers", "admins", "parents"].map(a => <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Link Text</label>
                    <input value={form.link_text} onChange={e => setForm((f: any) => ({ ...f, link_text: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="e.g. Learn more" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Link URL</label>
                    <input value={form.link_url} onChange={e => setForm((f: any) => ({ ...f, link_url: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="https://..." />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Expires At (optional)</label>
                  <input type="datetime-local" value={form.expires_at} onChange={e => setForm((f: any) => ({ ...f, expires_at: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_pinned} onChange={e => setForm((f: any) => ({ ...f, is_pinned: e.target.checked }))}
                    className="rounded accent-primary" />
                  <span className="text-sm text-gray-700 font-medium">Pin to top of announcements feed</span>
                </label>
              </div>
              <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
                <button onClick={closeModal} className="px-4 py-2 rounded-xl text-sm text-gray-600 border border-gray-200 hover:bg-gray-50">Cancel</button>
                <button onClick={() => saveMutation.mutate()} disabled={!form.title || !form.body || saveMutation.isPending}
                  className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-opacity bg-primary text-primary-foreground">
                  {saveMutation.isPending ? "Saving…" : editing ? "Update" : "Create"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
