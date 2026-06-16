import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { fetchJSON, postJSON, putJSON, deleteJSON } from "@/lib/api";
import { toast } from "sonner";
import {
  Plus, Search, Rocket, Clock, TestTube, AlertCircle, CheckCircle2,
  XCircle, Archive, Edit2, Calendar, Link2, Package, RefreshCw, Trash2,
  GitBranch, BarChart3, Users,
} from "lucide-react";

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  draft:       { label: "Draft",       color: "bg-gray-100 text-gray-600",   icon: Edit2 },
  internal:    { label: "Internal",    color: "bg-purple-100 text-purple-700",icon: Package },
  development: { label: "Dev",         color: "bg-blue-100 text-blue-700",   icon: RefreshCw },
  testing:     { label: "Testing",     color: "bg-yellow-100 text-yellow-700",icon: TestTube },
  beta:        { label: "Beta",        color: "bg-orange-100 text-orange-700",icon: AlertCircle },
  coming_soon: { label: "Coming Soon", color: "bg-primary/15 text-primary",   icon: Clock },
  scheduled:   { label: "Scheduled",  color: "bg-indigo-100 text-indigo-700",icon: Calendar },
  released:    { label: "Released",   color: "bg-green-100 text-green-700",  icon: CheckCircle2 },
  deprecated:  { label: "Deprecated", color: "bg-red-100 text-red-700",     icon: XCircle },
  archived:    { label: "Archived",   color: "bg-gray-100 text-gray-400",   icon: Archive },
  disabled:    { label: "Disabled",   color: "bg-gray-100 text-gray-400",   icon: XCircle },
};

const STATUSES = Object.keys(STATUS_META);
const CATEGORIES = ["AI", "Classroom", "Student", "Productivity", "Analytics", "Social", "Enterprise", "Parent", "Content", "Infrastructure"];

const EMPTY_FORM = { name: "", description: "", category: "", owner: "", status: "draft", release_date: "", documentation_url: "", version: "", dependencies: "" };

export default function FeatureRegistryPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [scheduleModal, setScheduleModal] = useState<any>(null);
  const [scheduleDate, setScheduleDate] = useState("");

  const { data: features = [], isLoading } = useQuery({
    queryKey: ["admin-features", search, filterStatus],
    queryFn: () => {
      const p = new URLSearchParams();
      if (search) p.set("search", search);
      if (filterStatus) p.set("status", filterStatus);
      return fetchJSON(`/api/admin/features?${p}`);
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = { ...form, dependencies: form.dependencies ? form.dependencies.split(",").map(Number).filter(Boolean) : [] };
      return editing ? putJSON(`/api/admin/features/${editing.id}`, payload) : postJSON("/api/admin/features", payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-features"] }); toast.success(editing ? "Feature updated" : "Feature created"); closeModal(); },
    onError: () => toast.error("Save failed"),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: number) => deleteJSON(`/api/admin/features/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-features"] }); toast.success("Feature archived"); },
  });

  const scheduleMutation = useMutation({
    mutationFn: ({ id, date }: { id: number; date: string }) => postJSON(`/api/admin/features/${id}/schedule`, { release_date: date }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-features"] }); toast.success("Launch scheduled"); setScheduleModal(null); },
    onError: () => toast.error("Schedule failed"),
  });

  function openCreate() { setEditing(null); setForm(EMPTY_FORM); setShowModal(true); }
  function openEdit(f: any) { setEditing(f); setForm({ ...f, dependencies: (f.dependencies || []).join(", ") }); setShowModal(true); }
  function closeModal() { setShowModal(false); setEditing(null); setForm(EMPTY_FORM); }

  const stats = {
    total: features.length,
    released: features.filter((f: any) => f.status === "released").length,
    beta: features.filter((f: any) => f.status === "beta").length,
    coming: features.filter((f: any) => ["coming_soon", "scheduled"].includes(f.status)).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feature Registry</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage platform features, launch schedules, and visibility</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/80 transition-colors">
          <Plus className="w-4 h-4" /> New Feature
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Features", value: stats.total, icon: Package, color: "text-gray-600" },
          { label: "Released", value: stats.released, icon: CheckCircle2, color: "text-green-600" },
          { label: "In Beta", value: stats.beta, icon: TestTube, color: "text-orange-600" },
          { label: "Coming Soon", value: stats.coming, icon: Clock, color: "text-primary" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <s.icon className={`w-5 h-5 ${s.color} mb-2`} />
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search features..." className="pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 w-56" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400">Loading features...</div>
        ) : features.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No features found. Create your first feature to get started.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Feature</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Version</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Waitlist</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Release Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {features.map((f: any) => {
                const meta = STATUS_META[f.status] || STATUS_META.draft;
                const StatusIcon = meta.icon;
                return (
                  <motion.tr key={f.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{f.name}</div>
                      {f.description && <div className="text-xs text-gray-400 truncate max-w-xs">{f.description}</div>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {f.category && <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">{f.category}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
                        <StatusIcon className="w-3 h-3" /> {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{f.version || "—"}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="flex items-center gap-1 text-gray-600"><Users className="w-3 h-3" /> {f.waitlist_count || 0}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">
                      {f.release_date ? new Date(f.release_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setScheduleModal(f)} title="Schedule launch" className="p-1.5 text-gray-400 hover:text-primary rounded transition-colors"><Calendar className="w-4 h-4" /></button>
                        <button onClick={() => openEdit(f)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => archiveMutation.mutate(f.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900">{editing ? "Edit Feature" : "New Feature"}</h2>
              </div>
              <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Feature Name *</label>
                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                    <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                    <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="">Select...</option>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Version</label>
                    <input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="1.0.0" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Owner</label>
                    <input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Release Date</label>
                    <input type="datetime-local" value={form.release_date || ""} onChange={(e) => setForm({ ...form, release_date: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Documentation URL</label>
                    <input value={form.documentation_url} onChange={(e) => setForm({ ...form, documentation_url: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Dependency Feature IDs (comma-separated)</label>
                    <input value={form.dependencies} onChange={(e) => setForm({ ...form, dependencies: e.target.value })} placeholder="1, 3, 7" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
                <button onClick={closeModal} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/80 transition-colors disabled:opacity-50">
                  {saveMutation.isPending ? "Saving..." : editing ? "Update Feature" : "Create Feature"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Schedule Modal */}
      <AnimatePresence>
        {scheduleModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary/15 rounded-full flex items-center justify-center">
                  <Rocket className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Schedule Launch</h3>
                  <p className="text-xs text-gray-500">{scheduleModal.name}</p>
                </div>
              </div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Launch Date & Time</label>
              <input type="datetime-local" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 mb-4" />
              <div className="flex gap-3">
                <button onClick={() => setScheduleModal(null)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={() => scheduleMutation.mutate({ id: scheduleModal.id, date: scheduleDate })} disabled={!scheduleDate || scheduleMutation.isPending} className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/80 transition-colors disabled:opacity-50">
                  {scheduleMutation.isPending ? "Scheduling..." : "Schedule"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
