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
  Eye, ThumbsUp, ThumbsDown, Edit3, Users, Layers,
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
  icon: Icon, label, value, sub, color = "teal", trend,
}: {
  icon: any; label: string; value: string | number; sub?: string;
  color?: string; trend?: "up" | "down" | "neutral";
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

function ConfidenceBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) return <Badge variant="outline">N/A</Badge>;
  const pct = Math.round(score * 100);
  const cls = pct >= 80 ? "bg-emerald-100 text-emerald-700" : pct >= 60 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700";
  return <Badge className={cls}>{pct}%</Badge>;
}

export default function AiMonitoring() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"overview" | "features" | "reviews">("overview");

  const { data: summary, isLoading: loadingSummary, refetch: refetchSummary } = useQuery({
    queryKey: ["admin-ai-summary"],
    queryFn: async () => {
      const res = await apiFetch("/api/admin/ai-usage/summary");
      return res.json();
    },
    refetchInterval: 60000,
  });

  const { data: health, isLoading: loadingHealth } = useQuery({
    queryKey: ["admin-ai-health"],
    queryFn: async () => {
      const res = await apiFetch("/api/admin/ai-usage/health");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: pendingReviews, isLoading: loadingReviews } = useQuery({
    queryKey: ["admin-ai-pending-reviews"],
    queryFn: async () => {
      const res = await apiFetch("/api/admin/ai-usage/pending-reviews");
      return res.json();
    },
    refetchInterval: 60000,
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, decision, notes }: { id: number; decision: string; notes?: string }) => {
      const res = await apiFetch(`/api/snapgrade/submissions/${id}/review`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, notes }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Review saved", description: data.message });
      qc.invalidateQueries({ queryKey: ["admin-ai-pending-reviews"] });
      qc.invalidateQueries({ queryKey: ["admin-ai-health"] });
    },
    onError: () => toast({ title: "Review failed", description: "Could not save review.", variant: "destructive" }),
  });

  const total = summary?.total ?? {};
  const reliability = summary?.reliability7d ?? {};
  const overrides = summary?.teacherOverrides ?? {};
  const features: any[] = summary?.byFeature ?? [];
  const h = health ?? {};

  const statusLabel: Record<string, string> = { healthy: "Healthy", degraded: "Degraded", down: "Offline" };
  const statusBadge: Record<string, string> = {
    healthy: "bg-emerald-100 text-emerald-700",
    degraded: "bg-amber-100 text-amber-700",
    down: "bg-rose-100 text-rose-700",
  };

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "features", label: "By Feature" },
    { id: "reviews", label: `Pending Reviews${h.pendingReviews ? ` (${h.pendingReviews})` : ""}` },
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
          <p className="text-sm text-muted-foreground mt-0.5">Reliability, usage, and teacher override tracking for all AI features</p>
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
        <StatCard icon={Brain} label="Total Calls (30d)" value={total.calls?.toLocaleString() ?? "—"} color="teal" />
        <StatCard icon={CheckCircle2} label="Success Rate" value={total.successRate != null ? `${total.successRate}%` : "—"}
          sub="30-day window" color={total.successRate >= 95 ? "emerald" : "amber"} />
        <StatCard icon={XCircle} label="Failures (30d)" value={total.failures?.toLocaleString() ?? "—"} color="rose" />
        <StatCard icon={Clock} label="Avg Latency" value={total.avgLatencyMs ? `${total.avgLatencyMs}ms` : "—"} color="blue" />
        <StatCard icon={DollarSign} label="Est. Cost (30d)" value={total.estimatedCostUSD != null ? `$${parseFloat(total.estimatedCostUSD).toFixed(4)}` : "—"} color="violet" />
        <StatCard icon={Shield} label="Pending Reviews" value={h.pendingReviews ?? "—"}
          sub="SnapGrade submissions" color={h.pendingReviews > 5 ? "amber" : "teal"} />
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
        <div className="flex gap-1 border-b border-border mb-5">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
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
                        <div>
                          <p className="text-xs text-muted-foreground">Total calls</p>
                          <p className="text-base font-bold text-foreground">{reliability.total_calls?.toLocaleString() ?? "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Failures</p>
                          <p className="text-base font-bold text-rose-600">{reliability.failures ?? "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Avg latency</p>
                          <p className="text-base font-bold text-foreground">{reliability.avg_latency_ms ? `${reliability.avg_latency_ms}ms` : "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Slow calls (&gt;3s)</p>
                          <p className="text-base font-bold text-amber-600">{reliability.slow_rate_pct != null ? `${reliability.slow_rate_pct}%` : "—"}</p>
                        </div>
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
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Approved</p>
                          <p className="text-lg font-bold text-emerald-600">{overrides.approved ?? 0}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Modified</p>
                          <p className="text-lg font-bold text-amber-600">{overrides.modified ?? 0}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Rejected</p>
                          <p className="text-lg font-bold text-rose-600">{overrides.rejected ?? 0}</p>
                        </div>
                      </div>
                      <div className="pt-1 border-t border-border">
                        <p className="text-xs text-muted-foreground">Avg AI confidence at review</p>
                        <p className="text-sm font-semibold text-foreground">
                          {overrides.avg_ai_confidence != null ? `${Math.round(overrides.avg_ai_confidence * 100)}%` : "—"}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <Eye size={28} className="text-slate-300 mb-2" />
                      <p className="text-sm text-muted-foreground">No teacher reviews yet</p>
                      <p className="text-xs text-muted-foreground mt-1">Reviews appear here after teachers approve or override AI grades</p>
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
                      const h = maxCalls > 0 ? Math.round((d.calls / maxCalls) * 64) : 4;
                      const hasFailures = d.failures > 0;
                      return (
                        <div key={d.day} className="flex flex-col items-center gap-1 shrink-0" title={`${d.day}: ${d.calls} calls${hasFailures ? `, ${d.failures} failures` : ""}`}>
                          <div className="w-3 rounded-sm" style={{
                            height: `${h}px`,
                            backgroundColor: hasFailures ? "#f59e0b" : "#14b8a6",
                          }} />
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

        {activeTab === "features" && (
          <div className="space-y-3">
            {loadingSummary ? (
              [...Array(5)].map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)
            ) : features.length > 0 ? (
              features.map((f: any) => {
                const successRate = f.calls > 0
                  ? Math.round(((f.calls - f.failures) / f.calls) * 100)
                  : 100;
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
                      <MiniBar
                        value={f.calls - f.failures}
                        max={f.calls}
                        color={successRate >= 95 ? "#10b981" : successRate >= 80 ? "#f59e0b" : "#ef4444"}
                      />
                      <p className="text-xs text-muted-foreground mt-1 text-right">{successRate}% ok</p>
                    </div>
                    {f.failures > 0 && (
                      <Badge className="bg-rose-100 text-rose-700 shrink-0">{f.failures} err</Badge>
                    )}
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
              (pendingReviews as any[]).map((r: any) => (
                <div key={r.id} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">
                        {r.student_name ?? "Student"} — {r.homework_title ?? "Homework"}
                      </p>
                      <ConfidenceBadge score={r.ai_confidence} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Grade: {r.grade ?? "—"} · Source: {r.ai_source ?? "unknown"} · {new Date(r.submitted_at).toLocaleDateString()}
                    </p>
                    {(r.ai_confidence === null || r.ai_confidence < 0.65) && (
                      <p className="text-xs text-amber-600 mt-0.5 font-medium">Low confidence — teacher review required</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                      onClick={() => reviewMutation.mutate({ id: r.id, decision: "approved" })}
                      disabled={reviewMutation.isPending}
                    >
                      <ThumbsUp size={13} />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-rose-200 text-rose-700 hover:bg-rose-50"
                      onClick={() => reviewMutation.mutate({ id: r.id, decision: "rejected", notes: "Manual review required" })}
                      disabled={reviewMutation.isPending}
                    >
                      <ThumbsDown size={13} />
                      Reject
                    </Button>
                    <Link href={`/teacher/snapgrade-review/${r.id}`}>
                      <Button size="sm" variant="outline" className="gap-1.5">
                        <Edit3 size={13} />
                        Edit
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
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
            <CardDescription className="text-xs">Production readiness across all AI-powered features</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-2">
              {[
                { name: "AI Gateway (central router)", status: "live", notes: "NVIDIA→Replit→OpenAI priority" },
                { name: "TutorCraft (teacher assistant)", status: "live", notes: "Real AI + rule-based fallback" },
                { name: "Mentor (student tutor)", status: "live", notes: "CoreMind enhanced, safety checked" },
                { name: "SnapGrade (OCR marking)", status: "live", notes: "Vision AI + Tesseract fallback" },
                { name: "AI Agents (multi-agent)", status: "live", notes: "Teacher/Student/Admin agents" },
                { name: "Assessment AI Grading", status: "live", notes: "Written answers, manual override" },
                { name: "Parent AI Assistant", status: "live", notes: "CoreMind backed, fallback mode" },
                { name: "Revision Plan Generator", status: "live", notes: "Echo memory + AI scheduling" },
                { name: "AI Feedback Engine", status: "live", notes: "IGCSE/A-Level structured feedback" },
                { name: "Flashcard AI Generation", status: "live", notes: "Subject-aware card generation" },
                { name: "Revision Modes (AI)", status: "live", notes: "ai-config unified wrapper" },
                { name: "Risk Engine", status: "rule-based", notes: "No AI — pure analytics (correct)" },
                { name: "Content Craft AI", status: "live", notes: "Lesson & resource generation" },
                { name: "Echo Profile (memory)", status: "live", notes: "Student learning memory layer" },
              ].map((f) => (
                <div key={f.name} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30">
                  <div className={`h-2 w-2 rounded-full shrink-0 ${f.status === "live" ? "bg-emerald-500" : f.status === "rule-based" ? "bg-blue-400" : "bg-amber-400"}`} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{f.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{f.notes}</p>
                  </div>
                  <Badge className={`ml-auto shrink-0 text-xs ${
                    f.status === "live" ? "bg-emerald-100 text-emerald-700"
                    : f.status === "rule-based" ? "bg-blue-100 text-blue-700"
                    : "bg-amber-100 text-amber-700"
                  }`}>{f.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
