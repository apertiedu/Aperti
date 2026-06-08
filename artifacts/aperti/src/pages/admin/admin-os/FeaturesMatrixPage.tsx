import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Plus, Save, Trash2, Edit2, X, Grid3X3, Bot, CreditCard } from "lucide-react";
import { fetchJSON, postJSON, putJSON, deleteJSON } from "@/lib/api";
import { toast } from "sonner";

const VISIBILITY_STATES = ["released", "beta", "coming_soon", "internal", "disabled"];
const STATE_STYLES: Record<string, string> = {
  released: "bg-green-100 text-green-700",
  beta: "bg-blue-100 text-blue-700",
  coming_soon: "bg-yellow-100 text-yellow-700",
  internal: "bg-purple-100 text-purple-700",
  disabled: "bg-gray-100 text-gray-500",
};

const ROLES = ["admin", "teacher", "student", "parent", "assistant"];
const PLANS = ["free", "basic", "pro", "enterprise"];
const ACCESS_LEVELS = ["full", "limited", "read_only", "hidden"];
const AI_FEATURES = ["mentor_ai", "exam_generator", "smart_grading", "coremind", "autopilot", "focus_coach", "parent_ai", "weave"];

const TABS = ["Feature Matrix", "Subscription Grid", "AI Access Rules", "Comm Permissions"];

function FeatureRow({ feature: f, onEdit, onDelete }: any) {
  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
      <td className="px-4 py-3">
        <div>
          <p className="text-sm font-medium text-gray-900">{f.feature_name}</p>
          <code className="text-[11px] text-gray-400 font-mono">{f.feature_key}</code>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATE_STYLES[f.visibility_state] || "bg-gray-100 text-gray-600"}`}>{f.visibility_state}</span>
      </td>
      <td className="px-4 py-3 text-xs text-gray-600">{f.required_role || <span className="text-gray-300">—</span>}</td>
      <td className="px-4 py-3 text-xs text-gray-600">{f.required_plan || <span className="text-gray-300">—</span>}</td>
      <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{f.description || "—"}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button onClick={() => onEdit(f)} className="p-1.5 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
          <button onClick={() => onDelete(f.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </td>
    </tr>
  );
}

function FeatureForm({ initial, onSubmit, onCancel }: any) {
  const [form, setForm] = useState(initial || { featureKey: "", featureName: "", requiredRole: "", requiredPlan: "", visibilityState: "released", description: "" });
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 space-y-4">
      <h3 className="font-semibold text-gray-900 text-sm">{initial ? "Edit Feature" : "New Feature"}</h3>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-gray-600">Feature Key *</label>
          <input value={form.featureKey} onChange={e => setForm({ ...form, featureKey: e.target.value })} placeholder="e.g. ai_mentor" className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Feature Name *</label>
          <input value={form.featureName} onChange={e => setForm({ ...form, featureName: e.target.value })} placeholder="e.g. AI Mentor" className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Visibility State</label>
          <select value={form.visibilityState} onChange={e => setForm({ ...form, visibilityState: e.target.value })} className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500">
            {VISIBILITY_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Required Role</label>
          <select value={form.requiredRole} onChange={e => setForm({ ...form, requiredRole: e.target.value })} className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500">
            <option value="">Any</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Required Plan</label>
          <select value={form.requiredPlan} onChange={e => setForm({ ...form, requiredPlan: e.target.value })} className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500">
            <option value="">Any</option>
            {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Description</label>
          <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
        <button onClick={() => onSubmit(form)} className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2"><Save className="w-3.5 h-3.5" />Save</button>
      </div>
    </div>
  );
}

function SubscriptionGridTab() {
  const qc = useQueryClient();
  const { data: items } = useQuery({ queryKey: ["gov-sub-features"], queryFn: () => fetchJSON("/api/admin/governance/subscription-features") });
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ planName: "", featureKey: "", accessLevel: "full" });

  const list: any[] = (items as any[]) || [];

  const createMut = useMutation({
    mutationFn: (d: any) => postJSON("/api/admin/governance/subscription-features", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gov-sub-features"] }); toast.success("Created"); setShowCreate(false); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, accessLevel }: any) => putJSON(`/api/admin/governance/subscription-features/${id}`, { accessLevel }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gov-sub-features"] }); toast.success("Updated"); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteJSON(`/api/admin/governance/subscription-features/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gov-sub-features"] }); toast.success("Deleted"); },
  });

  const byPlan = list.reduce((acc: any, item: any) => {
    const k = item.plan_name || "unassigned";
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-2 px-3 py-2 bg-teal-600 text-white text-sm rounded-xl hover:bg-teal-700">
          <Plus className="w-4 h-4" />Add Entry
        </button>
      </div>
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-gray-50 rounded-xl border border-gray-200 p-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Plan Name</label>
                <select value={form.planName} onChange={e => setForm({ ...form, planName: e.target.value })} className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500">
                  <option value="">Choose...</option>
                  {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Feature Key</label>
                <input value={form.featureKey} onChange={e => setForm({ ...form, featureKey: e.target.value })} className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Access Level</label>
                <select value={form.accessLevel} onChange={e => setForm({ ...form, accessLevel: e.target.value })} className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500">
                  {ACCESS_LEVELS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setShowCreate(false)} className="px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => createMut.mutate(form)} className="px-3 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700">Create</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {Object.entries(byPlan).map(([plan, planItems]: any) => (
        <div key={plan} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-teal-600" />
            <p className="font-semibold text-gray-800 text-sm capitalize">{plan} plan</p>
            <span className="text-xs text-gray-400 ml-auto">{planItems.length} feature(s)</span>
          </div>
          <div className="divide-y divide-gray-50">
            {planItems.map((item: any) => (
              <div key={item.id} className="flex items-center gap-3 px-5 py-3">
                <code className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded flex-1">{item.feature_key}</code>
                <select value={item.access_level} onChange={e => updateMut.mutate({ id: item.id, accessLevel: e.target.value })} className="px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none">
                  {ACCESS_LEVELS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <button onClick={() => deleteMut.mutate(item.id)} className="p-1 hover:bg-red-50 rounded text-gray-300 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        </div>
      ))}
      {list.length === 0 && <div className="text-center py-12 text-sm text-gray-400">No subscription-feature entries yet</div>}
    </div>
  );
}

function AiAccessTab() {
  const qc = useQueryClient();
  const { data: rules } = useQuery({ queryKey: ["gov-ai-access"], queryFn: () => fetchJSON("/api/admin/governance/ai-access") });
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ featureKey: "", featureName: "", requiredRole: "", requiredPlan: "", dailyLimit: "", monthlyLimit: "", enabled: true });

  const list: any[] = (rules as any[]) || [];
  const createMut = useMutation({
    mutationFn: (d: any) => postJSON("/api/admin/governance/ai-access", { ...d, dailyLimit: d.dailyLimit ? parseInt(d.dailyLimit) : null, monthlyLimit: d.monthlyLimit ? parseInt(d.monthlyLimit) : null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gov-ai-access"] }); toast.success("AI rule created"); setShowCreate(false); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, ...data }: any) => putJSON(`/api/admin/governance/ai-access/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gov-ai-access"] }); toast.success("Updated"); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-2 px-3 py-2 bg-teal-600 text-white text-sm rounded-xl hover:bg-teal-700">
          <Plus className="w-4 h-4" />Add Rule
        </button>
      </div>
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Feature Key</label>
                <select value={form.featureKey} onChange={e => setForm({ ...form, featureKey: e.target.value, featureName: e.target.value.replace(/_/g, " ") })} className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500">
                  <option value="">Choose...</option>
                  {AI_FEATURES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Required Role</label>
                <select value={form.requiredRole} onChange={e => setForm({ ...form, requiredRole: e.target.value })} className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg">
                  <option value="">Any</option>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Required Plan</label>
                <select value={form.requiredPlan} onChange={e => setForm({ ...form, requiredPlan: e.target.value })} className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg">
                  <option value="">Any</option>
                  {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Daily Limit</label>
                <input type="number" value={form.dailyLimit} onChange={e => setForm({ ...form, dailyLimit: e.target.value })} placeholder="Unlimited" className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Monthly Limit</label>
                <input type="number" value={form.monthlyLimit} onChange={e => setForm({ ...form, monthlyLimit: e.target.value })} placeholder="Unlimited" className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg">Cancel</button>
              <button onClick={() => createMut.mutate(form)} className="px-3 py-2 text-sm bg-teal-600 text-white rounded-lg">Create</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {["Feature", "Required Role", "Required Plan", "Daily", "Monthly", "Enabled"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-sm text-gray-400">No AI access rules defined</td></tr>
            ) : list.map((r: any) => (
              <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-teal-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{r.feature_name || r.feature_key}</p>
                      <code className="text-[11px] text-gray-400">{r.feature_key}</code>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">{r.required_role || "—"}</td>
                <td className="px-4 py-3 text-xs text-gray-600">{r.required_plan || "—"}</td>
                <td className="px-4 py-3 text-xs text-gray-600">{r.daily_limit ?? "∞"}</td>
                <td className="px-4 py-3 text-xs text-gray-600">{r.monthly_limit ?? "∞"}</td>
                <td className="px-4 py-3">
                  <button onClick={() => updateMut.mutate({ id: r.id, enabled: !r.enabled })} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${r.enabled ? "bg-teal-500" : "bg-gray-200"}`}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${r.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CommPermissionsTab() {
  const qc = useQueryClient();
  const { data: items } = useQuery({ queryKey: ["gov-comm-perms"], queryFn: () => fetchJSON("/api/admin/governance/comm-permissions") });
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ fromRole: "", toRole: "", channelType: "direct", allowed: true });

  const list: any[] = (items as any[]) || [];
  const createMut = useMutation({
    mutationFn: (d: any) => postJSON("/api/admin/governance/comm-permissions", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gov-comm-perms"] }); toast.success("Created"); setShowCreate(false); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, allowed }: any) => putJSON(`/api/admin/governance/comm-permissions/${id}`, { allowed }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gov-comm-perms"] }); toast.success("Updated"); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-2 px-3 py-2 bg-teal-600 text-white text-sm rounded-xl hover:bg-teal-700">
          <Plus className="w-4 h-4" />Add Rule
        </button>
      </div>
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-gray-50 rounded-xl border border-gray-200 p-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600">From Role</label>
                <select value={form.fromRole} onChange={e => setForm({ ...form, fromRole: e.target.value })} className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg">
                  <option value="">Choose...</option>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">To Role</label>
                <select value={form.toRole} onChange={e => setForm({ ...form, toRole: e.target.value })} className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg">
                  <option value="">Choose...</option>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Channel</label>
                <select value={form.channelType} onChange={e => setForm({ ...form, channelType: e.target.value })} className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg">
                  {["direct", "group", "broadcast", "thread"].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-3">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={form.allowed} onChange={e => setForm({ ...form, allowed: e.target.checked })} className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                Allowed
              </label>
              <div className="flex justify-end gap-2 ml-auto">
                <button onClick={() => setShowCreate(false)} className="px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg">Cancel</button>
                <button onClick={() => createMut.mutate(form)} className="px-3 py-2 text-sm bg-teal-600 text-white rounded-lg">Create</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {["From", "To", "Channel", "Allowed"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-10 text-sm text-gray-400">No communication rules. All messages allowed by default.</td></tr>
            ) : list.map((r: any) => (
              <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900 capitalize">{r.from_role}</td>
                <td className="px-4 py-3 text-sm text-gray-600 capitalize">{r.to_role}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{r.channel_type}</td>
                <td className="px-4 py-3">
                  <button onClick={() => updateMut.mutate({ id: r.id, allowed: !r.allowed })} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${r.allowed ? "bg-teal-500" : "bg-red-400"}`}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${r.allowed ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function FeaturesMatrixPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState(TABS[0]);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: features, isLoading } = useQuery({
    queryKey: ["gov-features"],
    queryFn: () => fetchJSON("/api/admin/governance/features"),
  });
  const featureList: any[] = (features as any[]) || [];

  const createMut = useMutation({
    mutationFn: (d: any) => postJSON("/api/admin/governance/features", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gov-features"] }); toast.success("Feature created"); setShowCreate(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => putJSON(`/api/admin/governance/features/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gov-features"] }); toast.success("Updated"); setEditing(null); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteJSON(`/api/admin/governance/features/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gov-features"] }); toast.success("Deleted"); },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Features & Access Matrix</h1>
          <p className="text-sm text-gray-500 mt-0.5">Control feature visibility, role gates, plan gates, and AI access limits</p>
        </div>
        {tab === TABS[0] && (
          <button onClick={() => { setShowCreate(true); setEditing(null); }} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" />New Feature
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>{t}</button>
        ))}
      </div>

      {tab === TABS[0] && (
        <>
          <AnimatePresence>
            {(showCreate || editing) && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <FeatureForm
                  initial={editing}
                  onSubmit={(d: any) => editing ? updateMut.mutate({ id: editing.id, data: d }) : createMut.mutate(d)}
                  onCancel={() => { setShowCreate(false); setEditing(null); }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {["Feature", "State", "Role Gate", "Plan Gate", "Description", "Actions"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? <tr><td colSpan={6} className="text-center py-12 text-sm text-gray-400">Loading...</td></tr>
                    : featureList.length === 0 ? <tr><td colSpan={6} className="text-center py-12 text-sm text-gray-400">No features yet</td></tr>
                    : featureList.map((f: any) => (
                      <FeatureRow key={f.id} feature={f}
                        onEdit={(feat: any) => { setEditing({ ...feat, featureKey: feat.feature_key, featureName: feat.feature_name, requiredRole: feat.required_role || "", requiredPlan: feat.required_plan || "", visibilityState: feat.visibility_state }); setShowCreate(false); }}
                        onDelete={(id: number) => { if (window.confirm("Delete this feature?")) deleteMut.mutate(id); }}
                      />
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === TABS[1] && <SubscriptionGridTab />}
      {tab === TABS[2] && <AiAccessTab />}
      {tab === TABS[3] && <CommPermissionsTab />}
    </div>
  );
}
