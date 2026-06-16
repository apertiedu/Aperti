import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  TrendingUp, Users, AlertTriangle,
  Brain, Zap, Search, ArrowUp, ArrowDown, Minus,
  CheckCircle2, Clock, Calendar, ChevronRight,
} from "lucide-react";
import { AppEmptyState } from "@/components/app-empty-state";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const API = "/api";
async function apiFetch(url: string) {
  const res = await fetch(`${API}${url}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const LEVEL_STYLE = {
  critical: { bar: "bg-red-500",    badge: "bg-red-100 text-red-700",    label: "Critical" },
  high:     { bar: "bg-orange-500", badge: "bg-orange-100 text-orange-700", label: "High" },
  medium:   { bar: "bg-amber-400",  badge: "bg-amber-100 text-amber-700", label: "Medium" },
  low:      { bar: "bg-emerald-500",badge: "bg-emerald-100 text-emerald-700", label: "Low" },
};

function RiskBadge({ level }: { level: string }) {
  const s = LEVEL_STYLE[level as keyof typeof LEVEL_STYLE] ?? LEVEL_STYLE.low;
  return <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${s.badge}`}>{s.label}</span>;
}

function TrendIcon({ trend }: { trend: "up" | "down" | "flat" }) {
  if (trend === "up") return <ArrowUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (trend === "down") return <ArrowDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

function ScoreBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = pct >= 75 ? "bg-emerald-400" : pct >= 50 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-muted-foreground w-8 text-right">{Math.round(value)}%</span>
    </div>
  );
}

function SummaryBand({ summary }: { summary: any }) {
  const total = (summary?.critical ?? 0) + (summary?.high ?? 0) + (summary?.medium ?? 0) + (summary?.low ?? 0);
  return (
    <div className="grid grid-cols-4 gap-3 mb-6">
      {[
        { key: "critical", label: "Critical", color: "bg-red-50 border-red-200 text-red-700", dot: "bg-red-500" },
        { key: "high",     label: "High Risk", color: "bg-orange-50 border-orange-200 text-orange-700", dot: "bg-orange-500" },
        { key: "medium",   label: "Medium",   color: "bg-amber-50 border-amber-200 text-amber-700", dot: "bg-amber-400" },
        { key: "low",      label: "Low Risk",  color: "bg-emerald-50 border-emerald-200 text-emerald-700", dot: "bg-emerald-500" },
      ].map(({ key, label, color, dot }) => (
        <div key={key} className={`border rounded-xl p-3 text-center ${color}`}>
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <span className={`w-2 h-2 rounded-full ${dot}`} />
            <span className="text-xs font-semibold">{label}</span>
          </div>
          <p className="text-2xl font-black">{summary?.[key] ?? 0}</p>
          {total > 0 && <p className="text-[10px] opacity-70">{Math.round(((summary?.[key] ?? 0) / total) * 100)}% of class</p>}
        </div>
      ))}
    </div>
  );
}

export default function InsightStream() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("risk");

  const { data: riskReport, isLoading: riskLoading } = useQuery({
    queryKey: ["risk-report"],
    queryFn: () => apiFetch("/analytics/risk-report"),
    staleTime: 60_000,
  });

  const { data: attendance } = useQuery({
    queryKey: ["attendance-trend"],
    queryFn: () => apiFetch("/dashboard/attendance-trend"),
    staleTime: 120_000,
  });

  const riskStudents: any[] = (riskReport as any)?.students ?? [];
  const summary = (riskReport as any)?.summary ?? {};

  const filtered = riskStudents.filter(s =>
    s.studentName?.toLowerCase().includes(search.toLowerCase()) ||
    s.studentCode?.toLowerCase().includes(search.toLowerCase()),
  );

  const atRisk = riskStudents.filter(s => s.riskLevel === "critical" || s.riskLevel === "high");

  const trendData = Array.isArray(attendance)
    ? attendance.map((r: any) => ({
        date: new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        rate: r.total > 0 ? Math.round((r.present / r.total) * 100) : 0,
      }))
    : [];

  const avgAtt = trendData.length > 0
    ? Math.round(trendData.reduce((s, r) => s + r.rate, 0) / trendData.length)
    : 0;

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Brain className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold">InsightStream™</h1>
        </div>
        <p className="text-muted-foreground text-sm ml-10">
          Predictive intelligence — identify at-risk students and recommend targeted interventions.
        </p>
      </motion.div>

      {/* Summary Alert Banner */}
      {!riskLoading && atRisk.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">
                {atRisk.length} student{atRisk.length !== 1 ? "s" : ""} need{atRisk.length === 1 ? "s" : ""} immediate attention
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                {(summary.critical ?? 0) > 0
                  ? `${summary.critical} critical case${summary.critical !== 1 ? "s" : ""} — review and act now.`
                  : "High risk detected — review intervention suggestions below."}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="risk">Risk Report</TabsTrigger>
          <TabsTrigger value="trend">Class Trend</TabsTrigger>
          <TabsTrigger value="interventions">Interventions</TabsTrigger>
        </TabsList>

        {/* RISK REPORT */}
        <TabsContent value="risk">
          {riskLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
            </div>
          ) : riskStudents.length === 0 ? (
            <AppEmptyState
              type="analytics"
              title="No student risk data yet"
              description="Add students and record attendance to see AI-powered risk analysis here."
              size="lg"
            />
          ) : (
            <>
              <SummaryBand summary={summary} />
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search students…"
                    className="pl-9 h-9"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-3">
                {filtered.map((s: any) => {
                  const levelStyle = LEVEL_STYLE[s.riskLevel as keyof typeof LEVEL_STYLE] ?? LEVEL_STYLE.low;
                  const trend: "up" | "down" | "flat" =
                    s.recentExamAvg > s.prevExamAvg ? "up" : s.recentExamAvg < s.prevExamAvg ? "down" : "flat";
                  return (
                    <motion.div key={s.studentId} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                      <Card className="hover:shadow-md transition-shadow border-l-4" style={{ borderLeftColor: s.riskLevel === "critical" ? "#ef4444" : s.riskLevel === "high" ? "#f97316" : s.riskLevel === "medium" ? "#fbbf24" : "#10b981" }}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                {s.studentName?.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-semibold leading-tight">{s.studentName}</p>
                                <p className="text-xs text-muted-foreground">{s.studentCode}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <TrendIcon trend={trend} />
                              <RiskBadge level={s.riskLevel} />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div>
                              <p className="text-[10px] text-muted-foreground mb-1 uppercase font-semibold tracking-wide">Attendance (30d)</p>
                              <ScoreBar value={s.recentAttRate} />
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground mb-1 uppercase font-semibold tracking-wide">Exam Average</p>
                              <ScoreBar value={s.recentExamAvg} />
                            </div>
                          </div>

                          {s.daysSinceAttendance < 999 && (
                            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Last seen {s.daysSinceAttendance === 0 ? "today" : `${s.daysSinceAttendance}d ago`}
                            </p>
                          )}

                          {s.reasons?.length > 0 && (
                            <div className="space-y-1">
                              {s.reasons.map((r: string, i: number) => (
                                <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                  <span className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${levelStyle.bar}`} />
                                  {r}
                                </p>
                              ))}
                            </div>
                          )}

                          {s.coremindInsights && (
                            <div className="mt-2 pt-2 border-t border-border/50">
                              <p className="text-[10px] font-semibold text-primary mb-1 flex items-center gap-1">
                                <Zap className="w-3 h-3" /> CoreMind Insights
                              </p>
                              {s.coremindInsights.weakTopics?.slice(0, 2).map((t: string, i: number) => (
                                <p key={i} className="text-xs text-muted-foreground">Weak: {t}</p>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
                {filtered.length === 0 && (
                  <AppEmptyState type="search-no-results" size="sm" />
                )}
              </div>
            </>
          )}
        </TabsContent>

        {/* CLASS TREND */}
        <TabsContent value="trend">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Class Attendance Trend</CardTitle>
              <CardDescription className="text-xs">
                Daily rates over the last 7 days · Avg: {avgAtt}%
                {avgAtt < 70 && <span className="text-amber-600 font-medium ml-1">— below target</span>}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {trendData.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <TrendingUp className="w-10 h-10 opacity-20" />
                  <p className="text-sm">Record attendance to see the trend here.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                    <Tooltip
                      formatter={(v: any) => [`${v}%`, "Attendance"]}
                      contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                    />
                    <Line type="monotone" dataKey="rate" stroke="hsl(var(--primary))" strokeWidth={2.5}
                      dot={{ r: 4, fill: "hsl(var(--primary))" }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* INTERVENTIONS */}
        <TabsContent value="interventions">
          {riskLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
          ) : atRisk.length === 0 ? (
            <AppEmptyState
              type="no-warnings"
              title="All students are on track"
              description="No critical or high-risk students right now. Keep it up!"
              size="lg"
            />
          ) : (
            <div className="space-y-3">
              {atRisk.map((s: any) => (
                <motion.div key={s.studentId} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                          {s.studentName?.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-semibold">{s.studentName}</p>
                            <RiskBadge level={s.riskLevel} />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Risk score: {s.riskScore} · {s.daysSinceAttendance < 999 ? `Last seen ${s.daysSinceAttendance}d ago` : "No attendance recorded"}
                          </p>
                        </div>
                      </div>

                      {s.recommendations?.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">Recommended Actions</p>
                          {s.recommendations.map((rec: string, i: number) => (
                            <div key={i} className="flex items-start gap-2 bg-primary/5 rounded-lg px-3 py-2">
                              <ChevronRight className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                              <p className="text-xs text-foreground">{rec}</p>
                            </div>
                          ))}
                          {s.coremindInsights?.recommendedActions?.map((a: string, i: number) => (
                            <div key={`ai-${i}`} className="flex items-start gap-2 bg-purple-50 dark:bg-purple-950/20 rounded-lg px-3 py-2">
                              <Zap className="w-3.5 h-3.5 text-purple-500 shrink-0 mt-0.5" />
                              <p className="text-xs text-foreground">{a}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Act now — early intervention improves outcomes by up to 40%</span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
