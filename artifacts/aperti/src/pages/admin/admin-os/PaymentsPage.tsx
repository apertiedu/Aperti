import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle, XCircle, Clock, TrendingUp, DollarSign, BarChart2,
  Eye, History, AlertTriangle, X, User, CreditCard, Calendar, FileImage,
} from "lucide-react";
import { fetchJSON, postJSON } from "@/lib/api";
import { toast } from "sonner";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const STATUS_STYLES: Record<string, { cls: string; label: string }> = {
  pending:  { cls: "bg-yellow-100 text-yellow-700", label: "Pending" },
  verified: { cls: "bg-green-100 text-green-700",   label: "Verified" },
  rejected: { cls: "bg-red-100 text-red-700",       label: "Rejected" },
  refunded: { cls: "bg-gray-100 text-gray-600",     label: "Refunded" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { cls: "bg-gray-100 text-gray-600", label: status };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${s.cls}`}>{s.label}</span>;
}

function ReviewModal({ tx, onClose, onVerify, onReject }: {
  tx: any; onClose: () => void;
  onVerify: (id: number, notes: string) => void;
  onReject: (id: number, reason: string) => void;
}) {
  const [notes, setNotes] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Review Payment #{tx.id}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: User, k: "User", v: tx.displayName || tx.username },
              { icon: DollarSign, k: "Amount", v: `EGP ${tx.amount}` },
              { icon: CreditCard, k: "Reference", v: tx.referenceNumber || "—" },
              { icon: Calendar, k: "Submitted", v: new Date(tx.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) },
            ].map(({ icon: Icon, k, v }) => (
              <div key={k} className="bg-gray-50 rounded-xl p-3 flex items-start gap-2">
                <Icon className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-gray-400 text-xs">{k}</p>
                  <p className="font-semibold text-gray-900 text-sm mt-0.5 truncate">{v}</p>
                </div>
              </div>
            ))}
          </div>

          {tx.screenshotUrl && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                <FileImage className="h-3.5 w-3.5" /> Payment Screenshot
              </p>
              <a href={tx.screenshotUrl} target="_blank" rel="noopener noreferrer">
                <img src={tx.screenshotUrl} alt="Payment proof"
                  className="w-full max-h-52 object-contain rounded-xl border border-gray-200 hover:border-primary/30 transition-colors cursor-zoom-in" />
              </a>
            </div>
          )}

          {!tx.screenshotUrl && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl text-xs text-amber-700">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              No screenshot uploaded. Verify against your bank records before approving.
            </div>
          )}

          <AnimatePresence mode="wait">
            {rejecting ? (
              <motion.div key="reject-form" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Rejection reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  rows={2}
                  placeholder="e.g. Amount mismatch — received EGP 100 but plan costs EGP 149"
                  className="w-full px-3 py-2 text-sm border border-red-200 rounded-xl focus:outline-none focus:border-red-400 transition-all resize-none"
                />
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setRejecting(false)} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-700">
                    Cancel
                  </button>
                  <button
                    onClick={() => { if (rejectReason.trim()) onReject(tx.id, rejectReason.trim()); }}
                    disabled={!rejectReason.trim()}
                    className="flex-1 px-3 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
                    <XCircle className="h-4 w-4" /> Confirm Rejection
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="notes" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <label className="block text-xs font-medium text-gray-700 mb-1">Verification notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-primary/60 transition-all resize-none"
                  placeholder="Add internal notes visible only to admins…"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {!rejecting && (
          <div className="flex gap-3 px-6 pb-6">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-700">
              Cancel
            </button>
            <button onClick={() => setRejecting(true)} className="flex-1 px-4 py-2.5 text-sm bg-red-50 text-red-700 rounded-xl hover:bg-red-100 flex items-center justify-center gap-1.5">
              <XCircle className="h-4 w-4" /> Reject
            </button>
            <button
              onClick={() => onVerify(tx.id, notes)}
              className="flex-1 px-4 py-2.5 text-sm bg-green-600 text-white rounded-xl hover:bg-green-700 flex items-center justify-center gap-1.5">
              <CheckCircle className="h-4 w-4" /> Approve
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default function PaymentsPage() {
  const [tab, setTab] = useState<"queue" | "history" | "analytics">("queue");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [reviewing, setReviewing] = useState<any>(null);
  const qc = useQueryClient();

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ["admin-transactions", statusFilter],
    queryFn: () => fetchJSON(`/api/admin/payments/transactions?status=${statusFilter}&limit=50`),
    refetchInterval: 20000,
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ["secure-payments-history"],
    queryFn: () => fetchJSON("/api/secure-payments/history?limit=50"),
    enabled: tab === "history",
  });

  const { data: revenue } = useQuery({
    queryKey: ["admin-revenue"],
    queryFn: () => fetchJSON("/api/admin/payments/report"),
  });

  const { data: dashboard } = useQuery({
    queryKey: ["secure-payments-dashboard"],
    queryFn: () => fetchJSON("/api/secure-payments/dashboard"),
  });

  const verifyMutation = useMutation({
    mutationFn: ({ id, notes }: any) => postJSON("/api/admin/payments/verify", { transactionId: id, notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-transactions"] });
      qc.invalidateQueries({ queryKey: ["admin-revenue"] });
      qc.invalidateQueries({ queryKey: ["secure-payments-dashboard"] });
      toast.success("Payment approved — subscription activated");
      setReviewing(null);
    },
    onError: () => toast.error("Approval failed. Try again or check the audit log."),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: any) => postJSON("/api/admin/payments/reject", { transactionId: id, notes: reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-transactions"] });
      qc.invalidateQueries({ queryKey: ["secure-payments-dashboard"] });
      toast.success("Payment rejected — user notified");
      setReviewing(null);
    },
    onError: () => toast.error("Rejection failed. Try again."),
  });

  const transactions: any[] = (txData as any)?.transactions ?? [];
  const historyTxs: any[] = (historyData as any)?.transactions ?? [];
  const pendingCount = (dashboard as any)?.pending?.total ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payment & Revenue Center</h1>
        <p className="text-sm text-gray-500">Egypt-first: InstaPay manual verification workflow</p>
      </div>

      {/* Revenue cards */}
      {revenue && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Revenue", value: `EGP ${parseFloat(revenue.totalRevenue || 0).toLocaleString()}`, icon: DollarSign, color: "bg-primary" },
            { label: "MRR", value: `EGP ${parseFloat(revenue.mrr || 0).toLocaleString()}`, icon: TrendingUp, color: "bg-blue-500" },
            { label: "ARR (Est.)", value: `EGP ${parseFloat(revenue.arr || 0).toLocaleString()}`, icon: BarChart2, color: "bg-emerald-500" },
            { label: "Verified Txns", value: String(revenue.verifiedTransactions ?? 0), icon: CheckCircle, color: "bg-green-500" },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
              <div className={`w-10 h-10 ${c.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                <c.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{c.label}</p>
                <p className="text-lg font-bold text-gray-900">{c.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Alert: pending transactions */}
      {pendingCount > 0 && tab !== "queue" && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span><strong>{pendingCount}</strong> payment{pendingCount > 1 ? "s" : ""} waiting for review.</span>
          <button onClick={() => setTab("queue")} className="ml-auto text-xs font-semibold underline">Review now</button>
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {[
          { id: "queue", label: "Approval Queue", icon: Clock, badge: pendingCount },
          { id: "history", label: "Approval History", icon: History },
          { id: "analytics", label: "Revenue Analytics", icon: BarChart2 },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-md transition-all ${tab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
            {t.badge ? <span className="ml-1 bg-amber-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{t.badge}</span> : null}
          </button>
        ))}
      </div>

      {/* Queue Tab */}
      {tab === "queue" && (
        <>
          <div className="flex gap-2 flex-wrap">
            {["pending", "verified", "rejected", ""].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${statusFilter === s ? "bg-primary text-white border-primary" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {["#", "User", "Amount", "Method", "Reference", "Status", "Date", "Action"].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600 text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {txLoading ? (
                    <tr><td colSpan={8} className="py-12 text-center">
                      <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
                    </td></tr>
                  ) : transactions.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-16 text-gray-400">
                      <Clock className="h-8 w-8 mx-auto mb-2 text-gray-200" />
                      <p className="text-sm">No {statusFilter || ""} transactions found</p>
                    </td></tr>
                  ) : transactions.map((tx: any) => (
                    <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-400 text-xs">#{tx.id}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{tx.displayName || tx.username}</p>
                        <p className="text-xs text-gray-400">{tx.email}</p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900">EGP {tx.amount}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs capitalize">{tx.method}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{tx.referenceNumber || "—"}</td>
                      <td className="px-4 py-3"><StatusBadge status={tx.status} /></td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{new Date(tx.createdAt).toLocaleDateString("en-GB")}</td>
                      <td className="px-4 py-3">
                        {tx.status === "pending" ? (
                          <button onClick={() => setReviewing(tx)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary/8 text-primary rounded-lg hover:bg-primary/15 transition-colors font-medium">
                            <Eye className="w-3 h-3" /> Review
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* History Tab */}
      {tab === "history" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Approval History</h3>
            <p className="text-xs text-gray-400">Showing last 50 decisions</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {["#", "User", "Amount", "Reference", "Decision", "Decided By", "Date", "Notes"].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600 text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historyLoading ? (
                  <tr><td colSpan={8} className="py-12 text-center">
                    <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
                  </td></tr>
                ) : historyTxs.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-16 text-gray-400">
                    <History className="h-8 w-8 mx-auto mb-2 text-gray-200" />
                    <p className="text-sm">No approval history yet</p>
                  </td></tr>
                ) : historyTxs.map((tx: any) => (
                  <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-400 text-xs">#{tx.id}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{tx.display_name || tx.username}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">EGP {tx.amount}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{tx.reference_number || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 text-xs font-medium ${tx.status === "verified" ? "text-green-700" : "text-red-700"}`}>
                        {tx.status === "verified"
                          ? <><CheckCircle className="h-3.5 w-3.5" /> Approved</>
                          : <><XCircle className="h-3.5 w-3.5" /> Rejected</>}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {tx.approver_name || "—"}
                      {tx.approver_role && <span className="ml-1 text-gray-400">({tx.approver_role})</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {tx.decided_at ? new Date(tx.decided_at).toLocaleDateString("en-GB") : new Date(tx.created_at).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[140px] truncate" title={tx.notes || ""}>
                      {tx.notes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {tab === "analytics" && revenue && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Monthly Revenue (EGP)</h3>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={(revenue.monthly || []).map((m: any) => ({
                month: m.month?.slice(0, 7),
                revenue: parseFloat(m.total || 0),
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => [`EGP ${v}`, "Revenue"]} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="#ccfbf1" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {(dashboard as any)?.approvalStats?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Approval Activity (Last 30 Days)</h3>
              <div className="space-y-2">
                {(dashboard as any).approvalStats.map((s: any) => (
                  <div key={`${s.action}-${s.role}`} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                    <span className="text-gray-600 capitalize">{s.action} by {s.role}</span>
                    <span className="font-bold text-gray-900">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {reviewing && (
        <ReviewModal
          tx={reviewing}
          onClose={() => setReviewing(null)}
          onVerify={(id, notes) => verifyMutation.mutate({ id, notes })}
          onReject={(id, reason) => rejectMutation.mutate({ id, reason })}
        />
      )}
    </div>
  );
}
