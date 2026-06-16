import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { fetchJSON, postJSON, putJSON } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Map, Edit2, ChevronUp, ChevronDown } from "lucide-react";

const STATUS_COLS = [
  { key: "planned",    label: "Planned",    color: "bg-gray-100 text-gray-600" },
  { key: "researching",label: "Researching",color: "bg-blue-100 text-blue-700" },
  { key: "designing",  label: "Designing",  color: "bg-purple-100 text-purple-700" },
  { key: "building",   label: "Building",   color: "bg-yellow-100 text-yellow-700" },
  { key: "testing",    label: "Testing",    color: "bg-orange-100 text-orange-700" },
  { key: "beta",       label: "Beta",       color: "bg-indigo-100 text-indigo-700" },
  { key: "released",   label: "Released",   color: "bg-green-100 text-green-700" },
];

const EMPTY = { title: "", description: "", category: "", status: "planned", target_date: "", order: 0 };

export default function RoadmapAdminPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(EMPTY);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-roadmap"],
    queryFn: () => fetchJSON("/api/admin/roadmap"),
  });

  const saveMutation = useMutation({
    mutationFn: () => editing ? putJSON(`/api/admin/roadmap/${editing.id}`, form) : postJSON("/api/admin/roadmap", form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-roadmap"] }); toast.success(editing ? "Updated" : "Created"); closeModal(); },
    onError: () => toast.error("Save failed"),
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => putJSON(`/api/admin/roadmap/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-roadmap"] }),
  });

  function openCreate() { setEditing(null); setForm(EMPTY); setShowModal(true); }
  function openEdit(item: any) { setEditing(item); setForm({ ...item }); setShowModal(true); }
  function closeModal() { setShowModal(false); setEditing(null); setForm(EMPTY); }

  const byStatus = STATUS_COLS.reduce<Record<string, any[]>>((acc, col) => {
    acc[col.key] = items.filter((i: any) => i.status === col.key);
    return acc;
  }, {});

  const CATEGORIES = ["AI", "Mobile", "Integration", "Content", "Engagement", "Student", "Analytics", "Infrastructure", "Localization"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roadmap</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage the public product roadmap</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setView("kanban")} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === "kanban" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>Kanban</button>
            <button onClick={() => setView("list")} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === "list" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>List</button>
          </div>
          <button onClick={openCreate} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/80 transition-colors">
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center text-gray-400 py-12">Loading roadmap...</div>
      ) : view === "kanban" ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STATUS_COLS.map((col) => (
            <div key={col.key} className="flex-shrink-0 w-52">
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${col.color}`}>{col.label}</span>
                <span className="text-xs text-gray-400">{byStatus[col.key]?.length || 0}</span>
              </div>
              <div className="space-y-2">
                {(byStatus[col.key] || []).map((item: any) => (
                  <motion.div key={item.id} layout className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
                    <p className="text-sm font-medium text-gray-800 mb-1 line-clamp-2">{item.title}</p>
                    {item.category && <span className="text-xs text-gray-400">{item.category}</span>}
                    {item.target_date && (
                      <p className="text-xs text-gray-400 mt-1">{new Date(item.target_date).toLocaleDateString()}</p>
                    )}
                    <div className="flex gap-1 mt-2">
                      <button onClick={() => openEdit(item)} className="p-1 text-gray-300 hover:text-blue-500 transition-colors"><Edit2 className="w-3 h-3" /></button>
                      {STATUS_COLS.findIndex(c => c.key === item.status) > 0 && (
                        <button onClick={() => moveMutation.mutate({ id: item.id, status: STATUS_COLS[STATUS_COLS.findIndex(c => c.key === item.status) - 1].key })} className="p-1 text-gray-300 hover:text-gray-600 transition-colors"><ChevronUp className="w-3 h-3" /></button>
                      )}
                      {STATUS_COLS.findIndex(c => c.key === item.status) < STATUS_COLS.length - 1 && (
                        <button onClick={() => moveMutation.mutate({ id: item.id, status: STATUS_COLS[STATUS_COLS.findIndex(c => c.key === item.status) + 1].key })} className="p-1 text-gray-300 hover:text-gray-600 transition-colors"><ChevronDown className="w-3 h-3" /></button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {items.length === 0 ? (
            <div className="p-12 text-center">
              <Map className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No roadmap items. Add your first item.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Target Date</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((item: any) => {
                  const col = STATUS_COLS.find(c => c.key === item.status);
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{item.title}</td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{item.category || "—"}</td>
                      <td className="px-4 py-3">
                        {col && <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${col.color}`}>{col.label}</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{item.target_date ? new Date(item.target_date).toLocaleDateString() : "—"}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => openEdit(item)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors"><Edit2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900">{editing ? "Edit Roadmap Item" : "New Roadmap Item"}</h2>
              </div>
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
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
                      {STATUS_COLS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Target Date</label>
                    <input type="date" value={form.target_date || ""} onChange={(e) => setForm({ ...form, target_date: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Order</label>
                    <input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
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
