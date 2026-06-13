import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { fetchJSON, postJSON, putJSON } from "@/lib/api";
import { Bell, Plus, Edit2, Trash2, Globe, User, Check, X } from "lucide-react";

const RULE_TYPES = [
  { value: "rate_limit", label: "Rate Limit", desc: "Max N pushes per day" },
  { value: "digest", label: "Digest Bundle", desc: "Bundle into hourly/daily digest" },
  { value: "quiet_hours", label: "Quiet Hours", desc: "Block during specified hours" },
  { value: "priority_only", label: "Priority Only", desc: "Only send high-priority" },
];

function RuleCard({ rule, onEdit, onDelete }: { rule: any; onEdit: () => void; onDelete: () => void }) {
  const rt = RULE_TYPES.find(r => r.value === rule.rule_type) ?? { label: rule.rule_type, desc: "" };
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center">
            {rule.user_id ? <User className="w-4 h-4 text-teal-600" /> : <Globe className="w-4 h-4 text-teal-600" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-gray-800 text-sm">{rt.label}</p>
              <span className={`px-1.5 py-0.5 rounded text-xs ${rule.is_active !== false ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {rule.is_active !== false ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {rule.user_id ? (rule.user_name ?? `User #${rule.user_id}`) : "Global rule"}
            </p>
            {rule.config && Object.keys(rule.config).length > 0 && (
              <p className="text-xs text-gray-400 mt-0.5 font-mono">
                {JSON.stringify(rule.config)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-rose-50 text-gray-400 hover:text-rose-500 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-2">
        Created {new Date(rule.created_at).toLocaleDateString()}
      </p>
    </motion.div>
  );
}

export default function NotificationRulesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ rule_type: "rate_limit", config: '{"max_per_day":5}', user_id: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["notification-rules"],
    queryFn: () => fetchJSON("/api/admin/notification-rules"),
  });

  const createMut = useMutation({
    mutationFn: () => {
      const payload = {
        rule_type: form.rule_type,
        config: (() => { try { return JSON.parse(form.config); } catch { return {}; } })(),
        user_id: form.user_id ? parseInt(form.user_id) : null,
      };
      return editId
        ? putJSON(`/api/admin/notification-rules/${editId}`, payload)
        : postJSON("/api/admin/notification-rules", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notification-rules"] });
      setShowForm(false);
      setEditId(null);
      setForm({ rule_type: "rate_limit", config: '{"max_per_day":5}', user_id: "" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/notification-rules/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notification-rules"] }),
  });

  const rules = data?.rules ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notification Rules</h1>
          <p className="text-sm text-gray-500 mt-0.5">Rate limits, digests, and delivery policies</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditId(null); }}
          className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-teal-700 transition-colors">
          <Plus className="w-4 h-4" /> New Rule
        </button>
      </div>

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="bg-white rounded-xl shadow-sm border border-teal-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">{editId ? "Edit Rule" : "Create Rule"}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Rule Type</label>
                <select value={form.rule_type} onChange={(e) => setForm(f => ({ ...f, rule_type: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30">
                  {RULE_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Config (JSON)</label>
                <input value={form.config} onChange={(e) => setForm(f => ({ ...f, config: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                  placeholder='{"max_per_day":5}' />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">User ID (blank = global)</label>
                <input value={form.user_id} onChange={(e) => setForm(f => ({ ...f, user_id: e.target.value }))}
                  type="number" placeholder="Leave blank for global"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => createMut.mutate()} disabled={createMut.isPending}
                className="flex items-center gap-1.5 bg-teal-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
                <Check className="w-4 h-4" /> {createMut.isPending ? "Saving…" : "Save"}
              </button>
              <button onClick={() => setShowForm(false)}
                className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm hover:bg-gray-50">
                <X className="w-4 h-4" /> Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rules list */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 animate-pulse h-24" />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <Bell className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No notification rules yet</p>
          <p className="text-sm text-gray-400 mt-1">Create rules to control delivery — rate limits, digests, quiet hours</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {rules.map((rule: any) => (
            <RuleCard key={rule.id} rule={rule}
              onEdit={() => {
                setEditId(rule.id);
                setForm({ rule_type: rule.rule_type, config: JSON.stringify(rule.config ?? {}), user_id: rule.user_id ?? "" });
                setShowForm(true);
              }}
              onDelete={() => { if (confirm("Delete this rule?")) deleteMut.mutate(rule.id); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
