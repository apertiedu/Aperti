import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Edit2, Layers, ChevronLeft, ChevronRight } from "lucide-react";
import { fetchJSON, postJSON, putJSON } from "@/lib/api";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  trial: "bg-blue-100 text-blue-700",
  expired: "bg-red-100 text-red-700",
  suspended: "bg-orange-100 text-orange-700",
  cancelled: "bg-gray-100 text-gray-500",
  grace: "bg-yellow-100 text-yellow-700",
};

export default function SubscriptionsPage() {
  const [tab, setTab] = useState<"subs" | "plans">("subs");
  const [page, setPage] = useState(1);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [planForm, setPlanForm] = useState({ name: "", type: "teacher", priceEgp: "", studentLimit: "", features: "" });
  const qc = useQueryClient();

  const { data: subsData } = useQuery({
    queryKey: ["admin-subs", page],
    queryFn: () => fetchJSON(`/api/admin/subscriptions?page=${page}&limit=20`),
    keepPreviousData: true,
  });

  const { data: stats } = useQuery({ queryKey: ["admin-sub-stats"], queryFn: () => fetchJSON("/api/admin/subscriptions/stats/overview") });
  const { data: plans } = useQuery({ queryKey: ["admin-plans"], queryFn: () => fetchJSON("/api/admin/subscriptions/plans") });

  const savePlanMutation = useMutation({
    mutationFn: () => {
      const payload = { ...planForm, priceEgp: planForm.priceEgp, studentLimit: planForm.studentLimit ? parseInt(planForm.studentLimit) : undefined, features: planForm.features.split(",").map(s => s.trim()).filter(Boolean) };
      return editingPlan ? putJSON(`/api/admin/subscriptions/plans/${editingPlan.id}`, payload) : postJSON("/api/admin/subscriptions/plans", payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-plans"] }); toast.success("Plan saved"); setShowPlanModal(false); setEditingPlan(null); setPlanForm({ name: "", type: "teacher", priceEgp: "", studentLimit: "", features: "" }); },
    onError: () => toast.error("Save failed"),
  });

  const archivePlanMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/subscriptions/plans/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${localStorage.getItem("aperti_token")}` } }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-plans"] }); toast.success("Plan archived"); },
    onError: () => toast.error("Archive failed"),
  });

  const subs: any[] = (subsData as any)?.subscriptions || [];
  const totalSubs: number = (subsData as any)?.total || 0;
  const planList: any[] = (plans as any[]) || [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Active", value: stats.active, color: "text-green-600" },
            { label: "Trial", value: stats.trial, color: "text-blue-600" },
            { label: "Expired", value: stats.expired, color: "text-red-600" },
            { label: "Total", value: stats.total, color: "text-gray-900" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(["subs", "plans"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {t === "subs" ? "Subscriptions" : "Plans"}
          </button>
        ))}
      </div>

      {tab === "subs" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {["User", "Plan", "Status", "Start Date", "End Date", "Payment"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subs.map((s: any) => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{s.displayName || s.username}</p>
                      <p className="text-xs text-gray-400">{s.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{s.planName}</p>
                      <p className="text-xs text-gray-400">EGP {s.planPrice}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[s.status] || "bg-gray-100 text-gray-600"}`}>{s.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(s.startDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{s.endDate ? new Date(s.endDate).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${s.paymentStatus === "approved" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{s.paymentStatus}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">Page {page} · {totalSubs} total</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"><ChevronLeft className="w-4 h-4" /></button>
              <button disabled={subs.length < 20} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      )}

      {tab === "plans" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => { setEditingPlan(null); setShowPlanModal(true); }} className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors">
              <Plus className="w-4 h-4" /> New Plan
            </button>
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {planList.map((plan: any) => (
              <div key={plan.id} className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-teal-600" />
                    <p className="font-semibold text-gray-900">{plan.name}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${plan.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{plan.isActive ? "Active" : "Archived"}</span>
                </div>
                <p className="text-3xl font-bold text-teal-600">EGP {plan.priceEgp}</p>
                <p className="text-xs text-gray-400 mb-3">per month · {plan.type}</p>
                {plan.features?.length > 0 && (
                  <ul className="space-y-1 mb-4">
                    {plan.features.slice(0, 4).map((f: string) => (
                      <li key={f} className="text-xs text-gray-600 flex items-center gap-1"><span className="text-teal-500">✓</span> {f}</li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2">
                  <button onClick={() => { setEditingPlan(plan); setPlanForm({ name: plan.name, type: plan.type, priceEgp: plan.priceEgp, studentLimit: plan.studentLimit?.toString() || "", features: (plan.features || []).join(", ") }); setShowPlanModal(true); }} className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                  <button onClick={() => { if (confirm("Archive this plan?")) archivePlanMutation.mutate(plan.id); }} className="px-3 py-1.5 text-xs text-red-500 border border-gray-200 rounded-lg hover:bg-red-50">Archive</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showPlanModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-5">{editingPlan ? "Edit" : "Create"} Plan</h2>
            <div className="space-y-4">
              {[{ key: "name", label: "Plan Name" }, { key: "priceEgp", label: "Price (EGP)" }, { key: "studentLimit", label: "Student Limit (optional)" }].map((f) => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                  <input value={(planForm as any)[f.key]} onChange={(e) => setPlanForm(p => ({ ...p, [f.key]: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400" />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select value={planForm.type} onChange={(e) => setPlanForm(p => ({ ...p, type: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400">
                  {["teacher", "student", "organization"].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Features (comma-separated)</label>
                <textarea value={planForm.features} onChange={(e) => setPlanForm(p => ({ ...p, features: e.target.value }))} rows={3} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400" placeholder="Unlimited students, AI Mentor, Live Classes" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowPlanModal(false); setEditingPlan(null); }} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700">Cancel</button>
              <button onClick={() => savePlanMutation.mutate()} disabled={savePlanMutation.isPending} className="flex-1 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
                {savePlanMutation.isPending ? "Saving…" : "Save Plan"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
