import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { fetchJSON, postJSON, putJSON } from "@/lib/api";
import { toast } from "sonner";
import { Plus, HelpCircle, Edit2, ToggleLeft, ToggleRight, ChevronDown, ChevronUp } from "lucide-react";

const EMPTY = { question: "", answer: "", category: "", order: 0, is_published: true };
const CATEGORIES = ["Pricing", "Features", "Platform", "Security", "AI", "Support"];

export default function FAQsAdminPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: faqs = [], isLoading } = useQuery({
    queryKey: ["admin-faqs"],
    queryFn: () => fetchJSON("/api/admin/faqs"),
  });

  const saveMutation = useMutation({
    mutationFn: () => editing ? putJSON(`/api/admin/faqs/${editing.id}`, form) : postJSON("/api/admin/faqs", form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-faqs"] }); toast.success("Saved"); closeModal(); },
    onError: () => toast.error("Save failed"),
  });

  const togglePublish = useMutation({
    mutationFn: ({ id, val }: { id: number; val: boolean }) => putJSON(`/api/admin/faqs/${id}`, { is_published: val }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-faqs"] }); toast.success("Updated"); },
  });

  function openCreate() { setEditing(null); setForm(EMPTY); setShowModal(true); }
  function openEdit(f: any) { setEditing(f); setForm({ ...f }); setShowModal(true); }
  function closeModal() { setShowModal(false); setEditing(null); setForm(EMPTY); }

  const grouped = faqs.reduce((acc: Record<string, any[]>, faq: any) => {
    const cat = faq.category || "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(faq);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">FAQs</h1>
          <p className="text-sm text-gray-500 mt-0.5">{faqs.filter((f: any) => f.is_published).length} published · {faqs.length} total</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/80 transition-colors">
          <Plus className="w-4 h-4" /> Add FAQ
        </button>
      </div>

      {isLoading && [1, 2, 3, 4].map(i => (
        <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse space-y-2">
          <div className="h-4 bg-gray-100 rounded w-56" />
          <div className="h-3 bg-gray-100 rounded w-full" />
        </div>
      ))}
      {!isLoading && faqs.length === 0 && (
        <div className="bg-white rounded-xl p-12 text-center border border-gray-100 shadow-sm">
          <HelpCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No FAQs yet. Add your first FAQ.</p>
        </div>
      )}

      {Object.entries(grouped).map(([category, items]: [string, any]) => (
        <div key={category}>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{category}</h3>
          <div className="space-y-2">
            {items.map((faq: any) => (
              <div key={faq.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden ${!faq.is_published ? "opacity-60" : ""} border-gray-100`}>
                <div className="flex items-center gap-4 px-5 py-4">
                  <button onClick={() => setExpandedId(expandedId === faq.id ? null : faq.id)} className="flex-1 text-left flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-800">{faq.question}</span>
                    {expandedId === faq.id ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                  </button>
                  <div className="flex items-center gap-1">
                    <button onClick={() => togglePublish.mutate({ id: faq.id, val: !faq.is_published })} className={`transition-colors ${faq.is_published ? "text-primary" : "text-gray-300"}`}>
                      {faq.is_published ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <button onClick={() => openEdit(faq)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors"><Edit2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <AnimatePresence>
                  {expandedId === faq.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-gray-100 px-5 py-3">
                      <p className="text-sm text-gray-600">{faq.answer}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      ))}

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900">{editing ? "Edit FAQ" : "Add FAQ"}</h2>
              </div>
              <div className="px-6 py-4 space-y-4">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Question *</label><input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Answer *</label><textarea value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} rows={5} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                    <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="">Select...</option>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Order</label><input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" /></div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} className="w-4 h-4 rounded text-primary" /><span className="text-sm text-gray-700">Published on landing page</span></label>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
                <button onClick={closeModal} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={() => saveMutation.mutate()} disabled={!form.question || !form.answer || saveMutation.isPending} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/80 disabled:opacity-50">
                  {saveMutation.isPending ? "Saving..." : editing ? "Update" : "Add FAQ"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
