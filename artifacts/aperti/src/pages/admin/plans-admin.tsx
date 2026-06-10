import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, Plus, Edit2, Trash2, Eye, EyeOff, Check, X,
  GraduationCap, BookOpen, Star, Crown, Zap, ChevronDown, ChevronUp,
  Users, DollarSign, LayoutGrid, ToggleLeft, ToggleRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const token = () => localStorage.getItem("aperti_token") || "";
const authH = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token()}` });
const fetchJSON = (url: string) => fetch(url, { headers: authH() }).then(r => r.json());
const postJSON = (url: string, b: unknown) => fetch(url, { method: "POST", headers: authH(), body: JSON.stringify(b) }).then(r => r.json());
const putJSON  = (url: string, b: unknown) => fetch(url, { method: "PUT",  headers: authH(), body: JSON.stringify(b) }).then(r => r.json());
const delReq   = (url: string)             => fetch(url, { method: "DELETE", headers: authH() }).then(r => r.json());

type Plan = {
  id: number; name: string; type: "teacher" | "student" | "admin";
  price_egp: string; features: string[]; limits: Record<string, number>;
  visibility: boolean; is_visible_landing: boolean; sort_order: number;
  display_order: number; badge: string | null; student_limit: number | null;
};

const BLANK: Partial<Plan> & { featuresText: string } = {
  name: "", type: "teacher", price_egp: "", features: [], featuresText: "",
  limits: {}, visibility: true, is_visible_landing: true,
  sort_order: 0, display_order: 0, badge: "", student_limit: null,
};

const PLAN_ICONS: Record<string, React.ElementType> = {
  free: Zap, starter: Zap, essential: Star, plus: Star,
  pro: Crown, elite: Crown,
};

function planIcon(name: string) {
  return PLAN_ICONS[name?.toLowerCase()] ?? Package;
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label?: string }) {
  return (
    <button type="button" onClick={onChange} className="flex items-center gap-1.5 group">
      <div className={`w-9 h-5 rounded-full relative transition-colors duration-200 flex-shrink-0 ${on ? "bg-teal-500" : "bg-gray-200"}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${on ? "translate-x-4" : "translate-x-0.5"}`} />
      </div>
      {label && <span className="text-xs text-gray-500 group-hover:text-gray-700 transition-colors">{label}</span>}
    </button>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-400">{label}</p>
      </div>
    </div>
  );
}

function PlanForm({
  initial, onSave, onCancel, isPending,
}: {
  initial: typeof BLANK;
  onSave: (data: typeof BLANK) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState(initial);
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="bg-teal-50 border border-teal-100 rounded-2xl p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Plan name</label>
          <input value={form.name || ""} onChange={e => set("name", e.target.value)} placeholder="e.g. Pro"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
          <select value={form.type} onChange={e => set("type", e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-300">
            <option value="teacher">Teacher</option>
            <option value="student">Student</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Price (EGP / mo)</label>
          <input type="number" value={form.price_egp || ""} onChange={e => set("price_egp", e.target.value)} placeholder="5000"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Badge label (optional)</label>
          <input value={form.badge || ""} onChange={e => set("badge", e.target.value)} placeholder="POPULAR"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Student limit</label>
          <input type="number" value={form.student_limit ?? ""} onChange={e => set("student_limit", e.target.value ? parseInt(e.target.value) : null)} placeholder="Unlimited"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Display order</label>
          <input type="number" value={form.display_order ?? 0} onChange={e => set("display_order", parseInt(e.target.value) || 0)} placeholder="0"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Features <span className="text-gray-400">(one per line)</span></label>
        <textarea value={form.featuresText || ""} onChange={e => set("featuresText", e.target.value)} rows={4}
          placeholder={"Up to 50 students\nUnlimited courses\nAI lesson generation"}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 resize-none" />
      </div>
      <div className="flex flex-wrap items-center gap-5">
        <Toggle on={!!form.visibility} onChange={() => set("visibility", !form.visibility)} label="Active (visible to users)" />
        <Toggle on={!!form.is_visible_landing} onChange={() => set("is_visible_landing", !form.is_visible_landing)} label="Show on landing pricing page" />
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={() => onSave(form)} disabled={isPending || !form.name || !form.price_egp}
          className="px-5 py-2 bg-teal-500 text-white rounded-xl text-sm font-semibold hover:bg-teal-600 disabled:opacity-50 transition-colors">
          {isPending ? "Saving…" : "Save Plan"}
        </button>
        <button onClick={onCancel} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

function PlanCard({ plan, onEdit, onDelete, onToggleVisibility, onToggleLanding }:
  { plan: Plan; onEdit: (p: Plan) => void; onDelete: (id: number) => void;
    onToggleVisibility: (id: number, val: boolean) => void; onToggleLanding: (id: number, val: boolean) => void }) {

  const [expanded, setExpanded] = useState(false);
  const Icon = planIcon(plan.name);
  const isPopular = plan.badge?.toUpperCase() === "POPULAR" || plan.name.toLowerCase() === "pro" || plan.name.toLowerCase() === "plus";

  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
      className={`bg-white rounded-2xl border shadow-sm flex flex-col gap-0 transition-shadow hover:shadow-md overflow-hidden ${isPopular ? "border-teal-300 ring-1 ring-teal-100" : "border-gray-100"} ${!plan.visibility ? "opacity-60" : ""}`}>

      {isPopular && (
        <div className="bg-teal-500 text-white text-[9px] font-extrabold text-center py-1 tracking-widest">
          {plan.badge?.toUpperCase() || "MOST POPULAR"}
        </div>
      )}
      {!isPopular && plan.badge && (
        <div className="bg-amber-400 text-white text-[9px] font-extrabold text-center py-1 tracking-widest">
          {plan.badge.toUpperCase()}
        </div>
      )}

      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isPopular ? "bg-teal-500 text-white" : "bg-teal-50 text-teal-600"}`}>
              <Icon className="w-4.5 h-4.5" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">{plan.name}</p>
              <p className="text-[10px] text-gray-400 capitalize">{plan.type}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${plan.visibility ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
              {plan.visibility ? "LIVE" : "OFF"}
            </span>
            {plan.is_visible_landing && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600">LANDING</span>
            )}
          </div>
        </div>

        <div>
          <span className="text-2xl font-bold text-gray-900">{Number(plan.price_egp).toLocaleString()}</span>
          <span className="text-xs text-gray-400 ml-1">EGP/mo</span>
        </div>

        {Array.isArray(plan.features) && plan.features.length > 0 && (
          <div>
            <ul className="space-y-1">
              {(expanded ? plan.features : plan.features.slice(0, 3)).map((f, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-gray-500">
                  <Check className="w-3 h-3 text-teal-500 flex-shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {plan.features.length > 3 && (
              <button onClick={() => setExpanded(v => !v)} className="mt-1.5 flex items-center gap-0.5 text-[10px] text-teal-500 hover:text-teal-700">
                {expanded ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> +{plan.features.length - 3} more</>}
              </button>
            )}
          </div>
        )}

        {plan.student_limit && (
          <p className="text-[10px] text-gray-400 flex items-center gap-1">
            <Users className="w-3 h-3" /> Up to {plan.student_limit} students
          </p>
        )}
      </div>

      <div className="border-t border-gray-50 px-5 py-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <Toggle on={plan.visibility} onChange={() => onToggleVisibility(plan.id, !plan.visibility)} label="Active" />
          <Toggle on={plan.is_visible_landing} onChange={() => onToggleLanding(plan.id, !plan.is_visible_landing)} label="On landing" />
        </div>
        <div className="flex gap-2">
          <button onClick={() => onEdit(plan)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors">
            <Edit2 className="w-3 h-3" /> Edit
          </button>
          <button onClick={() => { if (confirm(`Archive "${plan.name}"? It will be hidden from users.`)) onDelete(plan.id); }}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function PlansAdminPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | "teacher" | "student">("all");

  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ["admin-plans-page"],
    queryFn: () => fetchJSON("/api/admin/commerce/plans"),
    refetchOnWindowFocus: false,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-plans-page"] });

  const createMut = useMutation({
    mutationFn: (form: typeof BLANK) => postJSON("/api/admin/commerce/plans", {
      name: form.name, type: form.type,
      priceEgp: parseFloat(String(form.price_egp)),
      features: (form.featuresText || "").split("\n").map((f: string) => f.trim()).filter(Boolean),
      visibility: form.visibility, is_visible_landing: form.is_visible_landing,
      sortOrder: form.display_order, display_order: form.display_order,
      badge: form.badge || null, studentLimit: form.student_limit ?? null,
    }),
    onSuccess: () => { invalidate(); setShowCreate(false); toast({ title: "Plan created" }); },
    onError: () => toast({ title: "Failed to create plan", variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: (form: typeof BLANK & { id?: number }) => putJSON(`/api/admin/commerce/plans/${form.id}`, {
      name: form.name, type: form.type,
      priceEgp: parseFloat(String(form.price_egp)),
      features: (form.featuresText || "").split("\n").map((f: string) => f.trim()).filter(Boolean),
      visibility: form.visibility, is_visible_landing: form.is_visible_landing,
      sortOrder: form.display_order, display_order: form.display_order,
      badge: form.badge || null, studentLimit: form.student_limit ?? null,
    }),
    onSuccess: () => { invalidate(); setEditingPlan(null); toast({ title: "Plan updated" }); },
    onError: () => toast({ title: "Failed to update plan", variant: "destructive" }),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, field, val }: { id: number; field: string; val: boolean }) =>
      putJSON(`/api/admin/commerce/plans/${id}`, { [field]: val }),
    onSuccess: invalidate,
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => delReq(`/api/admin/commerce/plans/${id}`),
    onSuccess: () => { invalidate(); toast({ title: "Plan archived" }); },
  });

  const teacherPlans = plans.filter(p => p.type === "teacher");
  const studentPlans = plans.filter(p => p.type === "student");
  const livePlans = plans.filter(p => p.visibility).length;
  const landingPlans = plans.filter(p => p.is_visible_landing).length;

  const displayed = typeFilter === "all" ? plans : plans.filter(p => p.type === typeFilter);

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-7">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-teal-500" /> Subscription Plans
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Create, edit, and manage pricing plans for teachers and students</p>
        </div>
        <button onClick={() => { setShowCreate(v => !v); setEditingPlan(null); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-teal-500 text-white rounded-xl text-sm font-semibold hover:bg-teal-600 transition-colors shadow-sm">
          {showCreate ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showCreate ? "Cancel" : "New Plan"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total plans" value={plans.length} icon={LayoutGrid} color="bg-teal-50 text-teal-600" />
        <StatCard label="Teacher plans" value={teacherPlans.length} icon={BookOpen} color="bg-blue-50 text-blue-600" />
        <StatCard label="Student plans" value={studentPlans.length} icon={GraduationCap} color="bg-violet-50 text-violet-600" />
        <StatCard label="Live on landing" value={landingPlans} icon={Eye} color="bg-green-50 text-green-600" />
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div key="create-form" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <PlanForm initial={{ ...BLANK }} onSave={d => createMut.mutate(d)} onCancel={() => setShowCreate(false)} isPending={createMut.isPending} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit form */}
      <AnimatePresence>
        {editingPlan && (
          <motion.div key="edit-form" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Edit2 className="w-4 h-4 text-teal-500" /> Editing: {editingPlan.name}
            </div>
            <PlanForm
              initial={{
                ...editingPlan,
                price_egp: editingPlan.price_egp,
                featuresText: Array.isArray(editingPlan.features) ? editingPlan.features.join("\n") : "",
                badge: editingPlan.badge ?? "",
              }}
              onSave={d => updateMut.mutate({ ...d, id: editingPlan.id })}
              onCancel={() => setEditingPlan(null)}
              isPending={updateMut.isPending}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(["all", "teacher", "student"] as const).map(f => (
          <button key={f} onClick={() => setTypeFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${typeFilter === f ? "bg-white text-teal-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {f === "all" ? `All (${plans.length})` : f === "teacher" ? `Teachers (${teacherPlans.length})` : `Students (${studentPlans.length})`}
          </button>
        ))}
      </div>

      {/* Plans grid */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-7 h-7 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No plans yet. Click "New Plan" to create one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence>
            {displayed.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onEdit={p => { setEditingPlan(p); setShowCreate(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                onDelete={id => deleteMut.mutate(id)}
                onToggleVisibility={(id, val) => toggleMut.mutate({ id, field: "visibility", val })}
                onToggleLanding={(id, val) => toggleMut.mutate({ id, field: "is_visible_landing", val })}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-400 pt-2 border-t border-gray-100">
        <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-green-400" /> <b>LIVE</b> — plan is visible to users on the subscription page</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-blue-400" /> <b>LANDING</b> — plan appears on the public pricing page</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-gray-300" /> <b>OFF</b> — hidden from all users</span>
      </div>
    </div>
  );
}
