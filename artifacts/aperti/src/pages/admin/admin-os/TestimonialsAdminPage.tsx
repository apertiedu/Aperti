import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { fetchJSON, postJSON, putJSON, deleteJSON } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Star, CheckCircle2, XCircle, Edit2, Quote, Trash2 } from "lucide-react";

const EMPTY = { name: "", role: "", organization: "", photo_url: "", quote: "", rating: 5, is_approved: false };

export default function TestimonialsAdminPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(EMPTY);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-testimonials"],
    queryFn: () => fetchJSON("/api/admin/testimonials"),
  });

  const saveMutation = useMutation({
    mutationFn: () => editing ? putJSON(`/api/admin/testimonials/${editing.id}`, form) : postJSON("/api/admin/testimonials", form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-testimonials"] }); toast.success("Saved"); closeModal(); },
    onError: () => toast.error("Save failed"),
  });

  const toggleApprove = useMutation({
    mutationFn: ({ id, val }: { id: number; val: boolean }) => putJSON(`/api/admin/testimonials/${id}`, { is_approved: val }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-testimonials"] }); toast.success("Updated"); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteJSON(`/api/admin/testimonials/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-testimonials"] }); toast.success("Testimonial deleted"); },
    onError: () => toast.error("Delete failed"),
  });

  function openCreate() { setEditing(null); setForm(EMPTY); setShowModal(true); }
  function openEdit(t: any) { setEditing(t); setForm({ ...t }); setShowModal(true); }
  function closeModal() { setShowModal(false); setEditing(null); setForm(EMPTY); }

  const approved = items.filter((t: any) => t.is_approved).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Testimonials</h1>
          <p className="text-sm text-gray-500 mt-0.5">{approved} approved · {items.length - approved} pending review</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/80 transition-colors">
          <Plus className="w-4 h-4" /> Add Testimonial
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading && <div className="col-span-2 space-y-3 animate-pulse">{[1,2].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}</div>}
        {!isLoading && items.length === 0 && (
          <div className="col-span-2 bg-white rounded-xl p-12 text-center border border-gray-100 shadow-sm">
            <Quote className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No testimonials yet.</p>
          </div>
        )}
        {items.map((t: any) => (
          <motion.div key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`bg-white rounded-xl shadow-sm border p-5 space-y-3 ${t.is_approved ? "border-gray-100" : "border-yellow-200 bg-yellow-50/30"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {t.photo_url ? (
                  <img src={t.photo_url} alt={t.name} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-sm">
                    {t.name?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                  <p className="text-xs text-gray-500">{[t.role, t.organization].filter(Boolean).join(" · ")}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(t)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors" title="Edit"><Edit2 className="w-4 h-4" /></button>
                <button
                  onClick={() => toggleApprove.mutate({ id: t.id, val: !t.is_approved })}
                  className={`p-1.5 rounded transition-colors ${t.is_approved ? "text-green-500 hover:text-red-500" : "text-gray-400 hover:text-green-500"}`}
                  title={t.is_approved ? "Unapprove" : "Approve"}
                >
                  {t.is_approved ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => { if (confirm(`Delete testimonial from ${t.name}?`)) deleteMutation.mutate(t.id); }}
                  className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} className={`w-3.5 h-3.5 ${i < t.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-200"}`} />
              ))}
            </div>
            <p className="text-sm text-gray-700 italic line-clamp-3">"{t.quote}"</p>
            {!t.is_approved && <span className="text-xs text-yellow-600 font-medium">⚠ Pending Approval</span>}
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900">{editing ? "Edit Testimonial" : "Add Testimonial"}</h2>
              </div>
              <div className="px-6 py-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" /></div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Role</label><input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" /></div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Organization</label><input value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" /></div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Rating</label>
                    <select value={form.rating} onChange={(e) => setForm({ ...form, rating: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {[5,4,3,2,1].map(n => <option key={n} value={n}>{"⭐".repeat(n)} ({n})</option>)}
                    </select>
                  </div>
                  <div className="col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Photo URL</label><input value={form.photo_url} onChange={(e) => setForm({ ...form, photo_url: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" /></div>
                  <div className="col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Quote *</label><textarea value={form.quote} onChange={(e) => setForm({ ...form, quote: e.target.value })} rows={4} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" /></div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_approved} onChange={(e) => setForm({ ...form, is_approved: e.target.checked })} className="w-4 h-4 rounded text-primary focus:ring-primary/30" />
                  <span className="text-sm text-gray-700">Approve and show on landing page</span>
                </label>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
                <button onClick={closeModal} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={() => saveMutation.mutate()} disabled={!form.name || !form.quote || saveMutation.isPending} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/80 transition-colors disabled:opacity-50">
                  {saveMutation.isPending ? "Saving..." : editing ? "Update" : "Add"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
