import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Users, Clock, CheckCircle2, XCircle, PauseCircle,
  ClipboardList, Bell, Activity, BookOpen, Zap,
  TrendingUp, AlertTriangle, ChevronRight, RefreshCw,
  UserCheck, FileText, Award,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/auth";

type OpsData = {
  enrollments: {
    pending: number; payment_pending: number; verification_pending: number;
    approved: number; rejected: number; suspended: number; total: number;
  };
  grading: { pending_marks: number; graded_not_approved: number; pending_submissions: number };
  notifications: { unread: number };
  assistants: Array<{ id: number; display_name: string; username: string; status: string; permissions: string[] }>;
  recentActivity: Array<{ id: number; action: string; description: string; actor_name: string; entity_type: string; created_at: string }>;
  recentCourseUpdates: Array<{ id: number; title: string; updated_at: string }>;
};

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

function StatCard({
  label, value, icon: Icon, color, href, sub,
}: {
  label: string; value: number; icon: any; color: string; href?: string; sub?: string;
}) {
  const card = (
    <Card className={`hover:shadow-md transition-shadow cursor-default ${href ? "cursor-pointer" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`p-2.5 rounded-xl bg-muted/60`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}

export default function TeacherOpsCenter() {
  const { user } = useAuth();
  const { data, isLoading, refetch, isFetching } = useQuery<OpsData>({
    queryKey: ["teacher-ops-dashboard"],
    queryFn: () => apiFetch("/api/teacher-ops/dashboard").then(r => r.json()),
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const { data: activityData, isLoading: activityLoading } = useQuery<{ logs: any[]; total: number }>({
    queryKey: ["teacher-ops-activity"],
    queryFn: () => apiFetch("/api/teacher-ops/activity?limit=15").then(r => r.json()),
    staleTime: 30000,
  });

  const e = data?.enrollments;
  const g = data?.grading;
  const activityLogs = activityData?.logs ?? [];

  const urgentCount = (e?.pending ?? 0) + (e?.verification_pending ?? 0) + (g?.pending_submissions ?? 0);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            Operations Center
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your daily command center — enrollments, grading, notifications, and team activity
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {urgentCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl"
        >
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-sm font-medium text-amber-800">
            {urgentCount} item{urgentCount !== 1 ? "s" : ""} need your attention today
          </p>
          <Link href="/enrollment-queue" className="ml-auto">
            <Button size="sm" variant="outline" className="text-amber-700 border-amber-300 h-7 text-xs">
              Review now <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </motion.div>
      )}

      {/* Enrollment Stats */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Users className="h-4 w-4" /> Enrollments
          </h2>
          <Link href="/enrollment-queue">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
              Manage <ChevronRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Pending Review" value={e?.pending ?? 0} icon={Clock} color="text-amber-600" href="/enrollment-queue?status=requested" sub="awaiting action" />
            <StatCard label="Payment Pending" value={e?.payment_pending ?? 0} icon={TrendingUp} color="text-blue-600" href="/enrollment-queue?status=payment_pending" />
            <StatCard label="Verification" value={e?.verification_pending ?? 0} icon={FileText} color="text-purple-600" href="/enrollment-queue?status=verification_pending" />
            <StatCard label="Approved" value={e?.approved ?? 0} icon={CheckCircle2} color="text-emerald-600" href="/enrollment-queue?status=approved" sub={`of ${e?.total ?? 0} total`} />
          </div>
        )}
      </section>

      {/* Grading + Notifications row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Grading */}
        <section className="md:col-span-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-3">
            <ClipboardList className="h-4 w-4" /> Pending Grading
          </h2>
          {isLoading ? (
            <Skeleton className="h-28 rounded-xl" />
          ) : (
            <Card>
              <CardContent className="p-4 grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-600">{g?.pending_marks ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Pending Marks</p>
                </div>
                <div className="text-center border-x border-border">
                  <p className="text-2xl font-bold text-blue-600">{g?.graded_not_approved ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Awaiting Approval</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">{g?.pending_submissions ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Submissions</p>
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Notifications */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-3">
            <Bell className="h-4 w-4" /> Notifications
          </h2>
          {isLoading ? (
            <Skeleton className="h-28 rounded-xl" />
          ) : (
            <Link href="/notifications">
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-[7rem]">
                <CardContent className="p-4 flex flex-col items-center justify-center h-full gap-1">
                  <div className="relative">
                    <Bell className="h-8 w-8 text-muted-foreground/40" />
                    {(data?.notifications.unread ?? 0) > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {data!.notifications.unread > 9 ? "9+" : data!.notifications.unread}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold">
                    {data?.notifications.unread ?? 0} unread
                  </p>
                  <p className="text-xs text-muted-foreground">Click to view all</p>
                </CardContent>
              </Card>
            </Link>
          )}
        </section>
      </div>

      {/* Activity + Assistants row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Activity Timeline */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Activity className="h-4 w-4" /> Recent Activity
            </h2>
            <Link href="/activity-timeline">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                Full log <ChevronRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
          <Card>
            <CardContent className="p-4 space-y-3">
              {activityLoading ? (
                [1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)
              ) : activityLogs.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground text-sm">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  No activity yet
                </div>
              ) : (
                activityLogs.map((log: any) => (
                  <div key={log.id} className="flex items-start gap-3 py-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground leading-snug line-clamp-2">
                        {log.description || `${log.actor_name || "Someone"} performed ${log.action}`}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{formatRelative(log.created_at)}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </section>

        {/* Assistants */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <UserCheck className="h-4 w-4" /> Assistant Team
            </h2>
            <Link href="/admin/assistant-permissions">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                Manage <ChevronRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
          <Card>
            <CardContent className="p-4 space-y-3">
              {isLoading ? (
                [1,2,3].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)
              ) : (data?.assistants.length ?? 0) === 0 ? (
                <div className="py-6 text-center text-muted-foreground text-sm">
                  <UserCheck className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  No assistants yet
                </div>
              ) : (
                data!.assistants.map(a => (
                  <div key={a.id} className="flex items-center gap-3 py-1">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                      {(a.display_name || a.username || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.display_name || a.username}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {(a.permissions || []).length} permission{(a.permissions || []).length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <Badge
                      variant={a.status === "active" ? "default" : "secondary"}
                      className="text-[10px] h-5"
                    >
                      {a.status}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Recent Course Updates */}
      {((data?.recentCourseUpdates?.length ?? 0) > 0) && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" /> Recent Course Updates
            </h2>
          </div>
          <Card>
            <CardContent className="p-4">
              <div className="divide-y divide-border">
                {data!.recentCourseUpdates.map(c => (
                  <div key={c.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-sm font-medium truncate max-w-xs">{c.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{formatRelative(c.updated_at)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
