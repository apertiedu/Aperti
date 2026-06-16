import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { fetchJSON, postJSON, putJSON } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Send, Clock, CheckCircle2, Edit2, Megaphone } from "lucide-react";

const STATUS_META: Record<string, { label: string; color: string }> = {
  draft:     { label: "Draft",     color: "bg-gray-100 text-gray-600" },
  scheduled: { label: "Scheduled", color: "bg-yellow-100 text-yellow-700" },
  sent:      { label: "Sent",      color: "bg-green-100 text-green-700" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-600" },
};

const EMPTY = { name: "", type: "announcement", message: "", channels: ["dashboard"], scheduled_at: "", status: "draft" };

export default function CampaignsPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(EMPTY);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["admin-campaigns"],
    queryFn: () => fetchJSON("/api/admin/campaigns"),
  });

  const saveMutation = useMutation({
    mutationFn: () => editing ? putJSON(`/api/admin/campaigns/${editing.id}`, form) : postJSON("/api/admin/campaigns", form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-campaigns"] }); toast.success("Saved"); closeModal(); },
    onError: () => toast.error("Save failed"),
  });

  const sendMutation = useMutation({
    mutationFn: (id: number) => postJSON(`/api/admin/campaigns/${id}/send`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-campaigns"] }); toast.success("Campaign sent"); },
    onError: () => toast.error("Send failed"),
  });

  function openCreate() { setEditing(null); setForm(EMPTY); setShowModal(true); }
  function openEdit(c: any) { setEditing(c); setForm({ ...c, channels: Array.isArray(c.channels) ? c.channels : ["dashboard"], scheduled_at: c.scheduled_at ? new Date(c.scheduled_at).toISOString().slice(0, 16) : "" }); setShowModal(true); }
  function closeModal() { setShowModal(false); setEditing(null); setForm(EMPTY); }

  const CHANNEL_OPTIONS = ["dashboard", "email", "push", "landing_page"];

  function toggleChannel(ch: string) {
    const channels = form.channels || [];
    setForm({ ...form, channels: channels.includes(ch) ? channels.filter((c: string) => c !== ch) : [...channels, ch] });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notification Campaigns</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create and send targeted notifications to platform users</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-colors">
          <Plus className="w-4 h-4" /> New Campaign
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", value: campaigns.length, color: "text-gray-600" },
          { label: "Drafts", value: campaigns.filter((c: any) => c.status === "draft").length, color: "text-gray-500" },
          { label: "Scheduled", value: campaigns.filter((c: any) => c.status === "scheduled").length, color: "text-yellow-600" },
          { label: "Sent", value: campaigns.filter((c: any) => c.status === "sent").length, color: "text-green-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {isLoading && [1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse space-y-2">
            <div className="h-4 bg-gray-100 rounded w-40" />
            <div className="h-3 bg-gray-100 rounded w-64" />
          </div>
        ))}
        {!isLoading && campaigns.length === 0 && (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-100 shadow-sm">
            <Megaphone className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No campaigns yet. Create your first notification campaign.</p>
          </div>
        )}
        {campaigns.map((c: any) => {
          const meta = STATUS_META[c.status] || STATUS_META.draft;
          return (
            <motion.div key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-primary/15 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Megaphone className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-gray-900 text-sm">{c.name}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>{meta.label}</span>
                  </div>
                  {c.message && <p className="text-xs text-gray-500 line-clamp-2">{c.message}</p>}
                  <div className="flex gap-2 mt-1">
                    {(Array.isArray(c.channels) ? c.channels : []).map((ch: string) => (
                      <span key={ch} className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">{ch}</span>
                    ))}
                  </div>
                  {c.scheduled_at && (
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(c.scheduled_at).toLocaleString()}</p>
                  )}
                  {c.sent_at && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Sent {new Date(c.sent_at).toLocaleString()}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {c.status !== "sent" && (
                  <button onClick={() => sendMutation.mutate(c.id)} disabled={sendMutation.isPending} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 transition-colors disabled:opacity-50">
                    <Send className="w-3 h-3" /> Send Now
                  </button>
                )}
                <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors"><Edit2 className="w-4 h-4" /></button>
              </div>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100"><h2 className="text-lg font-bold text-gray-900">{editing ? "Edit Campaign" : "New Campaign"}</h2></div>
              <div className="px-6 py-4 space-y-4">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Campaign Name *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Message *</label>
                  <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={4} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" /></div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Delivery Channels</label>
                  <div className="flex flex-wrap gap-2">
                    {CHANNEL_OPTIONS.map((ch) => (
                      <button key={ch} onClick={() => toggleChannel(ch)} className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${(form.channels || []).includes(ch) ? "bg-primary text-primary-foreground border-primary" : "bg-white text-gray-600 border-gray-200 hover:border-primary/40"}`}>{ch}</button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                    <input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="announcement" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" /></div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Schedule (optional)</label>
                    <input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" /></div>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
                <button onClick={closeModal} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={() => saveMutation.mutate()} disabled={!form.name || !form.message || saveMutation.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
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
