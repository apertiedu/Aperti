import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, Clock, CheckCircle2, XCircle, PauseCircle,
  CreditCard, FileText, ChevronRight, RefreshCw, UserPlus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { AppEmptyState } from "@/components/app-empty-state";

const STATUS_META: Record<string, { label: string; desc: string; icon: any; badgeClass: string; textColor: string }> = {
  requested:            { label: "Pending Review",       desc: "Your request is being reviewed",               icon: Clock,       badgeClass: "bg-amber-100 text-amber-700 border-amber-200", textColor: "text-amber-600" },
  payment_pending:      { label: "Payment Required",     desc: "Please submit your payment to proceed",        icon: CreditCard,  badgeClass: "bg-blue-100 text-blue-700 border-blue-200",   textColor: "text-blue-600" },
  verification_pending: { label: "Payment Verification", desc: "Your payment is being verified",               icon: FileText,    badgeClass: "bg-purple-100 text-purple-700 border-purple-200", textColor: "text-purple-600" },
  approved:             { label: "Enrolled",             desc: "You are enrolled in this course",              icon: CheckCircle2,badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200", textColor: "text-emerald-600" },
  rejected:             { label: "Rejected",             desc: "Your enrollment request was not approved",     icon: XCircle,     badgeClass: "bg-red-100 text-red-700 border-red-200",       textColor: "text-red-600" },
  cancelled:            { label: "Cancelled",            desc: "This enrollment was cancelled",                icon: XCircle,     badgeClass: "bg-gray-100 text-gray-600 border-gray-200",     textColor: "text-gray-500" },
  suspended:            { label: "Suspended",            desc: "Your enrollment has been temporarily suspended",icon: PauseCircle, badgeClass: "bg-orange-100 text-orange-700 border-orange-200", textColor: "text-orange-600" },
};

type Enrollment = {
  id: number;
  status: string;
  course_id: number;
  course_title: string;
  subject?: string;
  price_egp?: string;
  thumbnail_url?: string;
  description?: string;
  teacher_name?: string;
  requested_at: string;
  updated_at?: string;
  notes?: string;
  reason?: string;
};

function formatDate(ts: string) {
  try {
    return new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return ts; }
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

export default function MyEnrollments() {
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading, refetch, isFetching } = useQuery<{ enrollments: Enrollment[] }>({
    queryKey: ["my-enrollments"],
    queryFn: () => apiFetch("/api/enrollments/my").then(r => r.json()),
    staleTime: 30000,
  });

  const all = data?.enrollments ?? [];
  const filtered = statusFilter === "all" ? all : all.filter(e => e.status === statusFilter);

  const counts: Record<string, number> = {};
  for (const e of all) counts[e.status] = (counts[e.status] ?? 0) + 1;

  const tabs = [
    { key: "all", label: "All", count: all.length },
    { key: "requested", label: "Pending", count: counts.requested ?? 0 },
    { key: "payment_pending", label: "Payment", count: counts.payment_pending ?? 0 },
    { key: "approved", label: "Enrolled", count: counts.approved ?? 0 },
    { key: "rejected", label: "Rejected", count: counts.rejected ?? 0 },
  ].filter(t => t.key === "all" || t.count > 0);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            My Enrollments
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track your enrollment requests and active courses
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Link href="/courses">
            <Button size="sm" className="gap-1.5">
              <UserPlus className="h-3.5 w-3.5" />
              Browse Courses
            </Button>
          </Link>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
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

      {/* Enrollment list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <AppEmptyState
          type="empty"
          title={statusFilter === "all" ? "No enrollments yet" : `No '${STATUS_META[statusFilter]?.label ?? statusFilter}' enrollments`}
          description={statusFilter === "all" ? "Browse courses and request enrollment to get started." : ""}
          size="md"
        />
      ) : (
        <AnimatePresence initial={false}>
          <div className="space-y-3">
            {filtered.map(enrollment => {
              const meta = STATUS_META[enrollment.status] ?? STATUS_META.requested;
              const Icon = meta.icon;
              return (
                <motion.div
                  key={enrollment.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                >
                  <Card className={`hover:border-primary/20 transition-colors ${enrollment.status === "approved" ? "border-emerald-200/60" : ""}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div className={`p-2.5 rounded-xl shrink-0 ${meta.badgeClass.split(" ").slice(0, 1).join(" ")} bg-opacity-50`}>
                          <Icon className={`h-5 w-5 ${meta.textColor}`} />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="text-sm font-semibold leading-snug">{enrollment.course_title}</h3>
                              {enrollment.teacher_name && (
                                <p className="text-xs text-muted-foreground mt-0.5">with {enrollment.teacher_name}</p>
                              )}
                            </div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border shrink-0 ${meta.badgeClass}`}>
                              {meta.label}
                            </span>
                          </div>

                          <p className="text-xs text-muted-foreground mt-1.5">{meta.desc}</p>

                          {enrollment.reason && (
                            <div className="mt-2 p-2 bg-muted/50 rounded-lg">
                              <p className="text-xs text-foreground/80">
                                <span className="font-medium">Reason: </span>{enrollment.reason}
                              </p>
                            </div>
                          )}

                          {enrollment.notes && !enrollment.reason && (
                            <div className="mt-2 p-2 bg-muted/50 rounded-lg">
                              <p className="text-xs text-foreground/80">{enrollment.notes}</p>
                            </div>
                          )}

                          <div className="flex items-center justify-between mt-3">
                            <div className="flex items-center gap-3">
                              {enrollment.price_egp && parseFloat(enrollment.price_egp) > 0 && (
                                <span className="text-xs font-medium text-foreground">
                                  EGP {parseFloat(enrollment.price_egp).toLocaleString()}
                                </span>
                              )}
                              <span className="text-[11px] text-muted-foreground">
                                Requested {formatRelative(enrollment.requested_at)}
                              </span>
                            </div>
                            {enrollment.status === "payment_pending" && (
                              <Link href={`/courses/${enrollment.course_id}`}>
                                <Button size="sm" variant="default" className="h-7 text-xs gap-1">
                                  Pay Now <ChevronRight className="h-3 w-3" />
                                </Button>
                              </Link>
                            )}
                            {enrollment.status === "approved" && (
                              <Link href={`/course-hub`}>
                                <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                                  Go to Course <ChevronRight className="h-3 w-3" />
                                </Button>
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}
