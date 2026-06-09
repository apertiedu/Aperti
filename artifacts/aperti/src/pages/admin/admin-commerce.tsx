import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  CreditCard, Package, Users, CheckCircle2, XCircle, Clock,
  Plus, Edit2, Trash2, Eye, BarChart3, ArrowRight, Loader2,
  Receipt, DollarSign, AlertCircle, RefreshCw, ChevronDown, ChevronUp, Rocket
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

const token = () => localStorage.getItem("aperti_token") || "";
const authHeaders = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token()}` });
async function fetchJSON(url: string) {
  const r = await fetch(url, { headers: authHeaders() });
  return r.json();
}
async function postJSON(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
  return r.json();
}
async function putJSON(url: string, body: unknown) {
  const r = await fetch(url, { method: "PUT", headers: authHeaders(), body: JSON.stringify(body) });
  return r.json();
}
async function deleteReq(url: string) {
  const r = await fetch(url, { method: "DELETE", headers: authHeaders() });
  return r.json();
}

type Tab = "plans" | "subscriptions" | "payments" | "invoices" | "coming-soon";

export default function AdminCommercePage() {
  const [tab, setTab] = useState<Tab>("payments");
  const qc = useQueryClient();
  const { toast } = useToast();

  const tabs: { id: Tab; label: string; icon: React.ComponentType<any> }[] = [
    { id: "payments",     label: "Payment Requests", icon: CreditCard },
    { id: "subscriptions",label: "Subscriptions",    icon: Users },
    { id: "plans",        label: "Plans",            icon: Package },
    { id: "invoices",     label: "Invoices",         icon: Receipt },
    { id: "coming-soon",  label: "Coming Soon",      icon: Rocket },
  ];

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-teal-500" /> Commerce Admin
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage subscriptions, plans & billing</p>
        </div>
        <Link href="/admin/executive">
          <button className="flex items-center gap-1.5 px-4 py-2 bg-teal-50 text-teal-700 border border-teal-200 rounded-xl text-sm font-semibold hover:bg-teal-100 transition-colors">
            <BarChart3 className="w-3.5 h-3.5" /> Executive View
          </button>
        </Link>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? "bg-white text-teal-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "payments"     && <PaymentRequestsPanel qc={qc} toast={toast} />}
      {tab === "subscriptions"&& <SubscriptionsPanel />}
      {tab === "plans"        && <PlansPanel qc={qc} toast={toast} />}
      {tab === "invoices"     && <InvoicesPanel />}
      {tab === "coming-soon"  && <ComingSoonPanel qc={qc} toast={toast} />}
    </div>
  );
}

/* ─── PAYMENT REQUESTS ───────────────────────────────────────────────────── */
function PaymentRequestsPanel({ qc, toast }: { qc: any; toast: any }) {
  const { data: requests = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-payment-requests"],
    queryFn: () => fetchJSON("/api/admin/commerce/payment-requests"),
  });

  const verifyMut = useMutation({
    mutationFn: (id: number) => putJSON(`/api/admin/commerce/payment-requests/${id}/verify`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-payment-requests"] }); toast({ title: "Payment verified — subscription activated" }); },
  });
  const rejectMut = useMutation({
    mutationFn: (id: number) => putJSON(`/api/admin/commerce/payment-requests/${id}/reject`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-payment-requests"] }); toast({ title: "Payment rejected" }); },
  });

  const pending = (requests as any[]).filter((r: any) => r.status === "paid");
  const processed = (requests as any[]).filter((r: any) => r.status !== "paid" && r.status !== "pending");

  if (isLoading) return <LoadingSpin />;

  return (
    <div className="space-y-6">
      {/* Pending verification */}
      {pending.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-amber-500" />
            <h3 className="font-bold text-gray-800">Awaiting Verification ({pending.length})</h3>
          </div>
          <div className="space-y-3">
            {pending.map((pr: any) => (
              <motion.div key={pr.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-amber-50 border border-amber-100 rounded-2xl p-5 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-gray-800">{pr.display_name || pr.username}</p>
                    <span className="text-xs text-gray-400">@{pr.username}</span>
                  </div>
                  <p className="text-sm text-gray-600">{pr.plan_name}</p>
                  <p className="text-xs font-mono text-teal-600 mt-1">{pr.reference_code}</p>
                  {pr.proof_url && (
                    <a href={pr.proof_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-1">
                      <Eye className="w-3 h-3" /> View proof
                    </a>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{new Date(pr.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <p className="text-lg font-bold text-gray-900">{Number(pr.amount).toLocaleString()} EGP</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => verifyMut.mutate(pr.id)}
                      disabled={verifyMut.isPending}
                      className="flex items-center gap-1.5 px-3 py-2 bg-green-500 text-white rounded-xl text-xs font-semibold hover:bg-green-600 disabled:opacity-50 transition-colors"
                    >
                      {verifyMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      Verify
                    </button>
                    <button
                      onClick={() => rejectMut.mutate(pr.id)}
                      disabled={rejectMut.isPending}
                      className="flex items-center gap-1.5 px-3 py-2 bg-red-100 text-red-600 rounded-xl text-xs font-semibold hover:bg-red-200 disabled:opacity-50 transition-colors"
                    >
                      <XCircle className="w-3 h-3" /> Reject
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {pending.length === 0 && (
        <div className="bg-green-50 border border-green-100 rounded-2xl p-6 text-center">
          <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
          <p className="text-sm text-green-700 font-medium">All caught up — no pending payments</p>
        </div>
      )}

      {/* Processed */}
      {processed.length > 0 && (
        <section>
          <h3 className="font-bold text-gray-600 text-sm mb-3">Recently Processed</h3>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-400">
                <th className="text-left px-4 py-3">User</th><th className="text-left px-4 py-3">Plan</th>
                <th className="text-left px-4 py-3">Reference</th><th className="text-right px-4 py-3">Amount</th>
                <th className="text-right px-4 py-3">Status</th>
              </tr></thead>
              <tbody>
                {processed.slice(0, 10).map((pr: any) => (
                  <tr key={pr.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-700">{pr.display_name || pr.username}</td>
                    <td className="px-4 py-3 text-gray-500">{pr.plan_name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{pr.reference_code}</td>
                    <td className="px-4 py-3 text-right font-semibold">{Number(pr.amount).toLocaleString()} EGP</td>
                    <td className="px-4 py-3 text-right">
                      <StatusBadge status={pr.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

/* ─── SUBSCRIPTIONS ──────────────────────────────────────────────────────── */
function SubscriptionsPanel() {
  const [filter, setFilter] = useState("active");
  const { data: subs = [], isLoading } = useQuery({
    queryKey: ["admin-subscriptions", filter],
    queryFn: () => fetchJSON(`/api/admin/commerce/subscriptions?status=${filter}`),
  });

  if (isLoading) return <LoadingSpin />;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {["active","pending_review","cancelled","trial"].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filter === s ? "bg-teal-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
            {s.replace("_", " ")}
          </button>
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-400">
            <th className="text-left px-4 py-3">User</th><th className="text-left px-4 py-3">Plan</th>
            <th className="text-left px-4 py-3">Started</th><th className="text-left px-4 py-3">Expires</th>
            <th className="text-right px-4 py-3">Amount</th><th className="text-right px-4 py-3">Status</th>
          </tr></thead>
          <tbody>
            {(subs as any[]).map((s: any) => (
              <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3"><p className="font-medium text-gray-800">{s.display_name || s.username}</p><p className="text-xs text-gray-400">@{s.username}</p></td>
                <td className="px-4 py-3 text-gray-600">{s.plan_name}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{s.start_date ? new Date(s.start_date).toLocaleDateString("en-GB") : "—"}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{s.end_date ? new Date(s.end_date).toLocaleDateString("en-GB") : "—"}</td>
                <td className="px-4 py-3 text-right font-semibold">{Number(s.price_egp).toLocaleString()} EGP</td>
                <td className="px-4 py-3 text-right"><StatusBadge status={s.status} /></td>
              </tr>
            ))}
            {(subs as any[]).length === 0 && <tr><td colSpan={6} className="text-center py-10 text-gray-400">No subscriptions found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── PLANS ──────────────────────────────────────────────────────────────── */
function PlansPanel({ qc, toast }: { qc: any; toast: any }) {
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", type: "teacher", priceEgp: "", features: "", visibility: true });

  const { data: plans = [], isLoading } = useQuery({ queryKey: ["admin-plans"], queryFn: () => fetchJSON("/api/admin/commerce/plans") });

  const createMut = useMutation({
    mutationFn: () => postJSON("/api/admin/commerce/plans", {
      ...form,
      priceEgp: parseFloat(form.priceEgp),
      features: form.features.split("\n").map(f => f.trim()).filter(Boolean),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-plans"] }); setShowForm(false); toast({ title: "Plan created" }); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteReq(`/api/admin/commerce/plans/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-plans"] }); toast({ title: "Plan archived" }); },
  });

  if (isLoading) return <LoadingSpin />;

  return (
    <div className="space-y-4">
      <button onClick={() => setShowForm(v => !v)}
        className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-xl text-sm font-semibold hover:bg-teal-600 transition-colors">
        <Plus className="w-4 h-4" /> Add Plan
      </button>

      {showForm && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
          className="bg-teal-50 border border-teal-100 rounded-2xl p-5 space-y-3">
          <h3 className="font-bold text-gray-800">New Plan</h3>
          <div className="grid sm:grid-cols-3 gap-3">
            <input placeholder="Name (e.g. Plus)" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300" />
            <select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300">
              <option value="teacher">Teacher</option><option value="student">Student</option><option value="admin">Admin</option>
            </select>
            <input placeholder="Price EGP/mo" type="number" value={form.priceEgp} onChange={e => setForm(f => ({...f, priceEgp: e.target.value}))}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300" />
          </div>
          <textarea placeholder="Features (one per line)" value={form.features} onChange={e => setForm(f => ({...f, features: e.target.value}))} rows={4}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300" />
          <button onClick={() => createMut.mutate()} disabled={createMut.isPending || !form.name || !form.priceEgp}
            className="px-5 py-2 bg-teal-500 text-white rounded-xl text-sm font-semibold hover:bg-teal-600 disabled:opacity-50 transition-colors">
            {createMut.isPending ? "Creating…" : "Create Plan"}
          </button>
        </motion.div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(plans as any[]).map((plan: any) => (
          <div key={plan.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-bold text-gray-900">{plan.name}</p>
                <p className="text-xs text-gray-400 capitalize">{plan.type}</p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${plan.visibility ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                {plan.visibility ? "LIVE" : "HIDDEN"}
              </span>
            </div>
            <p className="text-2xl font-bold text-teal-600 mb-3">{Number(plan.price_egp).toLocaleString()} <span className="text-sm font-normal text-gray-400">EGP/mo</span></p>
            {Array.isArray(plan.features) && (
              <ul className="text-xs text-gray-500 space-y-1 mb-4">
                {plan.features.slice(0, 4).map((f: string, i: number) => <li key={i}>• {f}</li>)}
              </ul>
            )}
            <button onClick={() => { if (confirm(`Archive plan ${plan.name}?`)) deleteMut.mutate(plan.id); }}
              className="text-xs text-red-400 hover:text-red-600 transition-colors">Archive</button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── INVOICES ───────────────────────────────────────────────────────────── */
function InvoicesPanel() {
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["admin-invoices"],
    queryFn: () => fetchJSON("/api/admin/commerce/invoices"),
  });
  if (isLoading) return <LoadingSpin />;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <table className="w-full text-sm">
        <thead><tr className="bg-gray-50 border-b text-xs text-gray-400">
          <th className="text-left px-4 py-3">User</th><th className="text-left px-4 py-3">Plan</th>
          <th className="text-left px-4 py-3">Date</th><th className="text-right px-4 py-3">Amount</th>
          <th className="text-right px-4 py-3">Status</th>
        </tr></thead>
        <tbody>
          {(invoices as any[]).map((inv: any) => (
            <tr key={inv.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-700">{inv.display_name || inv.username}</td>
              <td className="px-4 py-3 text-gray-500">{inv.plan_name}</td>
              <td className="px-4 py-3 text-gray-400 text-xs">{new Date(inv.issued_at).toLocaleDateString("en-GB")}</td>
              <td className="px-4 py-3 text-right font-semibold">{Number(inv.amount).toLocaleString()} EGP</td>
              <td className="px-4 py-3 text-right"><StatusBadge status={inv.status} /></td>
            </tr>
          ))}
          {(invoices as any[]).length === 0 && <tr><td colSpan={5} className="text-center py-10 text-gray-400">No invoices yet</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ─── COMING SOON ────────────────────────────────────────────────────────── */
function ComingSoonPanel({ qc, toast }: { qc: any; toast: any }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ featureName: "", description: "", releaseWindow: "", waitlistEnabled: true, displayOrder: 0 });

  const { data: items = [], isLoading } = useQuery({ queryKey: ["coming-soon"], queryFn: () => fetchJSON("/api/coming-soon") });

  const createMut = useMutation({
    mutationFn: () => postJSON("/api/admin/commerce/coming-soon", form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["coming-soon"] }); setShowForm(false); toast({ title: "Item created" }); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteReq(`/api/admin/commerce/coming-soon/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["coming-soon"] }); toast({ title: "Item deleted" }); },
  });

  if (isLoading) return <LoadingSpin />;

  return (
    <div className="space-y-4">
      <button onClick={() => setShowForm(v => !v)}
        className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-xl text-sm font-semibold hover:bg-teal-600 transition-colors">
        <Plus className="w-4 h-4" /> Add Item
      </button>

      {showForm && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-teal-50 border border-teal-100 rounded-2xl p-5 space-y-3">
          <input placeholder="Feature Name" value={form.featureName} onChange={e => setForm(f => ({...f, featureName: e.target.value}))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300" />
          <textarea placeholder="Description" value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} rows={3}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300" />
          <div className="grid sm:grid-cols-2 gap-3">
            <input placeholder="Release Window (e.g. Q3 2026)" value={form.releaseWindow} onChange={e => setForm(f => ({...f, releaseWindow: e.target.value}))}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300" />
            <input placeholder="Display Order" type="number" value={form.displayOrder} onChange={e => setForm(f => ({...f, displayOrder: parseInt(e.target.value)}))}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300" />
          </div>
          <button onClick={() => createMut.mutate()} disabled={createMut.isPending || !form.featureName}
            className="px-5 py-2 bg-teal-500 text-white rounded-xl text-sm font-semibold hover:bg-teal-600 disabled:opacity-50 transition-colors">
            {createMut.isPending ? "Creating…" : "Create"}
          </button>
        </motion.div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {(items as any[]).map((item: any) => (
          <div key={item.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
            <div className="flex items-start justify-between">
              <h3 className="font-bold text-gray-900">{item.feature_name}</h3>
              <button onClick={() => deleteMut.mutate(item.id)} className="text-red-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
            </div>
            {item.description && <p className="text-sm text-gray-500">{item.description}</p>}
            <div className="flex items-center gap-3 text-xs text-gray-400">
              {item.release_window && <span>📅 {item.release_window}</span>}
              {item.waitlist_enabled && <span>✅ Waitlist on</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── HELPERS ────────────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-green-100 text-green-700", paid: "bg-green-100 text-green-700",
    verified: "bg-green-100 text-green-700", trial: "bg-blue-100 text-blue-700",
    pending: "bg-amber-100 text-amber-700", pending_review: "bg-amber-100 text-amber-700",
    cancelled: "bg-red-100 text-red-700", rejected: "bg-red-100 text-red-700",
    expired: "bg-gray-100 text-gray-500", issued: "bg-gray-100 text-gray-500",
  };
  return (
    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${map[status] ?? "bg-gray-100 text-gray-500"}`}>
      {status.toUpperCase().replace("_", " ")}
    </span>
  );
}
function LoadingSpin() {
  return <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" /></div>;
}
