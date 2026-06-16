import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Brain, Activity, CheckCircle2, XCircle, Clock, TrendingUp,
  Network, AlertCircle, Zap, BarChart3, DollarSign, RefreshCw,
} from "lucide-react";
import { Link } from "wouter";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";

function StatCard({ icon: Icon, label, value, sub, color = "primary" }: {
  icon: any; label: string; value: string | number; sub?: string; color?: string;
}) {
  const colorMap: Record<string, string> = {
    primary: "bg-primary/8 text-primary",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    violet: "bg-violet-50 text-violet-700",
  };
  return (
    <Card className="border border-slate-100 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
            {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
          </div>
          <div className={`p-2.5 rounded-xl ${colorMap[color] ?? colorMap.primary}`}>
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
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden w-full">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

export default function AiAnalytics() {
  const { toast } = useToast();
  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ["ai-analytics-stats"],
    queryFn: async () => {
      const res = await apiFetch("/api/coremind/analytics/stats");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: weaveHealth, isLoading: weaveLoading } = useQuery({
    queryKey: ["weave-health"],
    queryFn: async () => {
      const res = await apiFetch("/api/weave/health");
      return res.json();
    },
  });

  const maxCalls = stats
    ? Math.max(...Object.values(stats.byModule ?? {}).map((m: any) => m.total), 1)
    : 1;

  const moduleColors: Record<string, string> = {
    mentor: "#14b8a6",
    grading: "#6366f1",
    coremind: "#f59e0b",
    "trial-vault": "#10b981",
    "generate-content": "#8b5cf6",
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Brain size={22} className="text-primary" />
            <h1 className="text-2xl font-bold text-slate-800">AI Analytics</h1>
          </div>
          <p className="text-sm text-slate-500">Monitor AI usage, performance, and impact across Aperti</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw size={14} className="mr-1.5" /> Refresh
          </Button>
          <Link href="/admin/ai-safety">
            <Button variant="outline" size="sm" className="border-amber-200 text-amber-700 hover:bg-amber-50">
              <AlertCircle size={14} className="mr-1.5" /> Safety Review
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Usage Metrics */}
      <section>
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Usage Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Activity} label="Total AI Calls" value={isLoading ? "—" : stats?.totalCalls ?? 0} color="primary" />
          <StatCard icon={Zap} label="Last 7 Days" value={isLoading ? "—" : stats?.recentCallsLast7Days ?? 0} color="blue" />
          <StatCard icon={DollarSign} label="Est. Cost (USD)" value={isLoading ? "—" : `$${stats?.estimatedCostUSD ?? "0.00"}`} sub={`${stats?.totalTokens ?? 0} tokens`} color="amber" />
          <StatCard icon={TrendingUp} label="Avg Confidence" value={isLoading ? "—" : `${Math.round((stats?.avgConfidence ?? 0) * 100)}%`} color="violet" />
        </div>
      </section>

      {/* Call Volume Timeline */}
      {stats?.callsTimeline?.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Daily Call Volume (Last 14 Days)</h2>
          <Card className="border border-slate-100 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-end gap-1.5 h-24">
                {stats.callsTimeline.map((day: any) => {
                  const maxDay = Math.max(...stats.callsTimeline.map((d: any) => d.calls), 1);
                  const h = Math.max(4, Math.round((day.calls / maxDay) * 88));
                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div
                        className="w-full rounded-t bg-primary group-hover:bg-primary transition-all cursor-default"
                        style={{ height: h }}
                      />
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-slate-800 text-white text-xs px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none">
                        {day.calls} calls
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-1 text-[10px] text-slate-400">
                <span>{stats.callsTimeline[0]?.date}</span>
                <span>{stats.callsTimeline[stats.callsTimeline.length - 1]?.date}</span>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* AI Confidence Trend Chart */}
      <ConfidenceTrendChart />

      {/* Accuracy Metrics */}
      <section>
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Accuracy & Acceptance</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={CheckCircle2} label="Accepted" value={isLoading ? "—" : stats?.totalAccepted ?? 0} color="primary" />
          <StatCard icon={XCircle} label="Rejected" value={isLoading ? "—" : stats?.totalRejected ?? 0} color="rose" />
          <StatCard icon={Clock} label="Pending Review" value={isLoading ? "—" : stats?.totalPending ?? 0} color="amber" />
          <StatCard icon={BarChart3} label="Acceptance Rate" value={isLoading ? "—" : `${stats?.overallAcceptanceRate ?? 0}%`} color="blue" />
        </div>
      </section>

      {/* By Module */}
      {stats?.byModule && Object.keys(stats.byModule).length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">By Module</h2>
          <Card className="border border-slate-100 shadow-sm">
            <CardContent className="p-5 space-y-4">
              {Object.entries(stats.byModule).map(([mod, data]: [string, any]) => (
                <div key={mod} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-700 capitalize">{mod}</span>
                      <Badge variant="secondary" className="text-xs">{data.total} calls</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="text-emerald-600">{data.accepted} ✓</span>
                      <span className="text-rose-500">{data.rejected} ✗</span>
                      <span className="text-slate-400">{data.pending} pending</span>
                      <span className="font-medium">{Math.round(data.avgConfidence * 100)}% conf</span>
                    </div>
                  </div>
                  <MiniBar value={data.total} max={maxCalls} color={moduleColors[mod] ?? "#94a3b8"} />
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Weave Health */}
      <section>
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Knowledge Graph Health (The Weave)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Network} label="Total Nodes" value={weaveLoading ? "—" : weaveHealth?.nodeCount ?? 0} color="violet" />
          <StatCard icon={Activity} label="Total Edges" value={weaveLoading ? "—" : weaveHealth?.edgeCount ?? 0} color="blue" />
          <StatCard icon={AlertCircle} label="Disconnected" value={weaveLoading ? "—" : weaveHealth?.disconnectedNodes ?? 0} sub="nodes with no edges" color="amber" />
          <StatCard icon={Brain} label="Node Types" value={weaveLoading ? "—" : Object.keys(weaveHealth?.nodesByType ?? {}).length} color="primary" />
        </div>
        {weaveHealth?.nodesByType && Object.keys(weaveHealth.nodesByType).length > 0 && (
          <Card className="border border-slate-100 shadow-sm mt-4">
            <CardContent className="p-5">
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {Object.entries(weaveHealth.nodesByType).map(([type, cnt]: [string, any]) => (
                  <div key={type} className="text-center">
                    <p className="text-lg font-bold text-slate-700">{cnt}</p>
                    <p className="text-xs text-slate-500 capitalize">{type}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Populate Weave button */}
        <div className="mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const res = await apiFetch("/api/weave/populate", { method: "POST" });
              const data = await res.json();
              toast({ title: "Weave populated", description: `${data.nodesCreated} nodes, ${data.edgesCreated} edges created.` });
            }}
          >
            <Network size={14} className="mr-1.5" /> Populate Weave from Existing Data
          </Button>
          <p className="text-xs text-slate-400 mt-1">Builds the knowledge graph from subjects, questions, students, and flashcards.</p>
        </div>
      </section>

      {/* Student Impact Score */}
      <ImpactPanel />

      {/* Empty state */}
      {!isLoading && stats?.totalCalls === 0 && (
        <div className="text-center py-16 text-slate-400">
          <Brain size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No AI activity recorded yet. Use AI features to see analytics here.</p>
        </div>
      )}
    </div>
  );
}

const MODULE_COLORS: Record<string, string> = {
  mentor: "#14b8a6",
  grading: "#6366f1",
  coremind: "#f59e0b",
  "trial-vault": "#10b981",
  "generate-content": "#8b5cf6",
  snapgrade: "#ef4444",
  unknown: "#94a3b8",
};

function getModuleColor(mod: string): string {
  return MODULE_COLORS[mod] ?? "#94a3b8";
}

function ConfidenceTrendChart() {
  const [windowDays, setWindowDays] = useState<30 | 14 | 7>(30);
  const [view, setView] = useState<"overall" | "by-module">("overall");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["confidence-trend", windowDays],
    queryFn: async () => {
      const res = await apiFetch(`/api/coremind/analytics/confidence-trend?days=${windowDays}`);
      return res.json();
    },
    refetchInterval: 60000,
  });

  const overall: any[] = data?.overall ?? [];
  const byModule: Record<string, any[]> = data?.byModule ?? {};
  const modules: string[] = data?.modules ?? [];

  const mergedForModuleChart = overall.map((row: any) => {
    const merged: Record<string, any> = { date: row.date };
    for (const mod of modules) {
      const modRow = byModule[mod]?.find((r: any) => r.date === row.date);
      merged[mod] = modRow?.avgConfidencePct ?? null;
    }
    return merged;
  });

  const formatDate = (d: string) => {
    const dt = new Date(d);
    return `${dt.getMonth() + 1}/${dt.getDate()}`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-slate-100 shadow-lg rounded-xl px-3 py-2 text-xs min-w-[140px]">
        <p className="font-semibold text-slate-700 mb-1.5">{label}</p>
        {payload.map((p: any) => (
          p.value != null && (
            <div key={p.dataKey} className="flex items-center justify-between gap-3 mb-0.5">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.color }} />
                <span className="text-slate-500 capitalize">{p.name?.replace(/-/g, " ")}</span>
              </span>
              <span className="font-bold text-slate-700">{p.value}%</span>
            </div>
          )
        ))}
      </div>
    );
  };

  const hasData = overall.length > 0;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-2">
          <TrendingUp size={15} className="text-primary" />
          AI Confidence Trend
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
            {(["overall", "by-module"] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-2.5 py-1 transition-colors ${view === v ? "bg-primary text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
              >
                {v === "overall" ? "Overall" : "By Module"}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
            {([7, 14, 30] as const).map(d => (
              <button
                key={d}
                onClick={() => setWindowDays(d)}
                className={`px-2.5 py-1 transition-colors ${windowDays === d ? "bg-primary text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
              >
                {d}d
              </button>
            ))}
          </div>
          <button onClick={() => refetch()} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-400 transition-colors">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      <Card className="border border-slate-100 shadow-sm">
        <CardContent className="p-5">
          {isLoading && (
            <div className="space-y-2">
              <div className="h-48 bg-slate-100 rounded-xl animate-pulse" />
            </div>
          )}

          {isError && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <AlertCircle size={28} className="mb-2 text-rose-400" />
              <p className="text-sm text-slate-500">Failed to load confidence trend</p>
              <button onClick={() => refetch()} className="mt-2 text-xs text-primary underline">Retry</button>
            </div>
          )}

          {!isLoading && !isError && !hasData && (
            <div className="flex flex-col items-center justify-center py-14 text-slate-400">
              <Brain size={36} className="mb-3 opacity-30" />
              <p className="text-sm font-medium text-slate-500">No confidence data yet</p>
              <p className="text-xs text-slate-400 mt-1">Confidence scores will appear here once AI features are used</p>
            </div>
          )}

          {!isLoading && !isError && hasData && view === "overall" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                {(() => {
                  const valid = overall.filter(d => d.avgConfidencePct != null);
                  const latest = valid[valid.length - 1]?.avgConfidencePct ?? null;
                  const earliest = valid[0]?.avgConfidencePct ?? null;
                  const avg = valid.length > 0 ? Math.round(valid.reduce((s, d) => s + d.avgConfidencePct, 0) / valid.length * 10) / 10 : null;
                  const delta = latest != null && earliest != null ? Math.round((latest - earliest) * 10) / 10 : null;
                  return (
                    <>
                      <div className="bg-primary/8 rounded-xl p-3 border border-primary/15">
                        <p className="text-xl font-bold text-primary">{latest != null ? `${latest}%` : "—"}</p>
                        <p className="text-xs text-primary mt-0.5">Latest</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <p className="text-xl font-bold text-slate-700">{avg != null ? `${avg}%` : "—"}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Period Avg</p>
                      </div>
                      <div className={`rounded-xl p-3 border ${delta == null ? "bg-slate-50 border-slate-100" : delta >= 0 ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"}`}>
                        <p className={`text-xl font-bold ${delta == null ? "text-slate-500" : delta >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                          {delta != null ? `${delta >= 0 ? "+" : ""}${delta}%` : "—"}
                        </p>
                        <p className={`text-xs mt-0.5 ${delta == null ? "text-slate-400" : delta >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                          {windowDays}d Change
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>

              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={overall} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="acceptGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={80} stroke="#10b981" strokeDasharray="4 3" strokeWidth={1} label={{ value: "80%", position: "right", fontSize: 9, fill: "#10b981" }} />
                  <ReferenceLine y={60} stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={1} label={{ value: "60%", position: "right", fontSize: 9, fill: "#f59e0b" }} />
                  <Area type="monotone" dataKey="avgConfidencePct" name="Avg Confidence" stroke="#14b8a6" strokeWidth={2} fill="url(#confGrad)" dot={false} connectNulls />
                  <Area type="monotone" dataKey="acceptanceRate" name="Acceptance Rate" stroke="#6366f1" strokeWidth={1.5} fill="url(#acceptGrad)" dot={false} connectNulls strokeDasharray="5 3" />
                </AreaChart>
              </ResponsiveContainer>

              <div className="flex items-center gap-4 text-xs text-slate-400 pt-1 border-t border-slate-50">
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-primary inline-block rounded" /> Avg Confidence</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-px bg-violet-500 inline-block rounded border-dashed border-t border-violet-500" style={{ borderStyle: "dashed" }} /> Acceptance Rate</span>
                <span className="ml-auto">Green line = 80% target · Amber = 60% warning</span>
              </div>
            </div>
          )}

          {!isLoading && !isError && hasData && view === "by-module" && (
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={mergedForModuleChart} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    formatter={(value) => <span className="text-xs text-slate-500 capitalize">{value.replace(/-/g, " ")}</span>}
                    iconType="circle" iconSize={8}
                  />
                  <ReferenceLine y={80} stroke="#10b981" strokeDasharray="4 3" strokeWidth={1} />
                  <ReferenceLine y={60} stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={1} />
                  {modules.map(mod => (
                    <Line
                      key={mod}
                      type="monotone"
                      dataKey={mod}
                      name={mod}
                      stroke={getModuleColor(mod)}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {modules.map(mod => {
                  const series = byModule[mod] ?? [];
                  const valid = series.filter(d => d.avgConfidencePct != null);
                  const latest = valid[valid.length - 1]?.avgConfidencePct ?? null;
                  const totalCalls = series.reduce((s, d) => s + d.calls, 0);
                  return (
                    <div key={mod} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-100 bg-slate-50/60">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getModuleColor(mod) }} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-700 capitalize truncate">{mod.replace(/-/g, " ")}</p>
                        <p className="text-xs text-slate-400">{latest != null ? `${latest}% conf` : "no data"} · {totalCalls} calls</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function ImpactPanel() {
  const { data: impact, isLoading } = useQuery({
    queryKey: ["coremind-impact"],
    queryFn: async () => {
      const res = await apiFetch("/api/coremind/analytics/impact");
      return res.json();
    },
    refetchInterval: 60000,
  });

  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Student Impact Score</h2>
      <Card className="border border-slate-100 shadow-sm">
        <CardContent className="p-5">
          {isLoading && <p className="text-sm text-slate-400 text-center py-4">Computing impact...</p>}
          {!isLoading && impact && (
            <div className="space-y-4">
              {/* Impact message */}
              <div className={`rounded-lg px-4 py-3 text-sm font-medium ${
                impact.impactDelta > 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                impact.impactDelta < 0 ? "bg-amber-50 text-amber-700 border border-amber-100" :
                "bg-slate-50 text-slate-600 border border-slate-100"
              }`}>
                {impact.impactDelta > 0 && "📈 "}
                {impact.impactDelta < 0 && "⚠️ "}
                {impact.impactDelta === null && "📊 "}
                {impact.impactMessage}
              </div>

              {/* Comparison grid */}
              {impact.impactDelta !== null && (
                <div className="grid grid-cols-3 gap-4 pt-1">
                  <div className="text-center p-3 bg-primary/8 rounded-xl border border-primary/15">
                    <p className="text-xl font-bold text-primary">{impact.mentorAvgGrade}%</p>
                    <p className="text-xs text-primary mt-0.5">Mentor Users</p>
                    <p className="text-xs text-slate-400">{impact.mentorCount} students</p>
                  </div>
                  <div className="text-center p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col items-center justify-center">
                    <p className={`text-lg font-bold ${impact.impactDelta > 0 ? "text-emerald-600" : "text-rose-500"}`}>
                      {impact.impactDelta > 0 ? "+" : ""}{impact.impactDelta}%
                    </p>
                    <p className="text-xs text-slate-400">delta</p>
                  </div>
                  <div className="text-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-xl font-bold text-slate-600">{impact.nonMentorAvgGrade}%</p>
                    <p className="text-xs text-slate-500 mt-0.5">Non-Users</p>
                    <p className="text-xs text-slate-400">{impact.nonMentorCount} students</p>
                  </div>
                </div>
              )}

              {/* Totals */}
              <div className="flex items-center gap-6 text-xs text-slate-500 pt-1 border-t border-slate-50">
                <span>Total students with grades: <strong className="text-slate-700">{impact.totalStudents}</strong></span>
                <span>Overall avg: <strong className="text-slate-700">{impact.overallAvg}%</strong></span>
                <span>AI users tracked: <strong className="text-slate-700">{impact.mentorUsers}</strong></span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
