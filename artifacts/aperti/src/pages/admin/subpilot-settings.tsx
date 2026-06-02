import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CheckCircle, XCircle, Settings, Clock, Tag, Package, Trash2, Plus,
  Edit2, Check, X, Percent, Calendar,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = "/api";
const token = () => localStorage.getItem("aperti_token");

async function fetchJSON(url: string, options?: RequestInit) {
  const res = await fetch(`${API}${url}`, {
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(options?.headers as object) },
    ...options,
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  pending_review: "bg-amber-100 text-amber-700",
  cancelled: "bg-red-100 text-red-600",
  pending: "bg-slate-100 text-slate-600",
};

const TABS = ["Subscriptions", "Plans", "Coupons"] as const;
type Tab = typeof TABS[number];

function InlineEdit({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  if (!editing) return (
    <span className="cursor-pointer hover:underline text-sm" onClick={() => setEditing(true)}>{value}</span>
  );
  return (
    <span className="flex items-center gap-1">
      <input value={val} onChange={e => setVal(e.target.value)} autoFocus className="border rounded px-1 py-0.5 text-xs w-28" />
      <button onClick={() => { onSave(val); setEditing(false); }} className="text-green-600"><Check className="h-3.5 w-3.5" /></button>
      <button onClick={() => setEditing(false)} className="text-gray-400"><X className="h-3.5 w-3.5" /></button>
    </span>
  );
}

export default function SubPilotAdmin() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("Subscriptions");
  const [processing, setProcessing] = useState<number | null>(null);

  // ─── Subscriptions ───
  const { data: subs, isLoading: subsLoading } = useQuery({
    queryKey: ["admin", "subscriptions"],
    queryFn: () => fetchJSON("/subscriptions/admin/all"),
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => fetchJSON(`/subscriptions/admin/${id}/approve`, { method: "PUT" }),
    onMutate: (id) => setProcessing(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] }); toast({ title: "Subscription approved" }); setProcessing(null); },
    onError: () => { toast({ title: "Failed to approve", variant: "destructive" }); setProcessing(null); },
  });
  const rejectMutation = useMutation({
    mutationFn: (id: number) => fetchJSON(`/subscriptions/admin/${id}/reject`, { method: "PUT" }),
    onMutate: (id) => setProcessing(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] }); toast({ title: "Subscription rejected" }); setProcessing(null); },
    onError: () => { toast({ title: "Failed to reject", variant: "destructive" }); setProcessing(null); },
  });

  // ─── Plans ───
  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ["admin", "plans"],
    queryFn: () => fetchJSON("/subscriptions/plans"),
    enabled: activeTab === "Plans",
  });

  const [newPlan, setNewPlan] = useState({ name: "", type: "teacher", priceEgp: "", studentLimit: "", features: "" });
  const [showNewPlan, setShowNewPlan] = useState(false);

  const createPlanMutation = useMutation({
    mutationFn: () => fetchJSON("/subscriptions/admin/plans", {
      method: "POST",
      body: JSON.stringify({
        name: newPlan.name,
        type: newPlan.type,
        priceEgp: newPlan.priceEgp,
        studentLimit: newPlan.studentLimit ? parseInt(newPlan.studentLimit) : null,
        features: newPlan.features ? newPlan.features.split(",").map(f => f.trim()).filter(Boolean) : [],
      }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "plans"] });
      toast({ title: "Plan created" });
      setNewPlan({ name: "", type: "teacher", priceEgp: "", studentLimit: "", features: "" });
      setShowNewPlan(false);
    },
    onError: () => toast({ title: "Failed to create plan", variant: "destructive" }),
  });

  const updatePlanMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      fetchJSON(`/subscriptions/admin/plans/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin", "plans"] }); toast({ title: "Plan updated" }); },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const deletePlanMutation = useMutation({
    mutationFn: (id: number) => fetchJSON(`/subscriptions/admin/plans/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin", "plans"] }); toast({ title: "Plan deleted" }); },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  // ─── Coupons ───
  const { data: coupons, isLoading: couponsLoading } = useQuery({
    queryKey: ["admin", "coupons"],
    queryFn: () => fetchJSON("/coupons"),
    enabled: activeTab === "Coupons",
  });

  const [newCoupon, setNewCoupon] = useState({ code: "", discountPercent: "", maxUses: "", expiryDate: "" });
  const [showNewCoupon, setShowNewCoupon] = useState(false);

  const createCouponMutation = useMutation({
    mutationFn: () => fetchJSON("/coupons", {
      method: "POST",
      body: JSON.stringify({
        code: newCoupon.code.toUpperCase().trim(),
        discountPercent: parseFloat(newCoupon.discountPercent),
        maxUses: newCoupon.maxUses ? parseInt(newCoupon.maxUses) : null,
        expiryDate: newCoupon.expiryDate || null,
      }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "coupons"] });
      toast({ title: "Coupon created" });
      setNewCoupon({ code: "", discountPercent: "", maxUses: "", expiryDate: "" });
      setShowNewCoupon(false);
    },
    onError: (e: any) => toast({ title: e.message || "Failed to create coupon", variant: "destructive" }),
  });

  const toggleCouponMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      fetchJSON(`/coupons/${id}`, { method: "PUT", body: JSON.stringify({ isActive }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin", "coupons"] }); toast({ title: "Coupon updated" }); },
    onError: () => toast({ title: "Failed", variant: "destructive" }),
  });

  const deleteCouponMutation = useMutation({
    mutationFn: (id: number) => fetchJSON(`/coupons/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin", "coupons"] }); toast({ title: "Coupon deleted" }); },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const pending = subs?.filter((s: any) => s.status === "pending_review") ?? [];

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">SubPilot Admin</h1>
            <p className="text-sm text-gray-500">Manage subscriptions, plans, and discount coupons</p>
          </div>
          {pending.length > 0 && (
            <Badge className="ml-2 bg-amber-100 text-amber-700 border-0">{pending.length} pending</Badge>
          )}
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1 mb-6 w-fit">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab ? "bg-[#00796B] text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}>
            {tab}
            {tab === "Subscriptions" && pending.length > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">{pending.length}</span>
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">

        {/* ── SUBSCRIPTIONS TAB ── */}
        {activeTab === "Subscriptions" && (
          <motion.div key="subs" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {pending.length > 0 && (
              <Card className="border-0 shadow-sm border-l-4 border-l-amber-400 mb-5">
                <CardHeader className="border-b pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-500" /> Awaiting Approval ({pending.length})
                  </CardTitle>
                  <CardDescription>These InstaPay transactions need manual review before the subscription activates.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>InstaPay Code</TableHead>
                        <TableHead>Coupon</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pending.map((sub: any) => (
                        <TableRow key={sub.id} className="bg-amber-50/30">
                          <TableCell className="font-medium text-sm">#{sub.accountId}</TableCell>
                          <TableCell className="text-sm">{sub.plan?.name ?? "—"}</TableCell>
                          <TableCell><code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">{sub.instaPayCode || "—"}</code></TableCell>
                          <TableCell>
                            {sub.couponId ? <Badge className="bg-green-100 text-green-700 border-0 text-xs">Coupon #{sub.couponId}</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{sub.startDate ? new Date(sub.startDate).toLocaleDateString() : "—"}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" className="h-8 bg-[#00796B] hover:bg-[#00695C] text-white text-xs gap-1.5" onClick={() => approveMutation.mutate(sub.id)} disabled={processing === sub.id}>
                                <CheckCircle className="h-3.5 w-3.5" /> Approve
                              </Button>
                              <Button size="sm" variant="outline" className="h-8 text-red-600 border-red-200 hover:bg-red-50 text-xs gap-1.5" onClick={() => rejectMutation.mutate(sub.id)} disabled={processing === sub.id}>
                                <XCircle className="h-3.5 w-3.5" /> Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            <Card className="border-0 shadow-sm">
              <CardHeader className="border-b pb-4"><CardTitle className="text-base">All Subscriptions</CardTitle></CardHeader>
              <CardContent className="p-0">
                {subsLoading ? (
                  <div className="p-6 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
                ) : !subs?.length ? (
                  <div className="p-10 text-center text-sm text-muted-foreground">No subscriptions yet.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>InstaPay</TableHead>
                        <TableHead>Screenshot</TableHead>
                        <TableHead>Since</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subs.map((sub: any) => (
                        <TableRow key={sub.id}>
                          <TableCell className="text-sm font-medium">#{sub.accountId}</TableCell>
                          <TableCell className="text-sm">{sub.plan?.name ?? "—"}</TableCell>
                          <TableCell>
                            <Badge className={`text-xs border-0 ${STATUS_COLORS[sub.status] ?? "bg-gray-100 text-gray-600"}`}>
                              {sub.status.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell><code className="text-xs text-muted-foreground font-mono">{sub.instaPayCode || "—"}</code></TableCell>
                          <TableCell>
                            {sub.screenshotUrl
                              ? <a href={sub.screenshotUrl} target="_blank" rel="noopener" className="text-xs text-[#00796B] underline">View</a>
                              : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{sub.startDate ? new Date(sub.startDate).toLocaleDateString() : "—"}</TableCell>
                          <TableCell>
                            {sub.status === "pending_review" && (
                              <div className="flex gap-1.5">
                                <Button size="sm" className="h-7 text-xs bg-[#00796B] text-white hover:bg-[#00695C]" onClick={() => approveMutation.mutate(sub.id)} disabled={processing === sub.id}>Approve</Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={() => rejectMutation.mutate(sub.id)} disabled={processing === sub.id}>Reject</Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── PLANS TAB ── */}
        {activeTab === "Plans" && (
          <motion.div key="plans" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="border-0 shadow-sm mb-4">
              <CardHeader className="border-b pb-4 flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4 text-[#00796B]" />Subscription Plans</CardTitle>
                  <CardDescription>Manage pricing plans available to teachers.</CardDescription>
                </div>
                <Button size="sm" className="bg-[#00796B] hover:bg-[#00695C] text-white gap-1.5" onClick={() => setShowNewPlan(v => !v)}>
                  <Plus className="h-3.5 w-3.5" /> New Plan
                </Button>
              </CardHeader>

              {/* New plan form */}
              <AnimatePresence>
                {showNewPlan && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-b">
                    <div className="p-5 bg-gray-50 grid grid-cols-2 gap-3">
                      <input placeholder="Plan name *" value={newPlan.name} onChange={e => setNewPlan(p => ({ ...p, name: e.target.value }))}
                        className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#00796B] col-span-2" />
                      <input placeholder="Price (EGP) *" value={newPlan.priceEgp} onChange={e => setNewPlan(p => ({ ...p, priceEgp: e.target.value }))}
                        className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#00796B]" />
                      <input placeholder="Student limit (blank = unlimited)" value={newPlan.studentLimit} onChange={e => setNewPlan(p => ({ ...p, studentLimit: e.target.value }))}
                        className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#00796B]" />
                      <select value={newPlan.type} onChange={e => setNewPlan(p => ({ ...p, type: e.target.value }))}
                        className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#00796B]">
                        <option value="teacher">Teacher</option>
                        <option value="student">Student</option>
                      </select>
                      <input placeholder="Features (comma-separated)" value={newPlan.features} onChange={e => setNewPlan(p => ({ ...p, features: e.target.value }))}
                        className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#00796B]" />
                      <div className="col-span-2 flex gap-2 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setShowNewPlan(false)}>Cancel</Button>
                        <Button size="sm" className="bg-[#00796B] text-white" onClick={() => createPlanMutation.mutate()} disabled={!newPlan.name || !newPlan.priceEgp || createPlanMutation.isPending}>
                          {createPlanMutation.isPending ? "Creating…" : "Create Plan"}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <CardContent className="p-0">
                {plansLoading ? (
                  <div className="p-6 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : !plans?.length ? (
                  <div className="p-10 text-center text-sm text-muted-foreground">No plans yet. Create your first plan above.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Price (EGP)</TableHead>
                        <TableHead>Student Limit</TableHead>
                        <TableHead>Active</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plans.map((plan: any) => (
                        <TableRow key={plan.id}>
                          <TableCell className="font-medium">
                            <InlineEdit value={plan.name} onSave={v => updatePlanMutation.mutate({ id: plan.id, data: { name: v } })} />
                          </TableCell>
                          <TableCell><Badge className="text-xs bg-blue-100 text-blue-700 border-0">{plan.type}</Badge></TableCell>
                          <TableCell>
                            <InlineEdit value={String(plan.priceEgp)} onSave={v => updatePlanMutation.mutate({ id: plan.id, data: { priceEgp: v } })} />
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{plan.studentLimit ?? "Unlimited"}</TableCell>
                          <TableCell>
                            <button onClick={() => updatePlanMutation.mutate({ id: plan.id, data: { isActive: !plan.isActive } })}
                              className={`relative w-9 h-5 rounded-full transition-all ${plan.isActive !== false ? "bg-[#00796B]" : "bg-gray-200"}`}>
                              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${plan.isActive !== false ? "left-4" : "left-0.5"}`} />
                            </button>
                          </TableCell>
                          <TableCell>
                            <button onClick={() => { if(confirm("Delete this plan?")) deletePlanMutation.mutate(plan.id); }}
                              className="text-gray-300 hover:text-red-400 transition-colors p-1">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── COUPONS TAB ── */}
        {activeTab === "Coupons" && (
          <motion.div key="coupons" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="border-0 shadow-sm">
              <CardHeader className="border-b pb-4 flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2"><Tag className="h-4 w-4 text-[#00796B]" />Discount Coupons</CardTitle>
                  <CardDescription>Create and manage coupon codes for subscription discounts.</CardDescription>
                </div>
                <Button size="sm" className="bg-[#00796B] hover:bg-[#00695C] text-white gap-1.5" onClick={() => setShowNewCoupon(v => !v)}>
                  <Plus className="h-3.5 w-3.5" /> New Coupon
                </Button>
              </CardHeader>

              <AnimatePresence>
                {showNewCoupon && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-b">
                    <div className="p-5 bg-gray-50 grid grid-cols-2 gap-3">
                      <input placeholder="COUPON CODE *" value={newCoupon.code} onChange={e => setNewCoupon(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                        className="border rounded-xl px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:border-[#00796B]" />
                      <div className="relative">
                        <Percent className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <input placeholder="Discount % *" value={newCoupon.discountPercent} onChange={e => setNewCoupon(p => ({ ...p, discountPercent: e.target.value }))}
                          className="w-full border rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-[#00796B]" />
                      </div>
                      <input placeholder="Max uses (blank = unlimited)" value={newCoupon.maxUses} onChange={e => setNewCoupon(p => ({ ...p, maxUses: e.target.value }))}
                        className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#00796B]" />
                      <div className="relative">
                        <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <input type="date" value={newCoupon.expiryDate} onChange={e => setNewCoupon(p => ({ ...p, expiryDate: e.target.value }))}
                          className="w-full border rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-[#00796B]" />
                      </div>
                      <div className="col-span-2 flex gap-2 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setShowNewCoupon(false)}>Cancel</Button>
                        <Button size="sm" className="bg-[#00796B] text-white" onClick={() => createCouponMutation.mutate()}
                          disabled={!newCoupon.code || !newCoupon.discountPercent || createCouponMutation.isPending}>
                          {createCouponMutation.isPending ? "Creating…" : "Create Coupon"}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <CardContent className="p-0">
                {couponsLoading ? (
                  <div className="p-6 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : !coupons?.length ? (
                  <div className="p-10 text-center text-sm text-muted-foreground">No coupons yet. Create your first discount code above.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Discount</TableHead>
                        <TableHead>Uses</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Active</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {coupons.map((c: any) => (
                        <TableRow key={c.id}>
                          <TableCell>
                            <code className="font-mono text-sm font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">{c.code}</code>
                          </TableCell>
                          <TableCell>
                            <span className="font-bold" style={{ color: "#00796B" }}>{c.discountPercent}%</span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {c.usedCount}{c.maxUses ? ` / ${c.maxUses}` : " / ∞"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {c.expiryDate ? new Date(c.expiryDate).toLocaleDateString() : "Never"}
                          </TableCell>
                          <TableCell>
                            <button onClick={() => toggleCouponMutation.mutate({ id: c.id, isActive: !c.isActive })}
                              className={`relative w-9 h-5 rounded-full transition-all ${c.isActive ? "bg-[#00796B]" : "bg-gray-200"}`}>
                              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${c.isActive ? "left-4" : "left-0.5"}`} />
                            </button>
                          </TableCell>
                          <TableCell>
                            <button onClick={() => { if(confirm("Delete this coupon?")) deleteCouponMutation.mutate(c.id); }}
                              className="text-gray-300 hover:text-red-400 transition-colors p-1">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
