import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CreditCard, TrendingUp, Calendar, AlertCircle, CheckCircle2, Clock, XCircle, ArrowUpRight, Loader2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

async function fetchJSON(url: string) {
  const r = await fetch(url, { credentials: "include" });
  return r.json();
}
async function postJSON(url: string, body: unknown = {}) {
  const r = await fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}

const STATUS_CHIP: Record<string, { label: string; color: string; icon: React.ComponentType<any> }> = {
  active:         { label: "Active",            color: "bg-green-100 text-green-700",  icon: CheckCircle2 },
  trial:          { label: "Trial",             color: "bg-blue-100 text-blue-700",    icon: Clock },
  pending_review: { label: "Pending Review",    color: "bg-amber-100 text-amber-700",  icon: Clock },
  cancelled:      { label: "Cancelled",         color: "bg-red-100 text-red-700",      icon: XCircle },
  expired:        { label: "Expired",           color: "bg-gray-100 text-gray-500",    icon: XCircle },
};

export default function MySubscriptionPage() {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["my-subscription"],
    queryFn: () => fetchJSON("/api/commerce/my"),
  });

  const cancelMut = useMutation({
    mutationFn: () => postJSON("/api/commerce/cancel"),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-subscription"] }); toast({ title: "Subscription cancelled" }); },
  });

  if (isLoading) {
    return <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const sub = data?.subscription;
  const usage: Record<string, number> = data?.usage ?? {};
  const invoices = data?.invoices ?? [];
  const limits = sub?.limits ?? {};

  const statusMeta = STATUS_CHIP[sub?.status] ?? STATUS_CHIP.expired;
  const StatusIcon = statusMeta.icon;

  const RESOURCE_LABELS: Record<string, string> = {
    courses: "Courses", students: "Students", questions: "Questions",
    assessments: "Assessments", revision_packs: "Revision Packs",
    flashcard_sets: "Flashcard Sets", storage_gb: "Storage (GB)",
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-teal-500" /> My Subscription
        </h1>
        <Link href="/pricing">
          <button className="flex items-center gap-1.5 px-4 py-2 bg-teal-500 text-white rounded-xl text-sm font-semibold hover:bg-teal-600 transition-colors">
            <ArrowUpRight className="w-3.5 h-3.5" /> Upgrade
          </button>
        </Link>
      </div>

      {/* Current plan card */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        {sub ? (
          <>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{sub.plan_name ?? "Plan"}</h2>
                <p className="text-sm text-gray-400 capitalize">{sub.plan_type ?? ""} plan · {Number(sub.price_egp ?? 0).toLocaleString()} EGP/mo</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${statusMeta.color}`}>
                <StatusIcon className="w-3 h-3" /> {statusMeta.label}
              </span>
            </div>
            {sub.end_date && (
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-5">
                <Calendar className="w-3.5 h-3.5" />
                Renews {new Date(sub.end_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              </div>
            )}

            {/* Usage bars */}
            {Object.keys(limits).length > 0 && (
              <div className="space-y-3 mt-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Usage</p>
                {Object.entries(limits).map(([resource, limit]) => {
                  const current = usage[resource] ?? 0;
                  const pct = (limit as number) > 0 ? Math.min((current / (limit as number)) * 100, 100) : 0;
                  const isOver = current >= (limit as number);
                  return (
                    <div key={resource}>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{RESOURCE_LABELS[resource] ?? resource}</span>
                        <span className={isOver ? "text-red-500 font-semibold" : ""}>{current} / {limit as number}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${isOver ? "bg-red-400" : pct > 80 ? "bg-amber-400" : "bg-teal-400"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {sub.status === "active" && (
              <button
                onClick={() => { if (confirm("Cancel your subscription?")) cancelMut.mutate(); }}
                disabled={cancelMut.isPending}
                className="mt-6 text-xs text-red-400 hover:text-red-600 transition-colors"
              >
                {cancelMut.isPending ? "Cancelling…" : "Cancel subscription"}
              </button>
            )}
          </>
        ) : (
          <div className="text-center py-6">
            <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm mb-4">No active subscription</p>
            <Link href="/pricing">
              <button className="px-5 py-2 bg-teal-500 text-white rounded-xl text-sm font-semibold hover:bg-teal-600 transition-colors">
                View Plans
              </button>
            </Link>
          </div>
        )}
      </motion.div>

      {/* Payment requests */}
      {data?.paymentRequests?.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-bold text-gray-800 mb-4">Payment Requests</h3>
          <div className="space-y-2">
            {data.paymentRequests.map((pr: any) => (
              <div key={pr.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl text-sm">
                <div>
                  <p className="font-medium text-gray-700">{pr.plan_name}</p>
                  <p className="text-xs text-gray-400 font-mono">{pr.reference_code}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-800">{Number(pr.amount).toLocaleString()} EGP</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pr.status === "verified" ? "bg-green-100 text-green-600" : pr.status === "rejected" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"}`}>
                    {pr.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Invoice history */}
      {invoices.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-bold text-gray-800 mb-4">Invoice History</h3>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-400 border-b border-gray-100"><th className="pb-2">Plan</th><th className="pb-2">Date</th><th className="pb-2 text-right">Amount</th><th className="pb-2 text-right">Status</th></tr></thead>
            <tbody>
              {invoices.map((inv: any) => (
                <tr key={inv.id} className="border-b border-gray-50 last:border-0">
                  <td className="py-2.5 font-medium text-gray-700">{inv.plan_name}</td>
                  <td className="py-2.5 text-gray-400">{new Date(inv.issued_at).toLocaleDateString("en-GB")}</td>
                  <td className="py-2.5 text-right font-semibold">{Number(inv.amount).toLocaleString()} EGP</td>
                  <td className="py-2.5 text-right">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${inv.status === "paid" ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-500"}`}>
                      {inv.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}
    </div>
  );
}
