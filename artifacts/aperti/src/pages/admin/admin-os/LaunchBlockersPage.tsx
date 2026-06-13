import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert, CheckCircle2, Clock, XCircle, AlertTriangle, Plus,
  RefreshCw, Rocket, Flame, Zap, Wrench,
} from "lucide-react";
import { toast } from "sonner";

const api = (path: string, opts?: RequestInit) =>
  fetch(path, { ...opts, credentials: "include", headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) } });

const SEV: Record<string, { label: string; color: string; bg: string; icon: any; ring: string }> = {
  critical: { label: "Critical",  color: "text-red-700",    bg: "bg-red-50",     icon: Flame,        ring: "border-red-200" },
  major:    { label: "Major",     color: "text-orange-700", bg: "bg-orange-50",  icon: AlertTriangle, ring: "border-orange-200" },
  minor:    { label: "Minor",     color: "text-blue-700",   bg: "bg-blue-50",    icon: Zap,           ring: "border-blue-200" },
};

const STAT: Record<string, { label: string; color: string; icon: any }> = {
  open:        { label: "Open",        color: "text-yellow-600", icon: AlertTriangle },
  in_progress: { label: "In Progress", color: "text-blue-600",   icon: Clock },
  resolved:    { label: "Resolved",    color: "text-green-600",  icon: CheckCircle2 },
  wont_fix:    { label: "Won't Fix",   color: "text-gray-500",   icon: XCircle },
};

function BlockerCard({ b, onUpdate }: { b: any; onUpdate: (id: number, patch: any) => void }) {
  const [editing, setEditing] = useState(false);
  const [newStatus, setNewStatus] = useState(b.status);
  const [notes, setNotes] = useState(b.description || "");
  const [saving, setSaving] = useState(false);

  const sev = SEV[b.severity] || SEV.minor;
  const stat = STAT[b.status] || STAT.open;
  const StatIcon = stat.icon;
  const SevIcon = sev.icon;

  const save = async () => {
    setSaving(true);
    await onUpdate(b.id, { status: newStatus, description: notes });
    setSaving(false);
    setEditing(false);
  };

  return (
    <div className={`rounded-xl border ${sev.ring} bg-white shadow-sm overflow-hidden`}>
      <div className="px-5 py-4 flex items-start gap-3">
        <div className={`mt-0.5 p-1.5 rounded-lg ${sev.bg}`}>
          <SevIcon className={`w-3.5 h-3.5 ${sev.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="font-semibold text-sm text-gray-900">{b.title}</p>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sev.bg} ${sev.color}`}>
              {sev.label}
            </span>
            {b.category && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{b.category}</span>
            )}
          </div>
          {b.description && (
            <p className="text-xs text-gray-500 leading-relaxed">{b.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <StatIcon className={`w-3 h-3 ${stat.color}`} />
            <span className={`text-xs font-medium ${stat.color}`}>{stat.label}</span>
            <span className="text-gray-300">·</span>
            <span className="text-xs text-gray-400">{new Date(b.created_at).toLocaleDateString()}</span>
          </div>
        </div>
        <button
          onClick={() => setEditing(e => !e)}
          className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
          title="Edit"
        >
          <Wrench className="w-3.5 h-3.5" />
        </button>
      </div>

      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 pt-0 border-t border-gray-100 space-y-3 mt-0">
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 block">Status</label>
                  <select
                    value={newStatus}
                    onChange={e => setNewStatus(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400"
                  >
                    {Object.entries(STAT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 block">Description</label>
                  <input
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400"
                    placeholder="Add or update description…"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs text-gray-500 rounded-lg hover:bg-gray-50 border border-gray-200">
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                  Save
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AddBlockerForm({ onAdd }: { onAdd: (data: any) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState("major");
  const [category, setCategory] = useState("general");
  const [description, setDescription] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd({ title: title.trim(), severity, category, description: description.trim() });
    setTitle(""); setSeverity("major"); setCategory("general"); setDescription("");
    setOpen(false);
  };

  return (
    <div>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Blocker
        </button>
      ) : (
        <motion.form
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={submit}
          className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3"
        >
          <p className="text-sm font-semibold text-gray-700 mb-2">New Blocker</p>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Blocker title…"
            required
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400 bg-white"
          />
          <div className="grid grid-cols-2 gap-3">
            <select value={severity} onChange={e => setSeverity(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400 bg-white">
              <option value="critical">Critical</option>
              <option value="major">Major</option>
              <option value="minor">Minor</option>
            </select>
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400 bg-white">
              {["general","authentication","database","ui","performance","reliability","security","payments"].map(c => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Description (optional)…"
            rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400 resize-none bg-white"
          />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 text-xs text-gray-500 rounded-lg hover:bg-gray-100 border border-gray-200">Cancel</button>
            <button type="submit" className="px-4 py-1.5 text-xs font-semibold bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors">Add Blocker</button>
          </div>
        </motion.form>
      )}
    </div>
  );
}

export default function LaunchBlockersPage() {
  const qc = useQueryClient();
  const [sevFilter, setSevFilter] = useState<"all" | "critical" | "major" | "minor">("all");
  const [statFilter, setStatFilter] = useState<string>("open");

  const { data: blockers = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["launch-blockers"],
    queryFn: () => api("/api/founder/launch-blockers").then(r => r.json()),
    refetchInterval: 30000,
  });

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: any }) =>
      api(`/api/founder/launch-blockers/${id}`, { method: "PATCH", body: JSON.stringify(patch) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["launch-blockers"] }); toast.success("Blocker updated"); },
    onError: () => toast.error("Update failed"),
  });

  const addMut = useMutation({
    mutationFn: (data: any) =>
      api("/api/founder/launch-blockers", { method: "POST", body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["launch-blockers"] }); toast.success("Blocker added"); },
    onError: () => toast.error("Failed to add blocker"),
  });

  const open = (blockers as any[]).filter(b => b.status === "open" || b.status === "in_progress");
  const critOpen = open.filter(b => b.severity === "critical");
  const majorOpen = open.filter(b => b.severity === "major");
  const allResolved = critOpen.length === 0 && majorOpen.length === 0;

  const filtered = (blockers as any[]).filter(b => {
    const sevOk = sevFilter === "all" || b.severity === sevFilter;
    const statOk = statFilter === "all" || b.status === statFilter;
    return sevOk && statOk;
  });

  const counts = (blockers as any[]).reduce((acc: Record<string, number>, b: any) => {
    acc[b.severity] = (acc[b.severity] || 0) + 1;
    acc[`stat_${b.status}`] = (acc[`stat_${b.status}`] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-red-500" />
            Launch Blockers
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Track and resolve all issues before going live</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <AddBlockerForm onAdd={(data) => addMut.mutate(data)} />
        </div>
      </div>

      {allResolved && (blockers as any[]).length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-50 border border-green-200 rounded-2xl p-6 flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
            <Rocket className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="font-bold text-green-800 text-lg">All Blockers Cleared!</p>
            <p className="text-sm text-green-600 mt-0.5">No critical or major blockers remain open. Platform is cleared for launch.</p>
          </div>
        </motion.div>
      ) : critOpen.length > 0 ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <Flame className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 font-medium">
            <strong>{critOpen.length} critical blocker{critOpen.length !== 1 ? "s" : ""}</strong> must be resolved before launch.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { key: "critical", label: "Critical", color: "text-red-700", bg: "bg-red-50" },
          { key: "major",    label: "Major",    color: "text-orange-700", bg: "bg-orange-50" },
          { key: "minor",    label: "Minor",    color: "text-blue-700",   bg: "bg-blue-50" },
          { key: "stat_resolved", label: "Resolved", color: "text-green-700", bg: "bg-green-50" },
        ].map(s => (
          <div key={s.key} className={`${s.bg} rounded-xl p-4 text-center`}>
            <p className={`text-2xl font-bold ${s.color}`}>{counts[s.key] || 0}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(["all", "critical", "major", "minor"] as const).map(s => (
            <button
              key={s}
              onClick={() => setSevFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${sevFilter === s ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { key: "all", label: "All" },
            { key: "open", label: "Open" },
            { key: "in_progress", label: "In Progress" },
            { key: "resolved", label: "Resolved" },
            { key: "wont_fix", label: "Won't Fix" },
          ].map(s => (
            <button
              key={s.key}
              onClick={() => setStatFilter(s.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${statFilter === s.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ShieldAlert className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No blockers found</p>
          <p className="text-xs mt-1">All issues resolved or no blockers match the current filter</p>
        </div>
      ) : (
        <div className="space-y-3">
          {["critical", "major", "minor"].map(sev => {
            const group = filtered.filter(b => b.severity === sev);
            if (!group.length) return null;
            const meta = SEV[sev];
            const SevIcon = meta.icon;
            return (
              <div key={sev}>
                <div className="flex items-center gap-2 mb-2">
                  <SevIcon className={`w-3.5 h-3.5 ${meta.color}`} />
                  <p className={`text-xs font-bold uppercase tracking-wide ${meta.color}`}>{meta.label} ({group.length})</p>
                </div>
                <div className="space-y-2">
                  {group.map(b => (
                    <BlockerCard
                      key={b.id}
                      b={b}
                      onUpdate={(id, patch) => updateMut.mutate({ id, patch })}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
