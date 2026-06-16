import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Clock, TrendingUp, DollarSign, BarChart2, Eye } from "lucide-react";
import { fetchJSON, postJSON } from "@/lib/api";
import { toast } from "sonner";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  verified: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  refunded: "bg-gray-100 text-gray-600",
};

function VerifyModal({ tx, onClose, onVerify, onReject }: any) {
  const [notes, setNotes] = useState("");
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Review Payment #{tx.id}</h2>
        <div className="space-y-3 mb-5 text-sm">
          <div className="grid grid-cols-2 gap-3">
            {[
              ["User", tx.displayName || tx.username],
              ["Amount", `EGP ${tx.amount}`],
              ["Method", tx.method],
              ["Reference", tx.referenceNumber || "—"],
              ["Date", new Date(tx.createdAt).toLocaleDateString()],
              ["Status", tx.status],
            ].map(([k, v]) => (
              <div key={k} className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-400 text-xs">{k}</p>
                <p className="font-medium text-gray-900 mt-0.5">{v}</p>
              </div>
            ))}
          </div>
          {tx.screenshotUrl && (
            <div>
              <p className="text-gray-500 text-xs mb-1">Payment Screenshot</p>
              <img src={tx.screenshotUrl} alt="Payment proof" className="w-full max-h-48 object-contain rounded-lg border border-gray-200" />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary/60" placeholder="Add verification notes…" />
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700">Cancel</button>
          <button onClick={() => onReject(tx.id, notes)} className="flex-1 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2">
            <XCircle className="w-4 h-4" /> Reject
          </button>
          <button onClick={() => onVerify(tx.id, notes)} className="flex-1 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2">
            <CheckCircle className="w-4 h-4" /> Verify
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function PaymentsPage() {
  const [tab, setTab] = useState<"transactions" | "analytics">("transactions");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [reviewing, setReviewing] = useState<any>(null);
  const qc = useQueryClient();

  const { data: txData } = useQuery({
    queryKey: ["admin-transactions", statusFilter],
    queryFn: () => fetchJSON(`/api/admin/payments/transactions?status=${statusFilter}&limit=50`),
    refetchInterval: 15000,
  });

  const { data: revenue } = useQuery({
    queryKey: ["admin-revenue"],
    queryFn: () => fetchJSON("/api/admin/payments/report"),
  });

  const verifyMutation = useMutation({
    mutationFn: ({ id, notes }: any) => postJSON("/api/admin/payments/verify", { transactionId: id, notes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-transactions"] }); toast.success("Payment verified"); setReviewing(null); },
    onError: () => toast.error("Verification failed"),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }: any) => postJSON("/api/admin/payments/reject", { transactionId: id, notes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-transactions"] }); toast.success("Payment rejected"); setReviewing(null); },
    onError: () => toast.error("Rejection failed"),
  });

  const transactions: any[] = (txData as any)?.transactions || [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payment & Revenue Center</h1>
        <p className="text-sm text-gray-500">Egypt-first: InstaPay & bank transfer verification</p>
      </div>

      {/* Revenue overview cards */}
      {revenue && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Revenue", value: `EGP ${parseFloat(revenue.totalRevenue || 0).toLocaleString()}`, icon: DollarSign, color: "bg-primary" },
            { label: "MRR", value: `EGP ${parseFloat(revenue.mrr || 0).toLocaleString()}`, icon: TrendingUp, color: "bg-blue-500" },
            { label: "ARR (Est.)", value: `EGP ${parseFloat(revenue.arr || 0).toLocaleString()}`, icon: BarChart2, color: "bg-emerald-500" },
            { label: "Verified Txns", value: revenue.verifiedTransactions, icon: CheckCircle, color: "bg-green-500" },
          ].map((c) => (
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

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {["transactions", "analytics"].map((t) => (
          <button key={t} onClick={() => setTab(t as any)} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {t === "transactions" ? "Payment Verification" : "Revenue Analytics"}
          </button>
        ))}
      </div>

      {tab === "transactions" && (
        <>
          <div className="flex gap-2">
            {["pending", "verified", "rejected", ""].map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${statusFilter === s ? "bg-primary text-white border-primary" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                {s || "All"}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {["#", "User", "Amount", "Method", "Reference", "Status", "Date", "Action"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-12 text-gray-400">No transactions found</td></tr>
                  ) : transactions.map((tx: any) => (
                    <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-400">#{tx.id}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{tx.displayName || tx.username}</p>
                        <p className="text-xs text-gray-400">{tx.email}</p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900">EGP {tx.amount}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs capitalize">{tx.method}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{tx.referenceNumber || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[tx.status] || "bg-gray-100 text-gray-600"}`}>{tx.status}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{new Date(tx.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        {tx.status === "pending" ? (
                          <button onClick={() => setReviewing(tx)} className="flex items-center gap-1 px-3 py-1 text-xs bg-primary/8 text-primary rounded-lg hover:bg-primary/15 transition-colors">
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

      {tab === "analytics" && revenue && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Monthly Revenue (EGP)</h3>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={(revenue.monthly || []).map((m: any) => ({ month: m.month?.slice(0, 7), revenue: parseFloat(m.total || 0) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => [`EGP ${v}`, "Revenue"]} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="#ccfbf1" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {reviewing && (
        <VerifyModal
          tx={reviewing}
          onClose={() => setReviewing(null)}
          onVerify={(id: number, notes: string) => verifyMutation.mutate({ id, notes })}
          onReject={(id: number, notes: string) => rejectMutation.mutate({ id, notes })}
        />
      )}
    </div>
  );
}
