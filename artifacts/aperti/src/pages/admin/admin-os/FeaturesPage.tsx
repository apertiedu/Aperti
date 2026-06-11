import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Zap } from "lucide-react";
import { fetchJSON, postJSON, putJSON } from "@/lib/api";
import { toast } from "sonner";

const STATUS_STYLES: Record<string, string> = {
  enabled: "bg-green-100 text-green-700",
  disabled: "bg-gray-100 text-gray-500",
  beta: "bg-blue-100 text-blue-700",
  coming_soon: "bg-yellow-100 text-yellow-700",
  internal: "bg-purple-100 text-purple-700",
  experimental: "bg-orange-100 text-orange-700",
  archived: "bg-red-100 text-red-600",
};

function FlagRow({ flag, onToggle, onEdit }: any) {
  return (
    <motion.div layout className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${flag.enabled ? "bg-teal-50" : "bg-gray-50"}`}>
        <Zap className={`w-5 h-5 ${flag.enabled ? "text-teal-600" : "text-gray-400"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-gray-900 text-sm">{flag.name}</p>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[flag.status] || "bg-gray-100 text-gray-600"}`}>{flag.status}</span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{flag.description || "No description"}</p>
        {flag.targetRoles?.length > 0 && (
          <p className="text-xs text-gray-400 mt-1">Roles: {flag.targetRoles.join(", ")}</p>
        )}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => onToggle(flag.id, !flag.enabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${flag.enabled ? "bg-teal-500" : "bg-gray-200"}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${flag.enabled ? "translate-x-6" : "translate-x-1"}`} />
        </button>
        <button onClick={() => onEdit(flag)} className="text-xs text-gray-500 hover:text-teal-600 px-2 py-1 border border-gray-200 rounded-lg hover:border-teal-200 transition-colors">Edit</button>
      </div>
    </motion.div>
  );
}

export default function FeaturesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", description: "", enabled: false, status: "enabled", targetRoles: "" });
  const qc = useQueryClient();

  const { data: flags } = useQuery({ queryKey: ["feature-flags-admin"], queryFn: () => fetchJSON("/api/admin/feature-flags") });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: any) => putJSON(`/api/admin/feature-flags/${id}`, { enabled }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["feature-flags-admin"] }); toast.success("Feature flag updated"); },
    onError: () => toast.error("Update failed"),
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => editing
      ? putJSON(`/api/admin/feature-flags/${editing.id}`, data)
      : postJSON("/api/admin/feature-flags", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["feature-flags-admin"] }); toast.success("Saved"); setShowCreate(false); setEditing(null); setForm({ name: "", description: "", enabled: false, status: "enabled", targetRoles: "" }); },
    onError: () => toast.error("Save failed"),
  });

  const flagList: any[] = (flags as any[]) || [];
  const enabledCount = flagList.filter((f) => f.enabled).length;

  const openEdit = (flag: any) => {
    setEditing(flag);
    setForm({ name: flag.name, description: flag.description || "", enabled: flag.enabled, status: flag.status, targetRoles: (flag.targetRoles || []).join(", ") });
    setShowCreate(true);
  };

  const handleSave = () => {
    saveMutation.mutate({
      ...form,
      targetRoles: form.targetRoles ? form.targetRoles.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feature Flags</h1>
          <p className="text-sm text-gray-500">{enabledCount} of {flagList.length} features enabled</p>
        </div>
        <button onClick={() => { setEditing(null); setForm({ name: "", description: "", enabled: false, status: "enabled", targetRoles: "" }); setShowCreate(true); }} className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors">
          <Plus className="w-4 h-4" /> New Flag
        </button>
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-700">Features Active</p>
          <p className="text-sm text-gray-500">{enabledCount}/{flagList.length}</p>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: flagList.length ? `${(enabledCount / flagList.length) * 100}%` : "0%" }} />
        </div>
      </div>

      <div className="space-y-2">
        {flagList.map((flag: any) => (
          <FlagRow key={flag.id} flag={flag} onToggle={(id: number, enabled: boolean) => toggleMutation.mutate({ id, enabled })} onEdit={openEdit} />
        ))}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-5">{editing ? "Edit" : "Create"} Feature Flag</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Flag Name <span className="text-red-500">*</span></label>
                <input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} disabled={!!editing} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400 disabled:bg-gray-50" placeholder="e.g. live_classes" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400" placeholder="Brief description…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={form.status} onChange={(e) => setForm(p => ({ ...p, status: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400">
                  {["enabled", "disabled", "beta", "coming_soon", "internal", "experimental"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Roles (comma-separated)</label>
                <input value={form.targetRoles} onChange={(e) => setForm(p => ({ ...p, targetRoles: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400" placeholder="teacher, student, admin" />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Enabled</label>
                <button onClick={() => setForm(p => ({ ...p, enabled: !p.enabled }))} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.enabled ? "bg-teal-500" : "bg-gray-200"}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.enabled ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowCreate(false); setEditing(null); }} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700">Cancel</button>
              <button onClick={handleSave} disabled={saveMutation.isPending} className="flex-1 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
                {saveMutation.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
