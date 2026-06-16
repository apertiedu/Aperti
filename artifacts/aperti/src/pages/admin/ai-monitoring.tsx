import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Brain, Activity, CheckCircle2, XCircle, Clock, TrendingUp,
  AlertCircle, Zap, BarChart3, DollarSign, RefreshCw, Shield,
  Eye, ThumbsUp, ThumbsDown, Edit3, Users, Layers, BookOpen,
  TrendingDown, AlertTriangle, Award, Target,
} from "lucide-react";
import { Link } from "wouter";

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

function StatusDot({ status }: { status: "healthy" | "degraded" | "down" | string }) {
  const map: Record<string, string> = {
    healthy: "bg-emerald-500",
    degraded: "bg-amber-500",
    down: "bg-rose-500",
  };
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${map[status] ?? "bg-slate-400"}`} />
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${map[status] ?? "bg-slate-400"}`} />
    </span>
  );
}

function StatCard({
  icon: Icon, label, value, sub, color = "teal",
}: {
  icon: any; label: string; value: string | number; sub?: string; color?: string;
}) {
  const colorMap: Record<string, string> = {
    teal: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400",
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
    rose: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
    violet: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  };
  return (
    <Card className="border border-border shadow-sm bg-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`p-2.5 rounded-xl ${colorMap[color] ?? colorMap.teal}`}>
            <Icon size={18} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniBar({ value, max, color = "#14b8a6" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden w-full">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

function ConfidenceTierBadge({ level }: { level: "high" | "medium" | "low" | null | undefined }) {
  if (!level) return <Badge variant="outline">N/A</Badge>;
  const map = {
    high:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    low:    "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  };
  return <Badge className={map[level]}>{level}</Badge>;
}

function ConfidenceBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) return <Badge variant="outline">N/A</Badge>;
  const pct = Math.round(score * 100);
  const cls = pct >= 85 ? "bg-emerald-100 text-emerald-700" : pct >= 65 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700";
  return <Badge className={cls}>{pct}%</Badge>;
}

export default function AiMonitoring() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"overview" | "features" | "reviews" | "governance" | "teachers">("overview");

  const { data: summary, isLoading: loadingSummary, refetch: refetchSummary } = useQuery({
    queryKey: ["admin-ai-summary"],
    queryFn: () => apiFetch("/api/admin/ai-usage/summary").then(r => r.json()),
    refetchInterval: 60000,
  });

  const { data: health, isLoading: loadingHealth } = useQuery({
    queryKey: ["admin-ai-health"],
    queryFn: () => apiFetch("/api/admin/ai-usage/health").then(r => r.json()),
    refetchInterval: 30000,
  });

  const { data: pendingReviews, isLoading: loadingReviews } = useQuery({
    queryKey: ["admin-ai-pending-reviews"],
    queryFn: () => apiFetch("/api/admin/ai-usage/pending-reviews").then(r => r.json()),
    refetchInterval: 60000,
  });

  const { data: govSummary, isLoading: loadingGov } = useQuery<any>({
    queryKey: ["ai-governance-summary"],
    queryFn: () => apiFetch("/api/ai-governance/summary").then(r => r.json()),
    enabled: activeTab === "governance" || activeTab === "overview",
    refetchInterval: 120000,
  });

  const { data: teacherStats, isLoading: loadingTeachers } = useQuery<any[]>({
    queryKey: ["ai-governance-teacher-stats"],
    queryFn: () => apiFetch("/api/ai-governance/teacher-stats").then(r => r.json()),
    enabled: activeTab === "teachers",
  });

  const { data: hardestQuestions, isLoading: loadingHardest } = useQuery<any[]>({
    queryKey: ["ai-governance-hardest-questions"],
    queryFn: () => apiFetch("/api/ai-governance/hardest-questions").then(r => r.json()),
    enabled: activeTab === "governance",
  });

  const { data: subjectConf, isLoading: loadingSubjectConf } = useQuery<any[]>({
    queryKey: ["ai-governance-subject-confidence"],
    queryFn: () => apiFetch("/api/ai-governance/subject-confidence").then(r => r.json()),
    enabled: activeTab === "governance",
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, decision, notes }: { id: number; decision: string; notes?: string }) =>
      apiFetch(`/api/snapgrade/submissions/${id}/review`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, notes }),
      }).then(r => r.json()),
    onSuccess: (data) => {
      toast({ title: "Review saved", description: data.message });
      qc.invalidateQueries({ queryKey: ["admin-ai-pending-reviews"] });
      qc.invalidateQueries({ queryKey: ["admin-ai-health"] });
    },
    onError: () => toast({ title: "Review failed", description: "Could not save review.", variant: "destructive" }),
  });

  const refreshTeacherStats = useMutation({
    mutationFn: () => apiFetch("/api/ai-governance/refresh-teacher-stats", { method: "POST" }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Teacher stats refreshed" });
      qc.invalidateQueries({ queryKey: ["ai-governance-teacher-stats"] });
    },
  });

  const total = summary?.total ?? {};
  const reliability = summary?.reliability7d ?? {};
  const overrides = summary?.teacherOverrides ?? {};
  const features: any[] = summary?.byFeature ?? [];
  const h = health ?? {};

  const statusLabel: Record<string, string> = { healthy: "Healthy", degraded: "Degraded", down: "Offline" };

  const govReviews = govSummary?.reviews ?? {};
  const govGrading = govSummary?.grading ?? {};

  const tabs = [
    { id: "overview",    label: "Overview" },
    { id: "governance",  label: "Governance" },
    { id: "teachers",    label: "Teacher Behavior" },
    { id: "features",    label: "By Feature" },
    { id: "reviews",     label: `Pending Reviews${h.pendingReviews ? ` (${h.pendingReviews})` : ""}` },
  ] as const;

  return (
    <motion.div
      className="max-w-6xl mx-auto px-4 py-8 space-y-6"
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.07 } } }}
    >
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Monitoring</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Production-grade AI governance, reliability, and teacher behavior tracking</p>
        </div>
        <div className="flex items-center gap-2">
          {!loadingHealth && h.status && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card">
              <StatusDot status={h.status} />
              <span className={`text-xs font-medium ${
                h.status === "healthy" ? "text-emerald-600" : h.status === "degraded" ? "text-amber-600" : "text-rose-600"
              }`}>{statusLabel[h.status] ?? h.status}</span>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => { refetchSummary(); qc.invalidateQueries({ queryKey: ["admin-ai-health"] }); }}>
            <RefreshCw size={14} className="mr-1.5" />
            Refresh
          </Button>
          <Link href="/admin/system-diagnostics">
            <Button variant="outline" size="sm">
              <Activity size={14} className="mr-1.5" />
              System
            </Button>
          </Link>
        </div>
      </motion.div>

      <motion.div variants={fadeUp} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={Brain}       label="Total Calls (30d)"   value={total.calls?.toLocaleString() ?? "—"} color="teal" />
        <StatCard icon={CheckCircle2} label="Success Rate"       value={total.successRate != null ? `${total.successRate}%` : "—"}
          sub="30-day window" color={total.successRate >= 95 ? "emerald" : "amber"} />
        <StatCard icon={XCircle}     label="Failures (30d)"      value={total.failures?.toLocaleString() ?? "—"} color="rose" />
        <StatCard icon={Clock}       label="Avg Latency"         value={total.avgLatencyMs ? `${total.avgLatencyMs}ms` : "—"} color="blue" />
        <StatCard icon={Shield}      label="Override Rate (30d)" value={govReviews.override_rate != null ? `${govReviews.override_rate}%` : "—"}
          sub="teacher vs AI" color={parseFloat(govReviews.override_rate ?? 0) > 30 ? "amber" : "emerald"} />
        <StatCard icon={AlertTriangle} label="Pending Reviews"   value={h.pendingReviews ?? "—"}
          sub="SnapGrade" color={h.pendingReviews > 5 ? "amber" : "teal"} />
      </motion.div>

      {!summary?.aiAvailable && (
        <motion.div variants={fadeUp} className="flex items-center gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <AlertCircle size={18} className="text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">AI service not configured</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              No AI API key detected. Set NVIDIA_API_KEY, OPENAI_API_KEY, or use the Replit AI integration. All AI features are in fallback mode.
            </p>
          </div>
          <Link href="/admin/system-diagnostics" className="ml-auto">
            <Button variant="outline" size="sm" className="shrink-0">Configure</Button>
          </Link>
        </motion.div>
      )}

      <motion.div variants={fadeUp}>
        <div className="flex gap-1 border-b border-border mb-5 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === t.id
                  ? "border-teal-600 text-teal-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <div className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-5">
              <Card className="border border-border shadow-sm bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Activity size={15} className="text-teal-600" />
                    7-Day Reliability
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {loadingSummary ? (
                    <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-4 bg-slate-100 rounded animate-pulse" />)}</div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Success rate</span>
                        <span className="text-sm font-semibold text-foreground">{reliability.success_rate_pct ?? "—"}%</span>
                      </div>
                      <MiniBar value={parseFloat(reliability.success_rate_pct ?? 0)} max={100}
                        color={parseFloat(reliability.success_rate_pct ?? 0) >= 95 ? "#10b981" : "#f59e0b"} />
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div><p className="text-xs text-muted-foreground">Total calls</p><p className="text-base font-bold text-foreground">{reliability.total_calls?.toLocaleString() ?? "—"}</p></div>
                        <div><p className="text-xs text-muted-foreground">Failures</p><p className="text-base font-bold text-rose-600">{reliability.failures ?? "—"}</p></div>
                        <div><p className="text-xs text-muted-foreground">Avg latency</p><p className="text-base font-bold text-foreground">{reliability.avg_latency_ms ? `${reliability.avg_latency_ms}ms` : "—"}</p></div>
                        <div><p className="text-xs text-muted-foreground">Slow calls (&gt;3s)</p><p className="text-base font-bold text-amber-600">{reliability.slow_rate_pct != null ? `${reliability.slow_rate_pct}%` : "—"}</p></div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="border border-border shadow-sm bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Shield size={15} className="text-teal-600" />
                    Teacher Override Stats (30d)
                  </CardTitle>
                  <CardDescription className="text-xs">SnapGrade AI grade review outcomes</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {loadingSummary ? (
                    <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-4 bg-slate-100 rounded animate-pulse" />)}</div>
                  ) : overrides.total_reviews > 0 ? (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">AI approval rate</span>
                        <span className="text-sm font-semibold text-emerald-600">{overrides.approval_rate_pct ?? "—"}%</span>
                      </div>
                      <MiniBar value={parseFloat(overrides.approval_rate_pct ?? 0)} max={100} color="#10b981" />
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        <div className="text-center"><p className="text-xs text-muted-foreground">Approved</p><p className="text-lg font-bold text-emerald-600">{overrides.approved ?? 0}</p></div>
                        <div className="text-center"><p className="text-xs text-muted-foreground">Modified</p><p className="text-lg font-bold text-amber-600">{overrides.modified ?? 0}</p></div>
                        <div className="text-center"><p className="text-xs text-muted-foreground">Rejected</p><p className="text-lg font-bold text-rose-600">{overrides.rejected ?? 0}</p></div>
                      </div>
                      <div className="pt-1 border-t border-border flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Override rate</span>
                        <span className="text-sm font-semibold text-foreground">{govReviews.override_rate != null ? `${govReviews.override_rate}%` : "—"}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <Eye size={28} className="text-slate-300 mb-2" />
                      <p className="text-sm text-muted-foreground">No teacher reviews yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="border border-border shadow-sm bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 size={15} className="text-teal-600" />
                  Daily Usage (last 30 days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingSummary ? (
                  <div className="h-20 bg-slate-100 rounded animate-pulse" />
                ) : (summary?.daily ?? []).length > 0 ? (
                  <div className="flex items-end gap-1 h-20 overflow-x-auto pb-1">
                    {(summary.daily as any[]).map((d: any) => {
                      const maxCalls = Math.max(...(summary.daily as any[]).map((x: any) => x.calls));
                      const barH = maxCalls > 0 ? Math.round((d.calls / maxCalls) * 64) : 4;
                      return (
                        <div key={d.day} className="flex flex-col items-center gap-1 shrink-0" title={`${d.day}: ${d.calls} calls`}>
                          <div className="w-3 rounded-sm" style={{ height: `${barH}px`, backgroundColor: d.failures > 0 ? "#f59e0b" : "#14b8a6" }} />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-6 text-center">No AI activity in the last 30 days</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "governance" && (
          <div className="space-y-5">
            <div className="grid sm:grid-cols-3 gap-4">
              {loadingGov ? (
                [...Array(3)].map((_, i) => <div key={i} className="h-28 bg-slate-100 rounded-xl animate-pulse" />)
              ) : (
                <>
                  <Card className="border border-border shadow-sm bg-card">
                    <CardContent className="p-4 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Override Rate (30d)</p>
                      <p className="text-2xl font-bold text-foreground">{govReviews.override_rate != null ? `${govReviews.override_rate}%` : "—"}</p>
                      <MiniBar value={parseFloat(govReviews.override_rate ?? 0)} max={100}
                        color={parseFloat(govReviews.override_rate ?? 0) > 40 ? "#f59e0b" : "#10b981"} />
                    </CardContent>
                  </Card>
                  <Card className="border border-border shadow-sm bg-card">
                    <CardContent className="p-4 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Avg Confidence at Review</p>
                      <p className="text-2xl font-bold text-foreground">
                        {govReviews.avg_confidence != null ? `${Math.round(parseFloat(govReviews.avg_confidence) * 100)}%` : "—"}
                      </p>
                      <MiniBar value={parseFloat(govReviews.avg_confidence ?? 0.5) * 100} max={100} color="#6366f1" />
                    </CardContent>
                  </Card>
                  <Card className="border border-border shadow-sm bg-card">
                    <CardContent className="p-4 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">AI Failure Rate (30d)</p>
                      <p className="text-2xl font-bold text-foreground">
                        {govGrading.failure_rate != null ? `${govGrading.failure_rate}%` : "—"}
                      </p>
                      <MiniBar value={parseFloat(govGrading.failure_rate ?? 0)} max={100}
                        color={parseFloat(govGrading.failure_rate ?? 0) > 5 ? "#ef4444" : "#10b981"} />
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <Card className="border border-border shadow-sm bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <BookOpen size={15} className="text-teal-600" />
                    Top 10 Hardest Questions
                  </CardTitle>
                  <CardDescription className="text-xs">Ranked by teacher–AI disagreement rate</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingHardest ? (
                    <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />)}</div>
                  ) : (hardestQuestions ?? []).length > 0 ? (
                    <div className="space-y-2">
                      {(hardestQuestions as any[]).map((q: any, idx: number) => (
                        <div key={q.homework_id ?? idx} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                          <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">#{idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{q.question_title ?? `Question #${q.homework_id}`}</p>
                            <p className="text-xs text-muted-foreground">{q.total_submissions} submissions · {q.overrides} overrides</p>
                          </div>
                          <Badge className={`shrink-0 text-xs ${parseFloat(q.disagreement_rate ?? 0) > 50 ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                            {q.disagreement_rate ?? 0}% disagreement
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No data yet — overrides will appear here</p>
                  )}
                </CardContent>
              </Card>

              <Card className="border border-border shadow-sm bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Target size={15} className="text-teal-600" />
                    Average Confidence by Subject
                  </CardTitle>
                  <CardDescription className="text-xs">Lower = more uncertain AI grading</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingSubjectConf ? (
                    <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />)}</div>
                  ) : (subjectConf ?? []).length > 0 ? (
                    <div className="space-y-3">
                      {(subjectConf as any[]).map((s: any) => {
                        const conf = parseFloat(s.avg_confidence ?? 0);
                        return (
                          <div key={s.subject} className="space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-medium text-foreground truncate">{s.subject}</span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-muted-foreground">{s.total_submissions} sub</span>
                                <ConfidenceBadge score={conf} />
                              </div>
                            </div>
                            <MiniBar
                              value={conf * 100}
                              max={100}
                              color={conf >= 0.85 ? "#10b981" : conf >= 0.65 ? "#f59e0b" : "#ef4444"}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No subject-level data yet</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === "teachers" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Behavioral patterns across all teachers interacting with AI grades. For system calibration only.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refreshTeacherStats.mutate()}
                disabled={refreshTeacherStats.isPending}
              >
                <RefreshCw size={13} className="mr-1.5" />
                Refresh Stats
              </Button>
            </div>

            {loadingTeachers ? (
              [...Array(5)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)
            ) : (teacherStats ?? []).length > 0 ? (
              <>
                <div className="grid sm:grid-cols-3 gap-4">
                  {[
                    {
                      label: "Most AI-Aligned Teachers",
                      icon: Award,
                      color: "emerald",
                      items: [...(teacherStats as any[])].sort((a, b) => parseFloat(a.override_rate) - parseFloat(b.override_rate)).slice(0, 3),
                      getValue: (t: any) => `${t.override_rate ?? 0}% override`,
                    },
                    {
                      label: "Most Strict Teachers",
                      icon: TrendingDown,
                      color: "amber",
                      items: [...(teacherStats as any[])].sort((a, b) => parseFloat(b.avg_delta ?? 0) - parseFloat(a.avg_delta ?? 0)).slice(0, 3),
                      getValue: (t: any) => `${t.avg_delta ?? 0} avg delta`,
                    },
                    {
                      label: "Highest Override Rate",
                      icon: TrendingUp,
                      color: "rose",
                      items: [...(teacherStats as any[])].sort((a, b) => parseFloat(b.override_rate ?? 0) - parseFloat(a.override_rate ?? 0)).slice(0, 3),
                      getValue: (t: any) => `${t.override_rate ?? 0}% override`,
                    },
                  ].map((group) => (
                    <Card key={group.label} className="border border-border shadow-sm bg-card">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-semibold flex items-center gap-2">
                          <group.icon size={14} className={`text-${group.color}-600`} />
                          {group.label}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {group.items.map((t: any) => (
                          <div key={t.teacher_id} className="flex items-center justify-between">
                            <span className="text-xs text-foreground truncate">{t.teacher_name}</span>
                            <span className="text-xs text-muted-foreground shrink-0 ml-2">{group.getValue(t)}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Card className="border border-border shadow-sm bg-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Users size={15} className="text-teal-600" />
                      All Teachers
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 text-muted-foreground font-medium">Teacher</th>
                            <th className="text-right py-2 text-muted-foreground font-medium">Reviews</th>
                            <th className="text-right py-2 text-muted-foreground font-medium">Override Rate</th>
                            <th className="text-right py-2 text-muted-foreground font-medium">Avg Delta</th>
                            <th className="text-right py-2 text-muted-foreground font-medium">Avg Confidence</th>
                            <th className="text-right py-2 text-muted-foreground font-medium">Common Reason</th>
                            <th className="text-right py-2 text-muted-foreground font-medium">Avg Latency</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(teacherStats as any[]).map((t: any) => (
                            <tr key={t.teacher_id} className="border-b border-border/50 hover:bg-muted/20">
                              <td className="py-2 font-medium text-foreground">{t.teacher_name}</td>
                              <td className="py-2 text-right text-muted-foreground">{t.total_reviews}</td>
                              <td className="py-2 text-right">
                                <span className={parseFloat(t.override_rate ?? 0) > 40 ? "text-amber-600 font-medium" : "text-foreground"}>
                                  {t.override_rate ?? 0}%
                                </span>
                              </td>
                              <td className="py-2 text-right text-muted-foreground">{t.avg_delta ?? "—"}</td>
                              <td className="py-2 text-right">
                                <ConfidenceBadge score={t.avg_confidence_overridden ? parseFloat(t.avg_confidence_overridden) : null} />
                              </td>
                              <td className="py-2 text-right text-muted-foreground truncate max-w-[140px]">{t.most_common_reason ?? "—"}</td>
                              <td className="py-2 text-right text-muted-foreground">{t.avg_review_latency_min != null ? `${t.avg_review_latency_min}m` : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <Users size={36} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No teacher review data yet</p>
                <p className="text-xs mt-1">Data appears once teachers start reviewing SnapGrade submissions</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "features" && (
          <div className="space-y-3">
            {loadingSummary ? (
              [...Array(5)].map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)
            ) : features.length > 0 ? (
              features.map((f: any) => {
                const successRate = f.calls > 0 ? Math.round(((f.calls - f.failures) / f.calls) * 100) : 100;
                return (
                  <div key={f.feature} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors">
                    <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-950/40">
                      <Layers size={15} className="text-teal-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate capitalize">{f.feature?.replace(/-/g, " ") ?? "unknown"}</p>
                      <p className="text-xs text-muted-foreground">{f.calls} calls · {f.avg_latency_ms}ms avg</p>
                    </div>
                    <div className="shrink-0 w-24">
                      <MiniBar value={f.calls - f.failures} max={f.calls} color={successRate >= 95 ? "#10b981" : successRate >= 80 ? "#f59e0b" : "#ef4444"} />
                      <p className="text-xs text-muted-foreground mt-1 text-right">{successRate}% ok</p>
                    </div>
                    {f.failures > 0 && <Badge className="bg-rose-100 text-rose-700 shrink-0">{f.failures} err</Badge>}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Brain size={36} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No feature usage data yet</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "reviews" && (
          <div className="space-y-3">
            {loadingReviews ? (
              [...Array(4)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)
            ) : (pendingReviews as any[] ?? []).length > 0 ? (
              (pendingReviews as any[]).map((r: any) => {
                const conf = r.ai_confidence != null ? parseFloat(r.ai_confidence) : null;
                const level = conf != null ? (conf >= 0.85 ? "high" : conf >= 0.65 ? "medium" : "low") : null;
                return (
                  <div key={r.id} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground truncate">
                          {r.student_name ?? "Student"} — {r.homework_title ?? "Homework"}
                        </p>
                        <ConfidenceBadge score={conf} />
                        {level && <ConfidenceTierBadge level={level as any} />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Grade: {r.grade ?? "—"} · Source: {r.ai_source ?? "unknown"} · {new Date(r.submitted_at).toLocaleDateString()}
                      </p>
                      {level === "low" && (
                        <p className="text-xs text-rose-600 mt-0.5 font-medium">Low confidence — teacher review required</p>
                      )}
                      {level === "medium" && (
                        <p className="text-xs text-amber-600 mt-0.5 font-medium">Medium confidence — soft review recommended</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="sm" variant="outline" className="gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        onClick={() => reviewMutation.mutate({ id: r.id, decision: "approved" })} disabled={reviewMutation.isPending}>
                        <ThumbsUp size={13} /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5 border-rose-200 text-rose-700 hover:bg-rose-50"
                        onClick={() => reviewMutation.mutate({ id: r.id, decision: "rejected", notes: "Manual review required" })} disabled={reviewMutation.isPending}>
                        <ThumbsDown size={13} /> Reject
                      </Button>
                      <Link href={`/teacher/snapgrade-review/${r.id}`}>
                        <Button size="sm" variant="outline" className="gap-1.5">
                          <Edit3 size={13} /> Edit
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle2 size={36} className="mx-auto mb-3 text-emerald-400" />
                <p className="text-sm font-medium text-foreground">All caught up</p>
                <p className="text-xs mt-1">No SnapGrade submissions pending teacher review</p>
              </div>
            )}
          </div>
        )}
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card className="border border-border shadow-sm bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">AI Feature Status</CardTitle>
            <CardDescription className="text-xs">Production readiness — 3-tier confidence system active</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-2">
              {[
                { name: "3-Tier Confidence System", status: "live", notes: "high ≥85% · medium ≥65% · low <65%" },
                { name: "AI Quality Score Engine", status: "live", notes: "confidence · rubric match · OCR · consistency" },
                { name: "Smart Fallback (heuristic)", status: "live", notes: "structured degraded response, never empty" },
                { name: "Teacher Override Intelligence", status: "live", notes: "reason category · tags · grade delta logged" },
                { name: "Learning Loop (ai_learning_events)", status: "live", notes: "structured log for future model improvement" },
                { name: "SnapGrade (OCR marking)", status: "live", notes: "Vision AI + Tesseract + AI Quality Score" },
                { name: "Rubric Auto-Generator", status: "live", notes: "AI-suggested rubrics, teacher approval required" },
                { name: "AI Gateway (central router)", status: "live", notes: "NVIDIA→Replit→OpenAI priority" },
                { name: "Teacher Behavior Analytics", status: "live", notes: "override rate · strictness · latency per teacher" },
                { name: "AI Teaching Assistant", status: "live", notes: "lesson · grade · analyze · copilot modules" },
              ].map((f) => (
                <div key={f.name} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30">
                  <div className={`h-2 w-2 rounded-full shrink-0 ${f.status === "live" ? "bg-emerald-500" : "bg-amber-400"}`} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{f.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{f.notes}</p>
                  </div>
                  <Badge className={`ml-auto shrink-0 text-xs ${f.status === "live" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{f.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
