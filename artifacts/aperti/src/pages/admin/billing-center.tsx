import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Receipt, FileText, CheckCircle2, AlertCircle, Clock, XCircle, Download, DollarSign, TrendingUp, Users } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:       { label: "Pending",  color: "bg-amber-100 text-amber-800 border-amber-200" },
  paid:          { label: "Paid",     color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  overdue:       { label: "Overdue",  color: "bg-red-100 text-red-800 border-red-200" },
  void:          { label: "Void",     color: "bg-gray-100 text-gray-600 border-gray-200" },
  issued:        { label: "Issued",   color: "bg-blue-100 text-blue-800 border-blue-200" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "bg-gray-100 text-gray-600 border-gray-200" };
  return <Badge className={`text-[10px] font-semibold border ${cfg.color}`}>{cfg.label}</Badge>;
}

function StatCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-gray-500 font-medium">{label}</p>
          <p className="text-xl font-black text-gray-900">{value}</p>
          {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function BillingCenter() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [markingId, setMarkingId] = useState<number | null>(null);

  const { data: invoices = [], isLoading } = useQuery<any[]>({
    queryKey: ["admin-billing-invoices"],
    queryFn: async () => {
      const r = await fetch("/api/billing/invoices", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      const j = await r.json();
      return Array.isArray(j) ? j : (j.invoices ?? []);
    },
    retry: false,
    refetchInterval: 30_000,
  });

  const { data: receipts = [] } = useQuery<any[]>({
    queryKey: ["admin-billing-receipts"],
    queryFn: async () => {
      const r = await fetch("/api/billing/receipts", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      const j = await r.json();
      return Array.isArray(j) ? j : (j.receipts ?? []);
    },
    retry: false,
  });

  const markPaidMutation = useMutation({
    mutationFn: async (invoiceId: number) => {
      const r = await fetch(`/api/billing/invoices/${invoiceId}/confirm-payment`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_method: "manual" }),
      });
      if (!r.ok) throw new Error("Failed to mark as paid");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Invoice marked as paid" });
      qc.invalidateQueries({ queryKey: ["admin-billing-invoices"] });
      qc.invalidateQueries({ queryKey: ["admin-billing-receipts"] });
      setMarkingId(null);
    },
    onError: () => {
      toast({ title: "Failed to mark invoice as paid", variant: "destructive" });
      setMarkingId(null);
    },
  });

  const totalRevenue = receipts.reduce((s: number, r: any) => s + parseFloat(r.amount_paid ?? 0), 0);
  const outstanding = invoices.filter((i: any) => i.status === "pending" || i.status === "issued").length;
  const overdue     = invoices.filter((i: any) => i.status === "overdue").length;
  const paid        = invoices.filter((i: any) => i.status === "paid").length;

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center">
            <Receipt className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Billing Center</h1>
            <p className="text-sm text-gray-500">Invoices, receipts & payment management</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={DollarSign}    label="Total Revenue"    value={`${totalRevenue.toLocaleString()} EGP`} color="bg-emerald-100 text-emerald-600" />
        <StatCard icon={Clock}         label="Outstanding"      value={outstanding}  sub="awaiting payment"      color="bg-amber-100 text-amber-600" />
        <StatCard icon={AlertCircle}   label="Overdue"          value={overdue}      sub="past due date"         color="bg-red-100 text-red-600" />
        <StatCard icon={CheckCircle2}  label="Paid"             value={paid}         sub="invoices settled"      color="bg-indigo-100 text-indigo-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-500" />
                All Invoices
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-gray-100 animate-pulse rounded-lg" />)}</div>
              ) : invoices.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">No invoices yet</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="text-xs">Invoice #</TableHead>
                      <TableHead className="text-xs">User</TableHead>
                      <TableHead className="text-xs">Amount</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.slice(0, 20).map((inv: any) => (
                      <TableRow key={inv.id} className="hover:bg-gray-50">
                        <TableCell className="text-xs font-mono text-gray-600">{inv.invoice_number ?? `#${inv.id}`}</TableCell>
                        <TableCell className="text-xs">{inv.username ?? inv.email ?? `User ${inv.user_id}`}</TableCell>
                        <TableCell className="text-xs font-semibold">{parseFloat(inv.total ?? inv.amount ?? 0).toLocaleString()} {inv.currency ?? "EGP"}</TableCell>
                        <TableCell><StatusBadge status={inv.status} /></TableCell>
                        <TableCell className="text-xs text-gray-500">{new Date(inv.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {(inv.status === "pending" || inv.status === "issued") && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[10px] px-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                              disabled={markingId === inv.id}
                              onClick={() => { setMarkingId(inv.id); markPaidMutation.mutate(inv.id); }}
                            >
                              {markingId === inv.id ? "..." : "Mark Paid"}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Download className="h-4 w-4 text-emerald-500" />
                Recent Receipts
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {receipts.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-sm">No receipts yet</div>
              ) : (
                <div className="divide-y">
                  {receipts.slice(0, 10).map((r: any) => (
                    <div key={r.id} className="px-4 py-3 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-gray-800">{r.receipt_number}</p>
                          <p className="text-[11px] text-gray-500">{r.username ?? `User ${r.user_id}`}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-emerald-700">{parseFloat(r.amount_paid).toLocaleString()} {r.currency}</p>
                          <p className="text-[10px] text-gray-400">{new Date(r.paid_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
