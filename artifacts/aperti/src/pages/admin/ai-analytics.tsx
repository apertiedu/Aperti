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

function StatCard({ icon: Icon, label, value, sub, color = "teal" }: {
  icon: any; label: string; value: string | number; sub?: string; color?: string;
}) {
  const colorMap: Record<string, string> = {
    teal: "bg-teal-50 text-teal-700",
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
            <Brain size={22} className="text-teal-600" />
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
          <StatCard icon={Activity} label="Total AI Calls" value={isLoading ? "—" : stats?.totalCalls ?? 0} color="teal" />
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
                        className="w-full rounded-t bg-teal-400 group-hover:bg-teal-500 transition-all cursor-default"
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

      {/* Accuracy Metrics */}
      <section>
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Accuracy & Acceptance</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={CheckCircle2} label="Accepted" value={isLoading ? "—" : stats?.totalAccepted ?? 0} color="teal" />
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
          <StatCard icon={Brain} label="Node Types" value={weaveLoading ? "—" : Object.keys(weaveHealth?.nodesByType ?? {}).length} color="teal" />
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
                  <div className="text-center p-3 bg-teal-50 rounded-xl border border-teal-100">
                    <p className="text-xl font-bold text-teal-700">{impact.mentorAvgGrade}%</p>
                    <p className="text-xs text-teal-600 mt-0.5">Mentor Users</p>
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
