import { apiFetch } from "@/lib/api";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import { CreditCard, Plus, Pencil, Trash2, Search, CheckCircle2, Clock, AlertCircle, XCircle, DollarSign, TrendingUp, Users } from "lucide-react";
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
  paymentProof: string | null;
  notes: string | null;
  createdAt: string;
  studentId: number | null;
  studentName: string | null;
  studentCode: string | null;
};

type Student = { id: number; studentName: string; studentCode: string };
type Stats = { pending: number; paid: number; overdue: number; cancelled: number; pendingAmount: number; paidAmount: number };

const STATUS_STYLE: Record<string, { badge: string; icon: React.ElementType; label: string }> = {
  pending: { badge: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock, label: "Pending" },
  paid: { badge: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2, label: "Paid" },
  overdue: { badge: "bg-red-100 text-red-700 border-red-200", icon: AlertCircle, label: "Overdue" },
  cancelled: { badge: "bg-gray-100 text-gray-500 border-gray-200", icon: XCircle, label: "Cancelled" },
};

const CURRENCIES = ["USD", "EGP", "EUR", "GBP", "SAR", "AED", "KWD", "QAR"];

function InvoiceFormDialog({ mode, initial, students, onSave, trigger }: {
  mode: "create" | "edit";
  initial?: Invoice;
  students: Student[];
  onSave: (data: any) => Promise<void>;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    amount: initial?.amount ?? "",
    currency: initial?.currency ?? "USD",
    studentId: initial?.studentId?.toString() ?? "",
    dueDate: initial?.dueDate ?? "",
    notes: initial?.notes ?? "",
    status: initial?.status ?? "pending",
    paymentProof: initial?.paymentProof ?? "",
  });

  const handleOpen = (v: boolean) => {
    setOpen(v);
    if (v && initial) {
      setForm({ title: initial.title, description: initial.description ?? "", amount: initial.amount, currency: initial.currency, studentId: initial.studentId?.toString() ?? "", dueDate: initial.dueDate ?? "", notes: initial.notes ?? "", status: initial.status, paymentProof: initial.paymentProof ?? "" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ ...form, studentId: form.studentId || null });
      setOpen(false);
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{mode === "create" ? "Create Invoice" : "Edit Invoice"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input placeholder="e.g. Monthly Tuition — May 2026" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input type="number" step="0.01" min="0" placeholder="0.00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={v => setForm({ ...form, currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Student (optional)</Label>
              <Select value={form.studentId} onValueChange={v => setForm({ ...form, studentId: v })}>
                <SelectTrigger><SelectValue placeholder="All students / general" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">General invoice</SelectItem>
                  {students.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.studentName} ({s.studentCode})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
            </div>
          </div>
          {mode === "edit" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Payment Proof / Ref</Label>
                <Input placeholder="Transfer ID, receipt no..." value={form.paymentProof} onChange={e => setForm({ ...form, paymentProof: e.target.value })} />
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={2} placeholder="Optional details..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input placeholder="Internal notes..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>{saving ? "Saving..." : mode === "create" ? "Create Invoice" : "Save Changes"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Payments() {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, stuRes, statRes] = await Promise.all([
        apiFetch("/api/invoices", { credentials: "include" }),
        apiFetch("/api/students", { credentials: "include" }),
        apiFetch("/api/invoices/stats", { credentials: "include" }),
      ]);
      if (invRes.ok) setInvoices(await invRes.json());
      if (stuRes.ok) setStudents(await stuRes.json());
      if (statRes.ok) setStats(await statRes.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (data: any) => {
    const res = await apiFetch("/api/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || "Failed"); }
    toast({ title: "Invoice created" });
    load();
  };

  const handleEdit = async (id: number, data: any) => {
    const res = await apiFetch(`/api/invoices/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || "Failed"); }
    toast({ title: "Invoice updated" });
    load();
  };

  const handleMarkPaid = async (id: number) => {
    await handleEdit(id, { status: "paid" });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this invoice?")) return;
    const res = await apiFetch(`/api/invoices/${id}`, { method: "DELETE" });
    if (!res.ok) { toast({ title: "Error", variant: "destructive" }); return; }
    toast({ title: "Invoice deleted" });
    load();
  };

  const filtered = invoices.filter(inv => {
    const matchSearch = !search || inv.title.toLowerCase().includes(search.toLowerCase()) || (inv.studentName?.toLowerCase().includes(search.toLowerCase())) || (inv.studentCode?.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === "all" || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <CreditCard className="h-7 w-7 text-primary" />Payments & Invoices
          </h1>
          <p className="text-muted-foreground mt-1">Create invoices, track payments, and manage student billing.</p>
        </div>
        <InvoiceFormDialog mode="create" students={students} onSave={handleCreate}
          trigger={<Button className="gap-2"><Plus className="h-4 w-4" />New Invoice</Button>} />
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Pending", value: stats.pending, sub: `${stats.pendingAmount.toFixed(2)} total`, color: "text-amber-600", bg: "bg-amber-50 border-amber-100" },
            { label: "Paid", value: stats.paid, sub: `${stats.paidAmount.toFixed(2)} collected`, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
            { label: "Overdue", value: stats.overdue, sub: "needs attention", color: "text-red-600", bg: "bg-red-50 border-red-100" },
            { label: "Cancelled", value: stats.cancelled, sub: "voided invoices", color: "text-gray-500", bg: "bg-gray-50 border-gray-100" },
          ].map(s => (
            <Card key={s.label} className={`border ${s.bg}`}>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <CardTitle className="text-base flex items-center gap-2 flex-1">
              <CreditCard className="h-4 w-4 text-primary" />All Invoices
            </CardTitle>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-52">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Search..." className="pl-8 h-8 text-sm bg-muted/50 border-none" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading invoices...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <CreditCard className="h-10 w-10 text-muted-foreground opacity-20 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">{search || statusFilter !== "all" ? "No matching invoices." : "No invoices yet. Create your first invoice above."}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Title</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {filtered.map((inv, i) => {
                      const s = STATUS_STYLE[inv.status] ?? STATUS_STYLE.pending;
                      const StatusIcon = s.icon;
                      return (
                        <motion.tr key={inv.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.02 }}
                          className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                          <TableCell>
                            <p className="font-medium text-sm">{inv.title}</p>
                            {inv.description && <p className="text-xs text-muted-foreground truncate max-w-48">{inv.description}</p>}
                          </TableCell>
                          <TableCell>
                            {inv.studentName ? (
                              <div>
                                <p className="text-sm font-medium">{inv.studentName}</p>
                                <p className="text-xs font-mono text-muted-foreground">{inv.studentCode}</p>
                              </div>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="font-semibold text-primary">{parseFloat(inv.amount).toFixed(2)} {inv.currency}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {inv.dueDate ? format(new Date(inv.dueDate + "T00:00:00"), "dd MMM yyyy") : "—"}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border ${s.badge}`}>
                              <StatusIcon className="h-3 w-3" />{s.label}
                            </span>
                            {inv.paidAt && <p className="text-[10px] text-muted-foreground mt-0.5">{format(new Date(inv.paidAt), "dd MMM")}</p>}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{format(new Date(inv.createdAt), "dd MMM yyyy")}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {inv.status === "pending" && (
                                <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-600 hover:bg-emerald-50 px-2" onClick={() => handleMarkPaid(inv.id)}>
                                  <CheckCircle2 className="h-3 w-3 mr-1" />Mark Paid
                                </Button>
                              )}
                              <InvoiceFormDialog mode="edit" initial={inv} students={students} onSave={(data) => handleEdit(inv.id, data)}
                                trigger={<Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary"><Pencil className="h-3 w-3" /></Button>} />
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(inv.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
