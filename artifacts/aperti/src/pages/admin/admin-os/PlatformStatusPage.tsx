import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fetchJSON, postJSON } from "@/lib/api";
import { toast } from "sonner";
import { Activity, CheckCircle2, AlertTriangle, XCircle, Wrench, Plus } from "lucide-react";

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  operational: { label: "Operational",  color: "text-green-700",  bg: "bg-green-100",  icon: CheckCircle2 },
  degraded:    { label: "Degraded",     color: "text-yellow-700", bg: "bg-yellow-100", icon: AlertTriangle },
  maintenance: { label: "Maintenance",  color: "text-blue-700",   bg: "bg-blue-100",   icon: Wrench },
  incident:    { label: "Incident",     color: "text-red-700",    bg: "bg-red-100",    icon: XCircle },
  resolved:    { label: "Resolved",     color: "text-gray-700",   bg: "bg-gray-100",   icon: CheckCircle2 },
};

const STATUSES = Object.keys(STATUS_META);

export default function PlatformStatusPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ status: "operational", message: "" });

  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-platform-status"],
    queryFn: () => fetchJSON("/api/admin/platform-status"),
    refetchInterval: 15000,
  });

  const createMutation = useMutation({
    mutationFn: () => postJSON("/api/admin/platform-status", form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-platform-status"] }); toast.success("Status updated"); setShowModal(false); setForm({ status: "operational", message: "" }); },
    onError: () => toast.error("Failed to update"),
  });

  const current: any = Array.isArray(data) ? data[0] : null;
  const history: any[] = Array.isArray(data) ? data.slice(1) : [];
  const currentMeta = STATUS_META[current?.status || "operational"];
  const CurrentIcon = currentMeta?.icon || CheckCircle2;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Status</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage and communicate platform operational status</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors">
          <Plus className="w-4 h-4" /> Update Status
        </button>
      </div>

      {/* Current Status Card */}
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className={`rounded-2xl p-8 border ${current?.status === "operational" ? "bg-green-50 border-green-200" : current?.status === "incident" ? "bg-red-50 border-red-200" : "bg-yellow-50 border-yellow-200"}`}>
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl ${currentMeta?.bg} flex items-center justify-center`}>
            <CurrentIcon className={`w-7 h-7 ${currentMeta?.color}`} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${current?.status === "operational" ? "bg-green-500" : current?.status === "incident" ? "bg-red-500" : "bg-yellow-500"}`} />
              <span className={`text-lg font-bold ${currentMeta?.color}`}>{currentMeta?.label}</span>
            </div>
            <p className="text-gray-700">{current?.message || "All systems are running normally."}</p>
            {current?.created_at && (
              <p className="text-sm text-gray-400 mt-1">Since {new Date(current.created_at).toLocaleString()}</p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Status History */}
      {history.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-gray-500" />
            <h3 className="font-semibold text-gray-800 text-sm">Status History</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {history.map((entry: any) => {
              const meta = STATUS_META[entry.status] || STATUS_META.operational;
              const EntryIcon = meta.icon;
              return (
                <div key={entry.id} className="flex items-start gap-4 px-5 py-3">
                  <div className={`w-7 h-7 rounded-lg ${meta.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <EntryIcon className={`w-3.5 h-3.5 ${meta.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
                    {entry.message && <p className="text-sm text-gray-700 mt-0.5">{entry.message}</p>}
                  </div>
                  <p className="text-xs text-gray-400 flex-shrink-0">{new Date(entry.created_at).toLocaleString()}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Update Modal */}
      {showModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-bold text-gray-900 text-lg mb-4">Update Platform Status</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {STATUSES.map((s) => {
                    const meta = STATUS_META[s];
                    const Icon = meta.icon;
                    return (
                      <button key={s} onClick={() => setForm({ ...form, status: s })} className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border transition-all text-xs font-medium ${form.status === s ? `${meta.bg} ${meta.color} border-current` : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                        <Icon className="w-4 h-4" />{meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status Message</label>
                <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={3} placeholder="Describe the current status to users..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
                {createMutation.isPending ? "Updating..." : "Update Status"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
