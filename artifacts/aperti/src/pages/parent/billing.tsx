import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, FileText, CheckCircle2, Clock, XCircle } from "lucide-react";

const authFetch = (url: string) => fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem("aperti_token") || ""}` } });

function statusBadge(status: string) {
  switch ((status || "").toLowerCase()) {
    case "paid": return <Badge className="bg-emerald-100 text-emerald-700 text-[10px] rounded-full gap-1"><CheckCircle2 className="h-2.5 w-2.5" />Paid</Badge>;
    case "pending": return <Badge className="bg-amber-100 text-amber-700 text-[10px] rounded-full gap-1"><Clock className="h-2.5 w-2.5" />Pending</Badge>;
    case "overdue": return <Badge className="bg-red-100 text-red-700 text-[10px] rounded-full gap-1"><XCircle className="h-2.5 w-2.5" />Overdue</Badge>;
    default: return <Badge className="bg-gray-100 text-gray-600 text-[10px] rounded-full">{status}</Badge>;
  }
}

export default function ParentBilling() {
  const { data, isLoading } = useQuery({
    queryKey: ["parent-billing"],
    queryFn: () => authFetch("/api/parent/billing").then(r => r.json()),
  });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gray-100">
          <CreditCard className="h-5 w-5 text-gray-600" />
        </div>
        <div>
          <h1 className="text-xl font-black text-gray-900">Financial Centre</h1>
          <p className="text-sm text-gray-500">Invoices, subscriptions and payment history</p>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="space-y-3">{[0,1,2].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : (
        <>
          {/* Active subscriptions */}
          {data?.subscriptions?.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Active Plans</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {data.subscriptions.map((s: any, i: number) => (
                  <Card key={i} className="border border-teal-100 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-bold text-gray-900">{s.plan_name}</p>
                        <Badge className="bg-teal-100 text-teal-700 text-[10px] rounded-full">Active</Badge>
                      </div>
                      <p className="text-2xl font-black text-gray-900">{s.currency || "USD"} {parseFloat(s.price || "0").toFixed(2)}<span className="text-xs font-normal text-gray-400">/mo</span></p>
                      {s.student_name && <p className="text-xs text-gray-400 mt-1">For: {s.student_name}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}

          {/* Invoices */}
          {data?.invoices?.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Invoices</h2>
              <div className="space-y-2">
                {data.invoices.map((inv: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-3.5 rounded-xl border border-gray-100 bg-white">
                    <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{inv.description || `Invoice #${inv.id}`}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{inv.student_name} · {new Date(inv.created_at).toLocaleDateString("en-GB")}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-900">{inv.currency || "USD"} {parseFloat(inv.amount || "0").toFixed(2)}</p>
                      {statusBadge(inv.status)}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {!data?.subscriptions?.length && !data?.invoices?.length && (
            <div className="text-center py-16">
              <CreditCard className="h-12 w-12 mx-auto mb-3 text-gray-200" />
              <p className="text-gray-400 text-sm">No billing records found</p>
              <p className="text-[11px] text-gray-300 mt-1">Invoices and subscription details will appear here</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
