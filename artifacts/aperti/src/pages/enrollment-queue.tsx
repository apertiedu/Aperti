import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Search, Filter, ChevronDown, ChevronRight,
  Check, X, Clock, CreditCard, FileText, AlertTriangle,
  RefreshCw, Eye, MoreHorizontal, UserPlus, PauseCircle,
  Download, History,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { AppEmptyState } from "@/components/app-empty-state";

const STATUS_META: Record<string, { label: string; color: string; icon: any; badgeClass: string }> = {
  requested:            { label: "Requested",            color: "text-amber-600",  icon: Clock,       badgeClass: "bg-amber-100 text-amber-700 border-amber-200" },
  payment_pending:      { label: "Payment Pending",      color: "text-blue-600",   icon: CreditCard,  badgeClass: "bg-blue-100 text-blue-700 border-blue-200" },
  verification_pending: { label: "Verification Pending", color: "text-purple-600", icon: FileText,    badgeClass: "bg-purple-100 text-purple-700 border-purple-200" },
  approved:             { label: "Approved",             color: "text-emerald-600",icon: Check,       badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  rejected:             { label: "Rejected",             color: "text-red-600",    icon: X,           badgeClass: "bg-red-100 text-red-700 border-red-200" },
  cancelled:            { label: "Cancelled",            color: "text-gray-500",   icon: X,           badgeClass: "bg-gray-100 text-gray-600 border-gray-200" },
  suspended:            { label: "Suspended",            color: "text-orange-600", icon: PauseCircle, badgeClass: "bg-orange-100 text-orange-700 border-orange-200" },
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  requested:            ["payment_pending", "verification_pending", "approved", "rejected", "cancelled"],
  payment_pending:      ["verification_pending", "approved", "rejected", "cancelled"],
  verification_pending: ["approved", "rejected", "cancelled"],
  approved:             ["suspended", "cancelled"],
  rejected:             ["requested"],
  cancelled:            ["requested"],
  suspended:            ["approved", "cancelled"],
};

type Enrollment = {
  id: number;
  status: string;
  course_title: string;
  course_subject?: string;
  student_name: string;
  student_email?: string;
  student_username: string;
  requested_at: string;
  updated_at?: string;
  notes?: string;
  reason?: string;
  payment_reference?: string;
  approved_by_name?: string;
};

function formatDate(ts: string) {
  try { return new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return ts; }
}

function formatRelative(ts: string) {
  try {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch { return ""; }
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, badgeClass: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${meta.badgeClass}`}>
      {meta.label}
    </span>
  );
}

type TransitionModalState = {
  enrollment: Enrollment;
  toStatus: string;
} | null;

export default function EnrollmentQueue() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [modal, setModal] = useState<TransitionModalState>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [actionReason, setActionReason] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);
  const pageSize = 20;

  const params = new URLSearchParams();
  if (statusFilter !== "all") params.set("status", statusFilter);
  if (search) params.set("search", search);
  params.set("limit", String(pageSize));
  params.set("offset", String(page * pageSize));

  const { data, isLoading, isFetching, refetch } = useQuery<{ enrollments: Enrollment[]; total: number }>({
    queryKey: ["enrollments", statusFilter, search, page],
    queryFn: () => apiFetch(`/api/enrollments?${params}`).then(r => r.json()),
    staleTime: 20000,
  });

  const { data: statsData } = useQuery<{ stats: Record<string, number>; total: number }>({
    queryKey: ["enrollment-stats"],
    queryFn: () => apiFetch("/api/enrollments/stats/summary").then(r => r.json()),
    staleTime: 30000,
  });

  const { data: detailData } = useQuery<{ enrollment: Enrollment; history: any[] }>({
    queryKey: ["enrollment-detail", detailId],
    queryFn: () => apiFetch(`/api/enrollments/${detailId}`).then(r => r.json()),
    enabled: detailId !== null,
    staleTime: 10000,
  });

  const transitionMutation = useMutation({
    mutationFn: ({ id, status, notes, reason, payment_reference }: any) =>
      apiFetch(`/api/enrollments/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes, reason, payment_reference }),
      }).then(r => r.ok ? r.json() : r.json().then((e: any) => { throw new Error(e.error); })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["enrollments"] });
      qc.invalidateQueries({ queryKey: ["enrollment-stats"] });
      qc.invalidateQueries({ queryKey: ["enrollment-detail", detailId] });
      qc.invalidateQueries({ queryKey: ["teacher-ops-dashboard"] });
      toast({ title: `Enrollment moved to '${modal?.toStatus}'` });
      setModal(null);
      setActionNotes("");
      setActionReason("");
      setPaymentRef("");
    },
    onError: (err: any) => toast({ title: err.message || "Failed to update enrollment", variant: "destructive" }),
  });

  const enrollments = data?.enrollments ?? [];
  const total = data?.total ?? 0;
  const stats = statsData?.stats ?? {};

  const quickActions = (e: Enrollment): { label: string; status: string; variant: "default" | "destructive" | "outline" }[] => {
    const transitions = VALID_TRANSITIONS[e.status] ?? [];
    const actions: { label: string; status: string; variant: "default" | "destructive" | "outline" }[] = [];
    if (transitions.includes("approved")) actions.push({ label: "Approve", status: "approved", variant: "default" });
    if (transitions.includes("rejected")) actions.push({ label: "Reject", status: "rejected", variant: "destructive" });
    if (transitions.includes("payment_pending")) actions.push({ label: "Request Payment", status: "payment_pending", variant: "outline" });
    if (transitions.includes("verification_pending")) actions.push({ label: "Verify", status: "verification_pending", variant: "outline" });
    if (transitions.includes("suspended")) actions.push({ label: "Suspend", status: "suspended", variant: "outline" });
    if (transitions.includes("cancelled")) actions.push({ label: "Cancel", status: "cancelled", variant: "outline" });
    return actions.slice(0, 3);
  };

  const openModal = (e: Enrollment, toStatus: string) => {
    setModal({ enrollment: e, toStatus });
    setActionNotes("");
    setActionReason("");
    setPaymentRef("");
  };

  const confirmTransition = () => {
    if (!modal) return;
    transitionMutation.mutate({
      id: modal.enrollment.id,
      status: modal.toStatus,
      notes: actionNotes || undefined,
      reason: actionReason || undefined,
      payment_reference: paymentRef || undefined,
    });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <UserPlus className="h-6 w-6 text-primary" />
            Enrollment Queue
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review, approve, and manage student enrollment requests
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Status summary tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "all", label: "All", count: statsData?.total ?? 0 },
          { key: "requested", label: "Requested", count: stats.requested ?? 0 },
          { key: "payment_pending", label: "Payment", count: stats.payment_pending ?? 0 },
          { key: "verification_pending", label: "Verification", count: stats.verification_pending ?? 0 },
          { key: "approved", label: "Approved", count: stats.approved ?? 0 },
          { key: "rejected", label: "Rejected", count: stats.rejected ?? 0 },
          { key: "suspended", label: "Suspended", count: stats.suspended ?? 0 },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => { setStatusFilter(tab.key); setPage(0); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
              statusFilter === tab.key
                ? "bg-primary text-white border-primary shadow-sm"
                : "bg-background text-muted-foreground border-border hover:bg-muted/50"
            }`}
          >
            {tab.label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusFilter === tab.key ? "bg-white/20" : "bg-muted"}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          placeholder="Search student or course…"
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : enrollments.length === 0 ? (
        <AppEmptyState
          type={search ? "search-no-results" : "empty"}
          searchQuery={search}
          title={search ? undefined : "No enrollments found"}
          description={search ? undefined : statusFilter !== "all" ? `No '${statusFilter}' enrollments right now.` : "No enrollment requests yet."}
          size="md"
        />
      ) : (
        <AnimatePresence initial={false}>
          <div className="space-y-2">
            {enrollments.map(enrollment => {
              const meta = STATUS_META[enrollment.status] ?? STATUS_META.requested;
              const actions = quickActions(enrollment);
              return (
                <motion.div
                  key={enrollment.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                >
                  <Card className="hover:border-primary/20 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        {/* Avatar */}
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                          {(enrollment.student_name || enrollment.student_username || "?")[0].toUpperCase()}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2 flex-wrap">
                            <span className="text-sm font-semibold">{enrollment.student_name || enrollment.student_username}</span>
                            {enrollment.student_email && (
                              <span className="text-xs text-muted-foreground">{enrollment.student_email}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs text-muted-foreground">{enrollment.course_title}</span>
                            {enrollment.course_subject && (
                              <Badge variant="outline" className="text-[10px] h-4">{enrollment.course_subject}</Badge>
                            )}
                            <StatusBadge status={enrollment.status} />
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Requested {formatRelative(enrollment.requested_at)}
                            {enrollment.approved_by_name && ` · Approved by ${enrollment.approved_by_name}`}
                          </p>
                          {enrollment.reason && (
                            <p className="text-xs text-muted-foreground mt-1 italic">"{enrollment.reason}"</p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setDetailId(detailId === enrollment.id ? null : enrollment.id)}
                            title="View detail"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {actions.map(a => (
                            <Button
                              key={a.status}
                              variant={a.variant}
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => openModal(enrollment, a.status)}
                            >
                              {a.label}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* Detail expansion */}
                      <AnimatePresence>
                        {detailId === enrollment.id && detailData && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-4 pt-4 border-t border-border">
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-4">
                                {detailData.enrollment.notes && (
                                  <div>
                                    <p className="text-xs text-muted-foreground font-medium mb-0.5">Notes</p>
                                    <p>{detailData.enrollment.notes}</p>
                                  </div>
                                )}
                                {detailData.enrollment.payment_reference && (
                                  <div>
                                    <p className="text-xs text-muted-foreground font-medium mb-0.5">Payment Ref</p>
                                    <p className="font-mono">{detailData.enrollment.payment_reference}</p>
                                  </div>
                                )}
                                {detailData.enrollment.updated_at && (
                                  <div>
                                    <p className="text-xs text-muted-foreground font-medium mb-0.5">Last Updated</p>
                                    <p>{formatDate(detailData.enrollment.updated_at)}</p>
                                  </div>
                                )}
                              </div>

                              {detailData.history && detailData.history.length > 0 && (
                                <div>
                                  <p className="text-xs text-muted-foreground font-semibold mb-2 flex items-center gap-1">
                                    <History className="h-3 w-3" /> History
                                  </p>
                                  <div className="space-y-2">
                                    {detailData.history.slice(0, 6).map((h: any) => (
                                      <div key={h.id} className="flex items-start gap-2 text-xs">
                                        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 mt-1.5 shrink-0" />
                                        <div>
                                          <span className="text-foreground/80">{h.description}</span>
                                          <span className="text-muted-foreground ml-2">{formatRelative(h.created_at)}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* All available transitions */}
                              <div className="mt-3 flex gap-2 flex-wrap">
                                {(VALID_TRANSITIONS[enrollment.status] ?? []).map(s => {
                                  const m = STATUS_META[s];
                                  return (
                                    <Button
                                      key={s}
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={() => openModal(enrollment, s)}
                                    >
                                      → {m?.label ?? s}
                                    </Button>
                                  );
                                })}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>
      )}

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={(page + 1) * pageSize >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Transition Confirmation Dialog */}
      <Dialog open={!!modal} onOpenChange={open => !open && setModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Move to '{modal ? STATUS_META[modal.toStatus]?.label ?? modal.toStatus : ""}'
            </DialogTitle>
          </DialogHeader>
          {modal && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <p className="font-medium">{modal.enrollment.student_name}</p>
                <p className="text-muted-foreground text-xs">{modal.enrollment.course_title}</p>
              </div>

              {["rejected", "suspended", "cancelled"].includes(modal.toStatus) && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Reason (shown to student)</Label>
                  <Input
                    value={actionReason}
                    onChange={e => setActionReason(e.target.value)}
                    placeholder="Explain why…"
                  />
                </div>
              )}

              {modal.toStatus === "verification_pending" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Payment Reference</Label>
                  <Input
                    value={paymentRef}
                    onChange={e => setPaymentRef(e.target.value)}
                    placeholder="e.g. INSTAPAY-123456"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Internal Notes (optional)</Label>
                <Textarea
                  value={actionNotes}
                  onChange={e => setActionNotes(e.target.value)}
                  placeholder="Any notes for your records…"
                  className="text-sm h-20 resize-none"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
            <Button
              onClick={confirmTransition}
              disabled={transitionMutation.isPending}
              variant={modal?.toStatus === "rejected" || modal?.toStatus === "cancelled" ? "destructive" : "default"}
            >
              {transitionMutation.isPending ? "Saving…" : `Confirm`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
