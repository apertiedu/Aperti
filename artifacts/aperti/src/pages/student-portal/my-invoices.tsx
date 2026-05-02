import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CreditCard, CheckCircle2, Clock, AlertCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

type Invoice = {
  id: number;
  title: string;
  description: string | null;
  amount: string;
  currency: string;
  status: string;
  dueDate: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
};

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  pending: { icon: Clock, color: "text-amber-600", bg: "bg-amber-50 border-amber-100", label: "Pending Payment" },
  paid: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100", label: "Paid" },
  overdue: { icon: AlertCircle, color: "text-red-600", bg: "bg-red-50 border-red-100", label: "Overdue" },
  cancelled: { icon: XCircle, color: "text-gray-400", bg: "bg-gray-50 border-gray-100", label: "Cancelled" },
};

export default function MyInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portal/invoices", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(setInvoices)
      .catch(() => setInvoices([]))
      .finally(() => setLoading(false));
  }, []);

  const pending = invoices.filter(i => i.status === "pending").length;
  const overdue = invoices.filter(i => i.status === "overdue").length;
  const total = invoices.filter(i => i.status === "paid").reduce((a, i) => a + parseFloat(i.amount), 0);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-white/80 animate-pulse rounded-2xl w-48" />
        {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-white/80 animate-pulse rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-indigo-500" />My Invoices
        </h1>
        <p className="text-gray-500 text-sm mt-1">View your tuition invoices and payment status.</p>
      </motion.div>

      {invoices.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Pending", value: pending, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Overdue", value: overdue, color: "text-red-600", bg: "bg-red-50" },
            { label: "Total Paid", value: `${total.toFixed(0)}`, color: "text-emerald-600", bg: "bg-emerald-50" },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className={`${s.bg} rounded-2xl p-4 border border-white/80 shadow-sm`}>
              <p className="text-xs text-gray-400 font-medium">{s.label}</p>
              <p className={`text-2xl font-black mt-1 ${s.color}`}>{s.value}</p>
            </motion.div>
          ))}
        </div>
      )}

      {invoices.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-indigo-50">
          <CreditCard className="h-12 w-12 text-indigo-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No invoices yet</p>
          <p className="text-gray-300 text-sm mt-1">Your teacher will send invoices here when fees are due</p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv, i) => {
            const cfg = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.pending;
            const StatusIcon = cfg.icon;
            const isOverdue = inv.status === "pending" && inv.dueDate && inv.dueDate < new Date().toISOString().split("T")[0];
            return (
              <motion.div key={inv.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                className={`bg-white rounded-2xl p-4 shadow-sm border ${isOverdue ? "border-red-100" : "border-indigo-50"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900">{inv.title}</p>
                    {inv.description && <p className="text-sm text-gray-500 mt-0.5">{inv.description}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 flex-wrap">
                      {inv.dueDate && (
                        <span className={isOverdue ? "text-red-500 font-semibold" : ""}>
                          {isOverdue ? "⚠️ Due " : "Due "}{format(new Date(inv.dueDate + "T00:00:00"), "dd MMM yyyy")}
                        </span>
                      )}
                      {inv.paidAt && <span className="text-emerald-600">✅ Paid {format(new Date(inv.paidAt), "dd MMM yyyy")}</span>}
                      <span>Issued {format(new Date(inv.createdAt), "dd MMM yyyy")}</span>
                    </div>
                    {inv.notes && <p className="text-xs text-gray-400 mt-1.5 italic">{inv.notes}</p>}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-xl font-black text-indigo-600">{parseFloat(inv.amount).toFixed(2)}</p>
                    <p className="text-xs text-gray-400">{inv.currency}</p>
                    <div className={`inline-flex items-center gap-1.5 mt-1.5 text-xs px-2.5 py-1 rounded-full font-medium border ${cfg.bg} ${cfg.color}`}>
                      <StatusIcon className="h-3 w-3" />{cfg.label}
                    </div>
                  </div>
                </div>
                {(inv.status === "pending" || inv.status === "overdue") && (
                  <div className="mt-3 pt-3 border-t border-gray-50 text-xs text-gray-400">
                    💬 To confirm payment, contact your teacher with your payment reference number.
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
