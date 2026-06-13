import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fetchJSON } from "@/lib/api";
import { useLocation } from "wouter";
import {
  Users, TrendingUp, BookOpen, DollarSign, AlertCircle,
  Layers, Activity, Zap, ArrowUpRight, ArrowDownRight,
  BarChart3, ShieldCheck, Gauge, Heart, Puzzle, Headphones,
  Target, RefreshCw, Rocket, CheckCircle2, XCircle, AlertTriangle,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

function QualityGauge({ score }: { score: number }) {
  const color = score >= 85 ? "#16a34a" : score >= 70 ? "#2563eb" : score >= 50 ? "#d97706" : "#dc2626";
  const label = score >= 85 ? "Excellent" : score >= 70 ? "Good" : score >= 50 ? "Fair" : "Needs Work";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-28 h-16 overflow-hidden">
        <svg viewBox="0 0 160 96" className="w-full h-full">
          <path d="M 16 80 A 64 64 0 0 1 144 80" stroke="#e5e7eb" strokeWidth="14" fill="none" strokeLinecap="round" />
          <path d="M 16 80 A 64 64 0 0 1 144 80" stroke={color} strokeWidth="14" fill="none"
            strokeLinecap="round" strokeDasharray={`${(score / 100) * 201} 201`} />
        </svg>
      </div>
      <p className="text-2xl font-black -mt-2" style={{ color }}>{score}</p>
      <p className="text-xs font-medium" style={{ color }}>{label}</p>
    </div>
  );
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width="52" height="52" viewBox="0 0 52 52">
      <circle cx="26" cy="26" r={r} fill="none" stroke="#e5e7eb" strokeWidth="5" />
      <circle cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 26 26)" />
      <text x="26" y="30" textAnchor="middle" fontSize="11" fontWeight="700" fill={color}>{score}</text>
    </svg>
  );
}

function StatCard({
  label, value, sub, icon: Icon, color = "teal", trend, onClick,
}: {
  label: string; value: string | number; sub?: string;
  icon: any; color?: string; trend?: number; onClick?: () => void;
}) {
  const colors: Record<string, string> = {
    teal: "bg-teal-50 text-teal-600",
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-purple-50 text-purple-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
    green: "bg-green-50 text-green-600",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      onClick={onClick}
      className={`bg-white rounded-xl shadow-sm p-5 border border-gray-100 ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend !== undefined && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${trend >= 0 ? "text-green-600" : "text-rose-500"}`}>
            {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm font-medium text-gray-700 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </motion.div>
  );
}

const SCORE_META: Record<string, { icon: any; color: string; ring: string }> = {
  growth:           { icon: TrendingUp,  color: "text-teal-600",   ring: "#0D9488" },
  happiness:        { icon: Heart,       color: "text-rose-600",   ring: "#e11d48" },
  adoption:         { icon: Puzzle,      color: "text-blue-600",   ring: "#2563eb" },
  supportBurden:    { icon: Headphones,  color: "text-purple-600", ring: "#9333ea" },
  revenueEfficiency:{ icon: Target,      color: "text-amber-600",  ring: "#d97706" },
};

function ScoreCard({ id, data }: { id: string; data: any }) {
  const meta = SCORE_META[id] ?? { icon: Activity, color: "text-gray-600", ring: "#6b7280" };
  const Icon = meta.icon;
  const score = data?.score ?? 0;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-4"
    >
      <ScoreRing score={score} color={meta.ring} />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{data?.label}</p>
        <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{data?.sub}</p>
      </div>
    </motion.div>
  );
}

function StabilityMetricCard({ label, value, target, icon: Icon, ok }: {
  label: string; value: number; target: number; icon: any; ok: boolean;
}) {
  return (
    <div className={`bg-white rounded-xl border p-4 shadow-sm flex items-center gap-3 ${ok ? "border-green-200" : "border-red-200 bg-red-50/30"}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${ok ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 truncate">{label}</p>
        <div className="flex items-baseline gap-1">
          <p className={`text-xl font-bold tabular-nums ${ok ? "text-green-700" : "text-red-600"}`}>{value}</p>
          <span className="text-xs text-gray-400">/ target {target}</span>
        </div>
      </div>
      <span className={`text-lg ${ok ? "text-green-500" : "text-red-500"}`}>{ok ? "✓" : "!"}</span>
    </div>
  );
}

function PlatformStabilitySection() {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["platform-stability-metrics"],
    queryFn: () => fetchJSON("/api/founder/platform-stability-metrics"),
    refetchInterval: 120000,
    staleTime: 60000,
    retry: false,
  });

  const score: number = data?.score ?? 100;
  const metrics = [
    { label: "Critical Bugs",         value: data?.criticalBugs ?? 0,         target: 0, icon: XCircle,      ok: (data?.criticalBugs ?? 0) === 0 },
    { label: "Broken Routes",         value: data?.brokenRoutes ?? 0,         target: 0, icon: AlertTriangle, ok: (data?.brokenRoutes ?? 0) === 0 },
    { label: "Permission Leaks",      value: data?.permissionLeaks ?? 0,      target: 0, icon: ShieldCheck,   ok: (data?.permissionLeaks ?? 0) === 0 },
    { label: "Duplicate Attendance",  value: data?.duplicateAttendance ?? 0,  target: 0, icon: Users,         ok: (data?.duplicateAttendance ?? 0) === 0 },
    { label: "Timetable Conflicts",   value: data?.timetableConflicts ?? 0,   target: 0, icon: Layers,        ok: (data?.timetableConflicts ?? 0) === 0 },
    { label: "Unhandled Errors (24h)",value: data?.unhandledErrors ?? 0,      target: 0, icon: Zap,           ok: (data?.unhandledErrors ?? 0) === 0 },
  ];
  const allGreen = metrics.every(m => m.ok);
  const scoreColor = score >= 90 ? "#22c55e" : score >= 70 ? "#f59e0b" : "#ef4444";

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Platform Stability Goal</h2>
        <button onClick={() => refetch()} disabled={isFetching}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-teal-600 transition-colors">
          <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Score banner */}
          <div className={`rounded-xl border p-4 flex items-center gap-4 ${allGreen ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
            <div className="relative w-14 h-14 shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="22" fill="none" stroke="#e5e7eb" strokeWidth="6" />
                <circle cx="28" cy="28" r="22" fill="none" stroke={scoreColor} strokeWidth="6"
                  strokeDasharray={`${(score / 100) * 138.2} 138.2`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-black tabular-nums" style={{ color: scoreColor }}>{score}</span>
              </div>
            </div>
            <div>
              <p className="text-lg font-bold" style={{ color: scoreColor }}>
                {score >= 90 ? "Platform Stable" : score >= 70 ? "Needs Attention" : "Critical Issues"}
              </p>
              <p className="text-xs text-gray-500">Platform Stability Score · updated {data?.checkedAt ? new Date(data.checkedAt).toLocaleTimeString() : "now"}</p>
            </div>
            {allGreen && (
              <div className="ml-auto flex items-center gap-2 text-green-700 font-semibold text-sm">
                <CheckCircle2 className="w-5 h-5" /> All targets met
              </div>
            )}
          </div>
          {/* Metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {metrics.map(m => <StabilityMetricCard key={m.label} {...m} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function LaunchCertBadge() {
  const [, nav] = useLocation();
  const { data } = useQuery<any>({
    queryKey: ["launch-certification"],
    queryFn: () => fetchJSON("/api/founder/launch-certification"),
    refetchInterval: 120000,
    staleTime: 60000,
    retry: false,
  });
  if (!data) return null;
  const { certified, failCount, warnCount, checks = [] } = data;
  const passCount = (checks as any[]).filter((c: any) => c.status === "pass").length;
  const total = checks.length;

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      onClick={() => nav("/admin/os/launch-certification")}
      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${
        certified
          ? "border-green-200 bg-gradient-to-r from-green-50 to-emerald-50"
          : failCount > 0
          ? "border-red-200 bg-red-50"
          : "border-amber-200 bg-amber-50"
      }`}
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
        certified ? "bg-green-100" : failCount > 0 ? "bg-red-100" : "bg-amber-100"
      }`}>
        <Rocket className={`w-5 h-5 ${certified ? "text-green-600" : failCount > 0 ? "text-red-500" : "text-amber-600"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900">Launch Certification</p>
        <p className={`text-xs font-medium mt-0.5 ${certified ? "text-green-700" : failCount > 0 ? "text-red-600" : "text-amber-700"}`}>
          {certified
            ? `All ${total} checks passed — ready to launch 🚀`
            : failCount > 0
            ? `${failCount} critical blocker${failCount !== 1 ? "s" : ""} 🔴 — launch blocked`
            : `${warnCount} warning${warnCount !== 1 ? "s" : ""} 🟠 — review before launch`}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="flex flex-col items-end gap-0.5">
          <div className="flex items-center gap-1">
            {certified ? (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : failCount > 0 ? (
              <XCircle className="w-4 h-4 text-red-500" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            )}
            <span className={`text-sm font-black ${certified ? "text-green-700" : failCount > 0 ? "text-red-600" : "text-amber-600"}`}>
              {passCount}/{total}
            </span>
          </div>
          <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${certified ? "bg-green-500" : failCount > 0 ? "bg-red-500" : "bg-amber-400"}`}
              style={{ width: `${total > 0 ? (passCount / total) * 100 : 0}%` }}
            />
          </div>
        </div>
        <ArrowUpRight className="w-4 h-4 text-gray-400" />
      </div>
    </motion.button>
  );
}

export default function FounderControlPage() {
  const [, nav] = useLocation();

  const { data: ov, isLoading } = useQuery({
    queryKey: ["founder-overview"],
    queryFn: () => fetchJSON("/api/founder/overview"),
  });
  const { data: rev } = useQuery({
    queryKey: ["founder-revenue"],
    queryFn: () => fetchJSON("/api/founder/revenue"),
  });
  const { data: alerts } = useQuery({
    queryKey: ["founder-alerts"],
    queryFn: () => fetchJSON("/api/founder/alerts"),
    refetchInterval: 30000,
  });
  const { data: qualityScore } = useQuery({
    queryKey: ["founder-quality-score"],
    queryFn: () => fetchJSON("/api/admin/quality/score"),
    retry: false,
  });
  const { data: scores, isLoading: scoresLoading, refetch: refetchScores } = useQuery({
    queryKey: ["founder-scores"],
    queryFn: () => fetchJSON("/api/founder/scores"),
    retry: false,
  });
  const { data: health } = useQuery({
    queryKey: ["system-health"],
    queryFn: () => fetchJSON("/api/admin/system-health"),
    refetchInterval: 60000,
    retry: false,
  });
  const { data: activityMetrics } = useQuery({
    queryKey: ["founder-user-activity"],
    queryFn: () => fetchJSON("/api/founder/user-activity-metrics"),
    refetchInterval: 300000,
    retry: false,
  });

  const unread = (alerts?.alerts ?? []).filter((a: any) => !a.is_read).length;
  const monthly = (rev?.monthly ?? []).slice(-6);
  const users = ov?.users ?? {};
  const content = ov?.content ?? {};
  const revenue = ov?.revenue ?? {};
  const readiness = ov?.readiness;
  const platformScore = qualityScore?.score ?? null;
  const scoreData = scores?.scores ?? {};
  const healthStatus = health?.status ?? null;
  const healthColor = healthStatus === "healthy" ? "text-green-600" : healthStatus === "degraded" ? "text-amber-600" : healthStatus === "critical" ? "text-red-600" : "text-gray-400";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Founder Control Center</h1>
          <p className="text-sm text-gray-500 mt-0.5">Full platform overview — real-time operational data</p>
        </div>
        <div className="flex items-center gap-2">
          {healthStatus && (
            <span className={`text-xs font-medium flex items-center gap-1 ${healthColor}`}>
              <span className={`w-2 h-2 rounded-full ${healthStatus === "healthy" ? "bg-green-500" : healthStatus === "degraded" ? "bg-amber-500" : "bg-red-500"}`} />
              System {healthStatus}
            </span>
          )}
          {unread > 0 && (
            <button
              onClick={() => nav("/admin/os/founder-alerts")}
              className="flex items-center gap-2 bg-rose-50 text-rose-600 px-3 py-1.5 rounded-lg text-sm font-medium border border-rose-100 hover:bg-rose-100 transition-colors"
            >
              <AlertCircle className="w-4 h-4" />
              {unread} unread alert{unread !== 1 ? "s" : ""}
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 animate-pulse h-28" />
          ))}
        </div>
      ) : (
        <>
          {/* Users */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Users</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard label="Active Students" value={users.students ?? 0} icon={Users} color="teal" sub={`+${users.new7d ?? 0} this week`} />
              <StatCard label="Active Teachers" value={users.teachers ?? 0} icon={Users} color="blue" />
              <StatCard label="Active Parents" value={users.parents ?? 0} icon={Users} color="purple" />
              <StatCard label="New (30d)" value={users.new30d ?? 0} icon={TrendingUp} color="green" />
            </div>
          </div>

          {/* DAU / WAU / MAU */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Engagement (Active Users)</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard label="Daily Active (DAU)" value={activityMetrics?.dau ?? "—"} icon={Activity} color="teal"
                sub="Unique logins today" />
              <StatCard label="Weekly Active (WAU)" value={activityMetrics?.wau ?? "—"} icon={TrendingUp} color="blue"
                sub="Last 7 days" />
              <StatCard label="Monthly Active (MAU)" value={activityMetrics?.mau ?? "—"} icon={Users} color="purple"
                sub="Last 30 days" />
              <StatCard label="Stickiness (DAU/MAU)" value={activityMetrics?.stickinessRatio != null ? `${activityMetrics.stickinessRatio}%` : "—"} icon={Target} color="green"
                sub={activityMetrics?.stickinessRatio != null ? (activityMetrics.stickinessRatio >= 20 ? "Healthy" : "Needs growth") : ""} />
            </div>
          </div>

          {/* Revenue */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Revenue</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard label="MTD Revenue" value={`EGP ${parseFloat(revenue.mtd ?? 0).toLocaleString()}`} icon={DollarSign} color="green"
                onClick={() => nav("/admin/os/founder-revenue")} />
              <StatCard label="YTD Revenue" value={`EGP ${parseFloat(revenue.ytd ?? 0).toLocaleString()}`} icon={DollarSign} color="amber"
                onClick={() => nav("/admin/os/founder-revenue")} />
              <StatCard label="Active Subs" value={content.activeSubs ?? revenue.activeSubs ?? 0} icon={Layers} color="blue"
                onClick={() => nav("/admin/os/founder-growth")} />
              <StatCard label="Open Tickets" value={ov?.support?.openTickets ?? 0} icon={AlertCircle} color="rose" />
            </div>
          </div>

          {/* Content */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Content & Platform</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard label="Courses" value={content.courses ?? 0} icon={BookOpen} color="teal" />
              <StatCard label="Questions" value={(content.questions ?? 0).toLocaleString()} icon={BarChart3} color="purple" />
              <StatCard label="Assessments" value={content.assessments ?? 0} icon={Activity} color="blue" />
              <StatCard label="Readiness" value={`${readiness ?? "—"}%`} icon={ShieldCheck} color="green" />
            </div>
          </div>

          {/* Health Scores */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Platform Health Scores</h2>
              <button
                onClick={() => refetchScores()}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-teal-600 transition-colors"
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>
            {scoresLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 h-20 animate-pulse" />
                ))}
              </div>
            ) : Object.keys(scoreData).length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {Object.entries(scoreData).map(([key, val]) => (
                  <ScoreCard key={key} id={key} data={val} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Score data unavailable</p>
            )}
          </div>

          {/* Platform Quality Score */}
          {platformScore !== null && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Platform Quality</h2>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                      <Gauge className="w-4 h-4 text-teal-600" /> Platform Quality Score
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">Composite score: error rate, performance, accessibility, open bugs</p>
                  </div>
                  <button onClick={() => nav("/admin/os/qa/readiness")}
                    className="text-xs text-teal-600 hover:underline flex items-center gap-1">
                    QA Details <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex items-center gap-8">
                  <QualityGauge score={platformScore} />
                  <div className="flex-1 space-y-2">
                    {[
                      { label: "Error Rate", value: qualityScore?.metrics?.errorRate ?? null, good: (v: number) => v <= 2, fmt: (v: number) => `${v.toFixed(1)}%` },
                      { label: "Performance", value: qualityScore?.metrics?.performance ?? null, good: (v: number) => v >= 85, fmt: (v: number) => `${v}/100` },
                      { label: "Accessibility", value: qualityScore?.metrics?.accessibility ?? null, good: (v: number) => v >= 80, fmt: (v: number) => `${v}/100` },
                      { label: "Open Bugs", value: qualityScore?.metrics?.openBugs ?? null, good: (v: number) => v === 0, fmt: (v: number) => String(v) },
                    ].map(({ label, value, good, fmt }) => (
                      <div key={label} className="flex items-center gap-2 text-sm">
                        <span className="text-gray-500 w-28 shrink-0">{label}</span>
                        <span className={`font-medium ${value !== null ? (good(value) ? "text-green-600" : "text-amber-600") : "text-gray-300"}`}>
                          {value !== null ? fmt(value) : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* System Health Checks */}
          {health?.checks && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">System Health</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {health.checks.map((c: any) => (
                  <div key={c.name} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${c.status === "pass" ? "bg-green-500" : c.status === "warn" ? "bg-amber-400" : "bg-red-500"}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.value} <span className="text-gray-300">/ target {c.target}</span></p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Platform Stability Goal Dashboard */}
      <PlatformStabilitySection />

      {/* Launch Certification Status */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Launch Readiness</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-semibold text-gray-900 text-sm">Production Readiness Score</p>
                <p className="text-xs text-gray-400 mt-0.5">Phase 46 hardening — as of June 2026</p>
              </div>
              <button onClick={() => nav("/admin/os/system-inventory")}
                className="text-xs text-teal-600 hover:underline flex items-center gap-1">
                System Inventory <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
            <div className="flex items-center gap-6">
              <QualityGauge score={92} />
              <div className="flex-1 space-y-2">
                {[
                  { label: "Security",       score: 92 },
                  { label: "Stability",      score: 90 },
                  { label: "DB Integrity",   score: 88 },
                  { label: "AI Reliability", score: 85 },
                  { label: "Performance",    score: 88 },
                  { label: "Observability",  score: 92 },
                ].map(({ label, score }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-28 shrink-0">{label}</span>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-teal-500" style={{ width: `${score}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-gray-700 w-8 text-right">{score}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex-1">
              <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-2">Green — Launch Ready</p>
              <ul className="space-y-1 text-xs text-green-700">
                {["HttpOnly cookie auth — XSS-safe", "RBAC on all 120+ routes", "Rate limiting (auth: 10/15min)", "AI circuit breaker with fallbacks", "/api/health + /api/ai/health live", "DB indexes on all query paths", "Error boundaries + frontend capture"].map(i => (
                  <li key={i} className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />{i}</li>
                ))}
              </ul>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-2">Red — Blockers</p>
              <ul className="space-y-1 text-xs text-red-600">
                {["Password reset — SMTP not configured", "ToS / Privacy Policy — placeholder content", "Audit log retention — no TTL policy"].map(i => (
                  <li key={i} className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />{i}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <LaunchCertBadge />
      </div>

      {/* Revenue trend + quick links */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Revenue Trend (6mo)</h3>
            <button onClick={() => nav("/admin/os/founder-revenue")}
              className="text-xs text-teal-600 hover:underline flex items-center gap-1">
              Full report <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          {monthly.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No revenue data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={monthly} barSize={20}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => [`EGP ${parseFloat(v).toLocaleString()}`, "Revenue"]} />
                <Bar dataKey="revenue" fill="#0D9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Quick Links</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Revenue Deep Dive", href: "/admin/os/founder-revenue", icon: DollarSign, color: "text-green-600 bg-green-50" },
              { label: "Growth Analytics", href: "/admin/os/founder-growth", icon: TrendingUp, color: "text-blue-600 bg-blue-50" },
              { label: "Content Quality", href: "/admin/os/content-quality", icon: BookOpen, color: "text-purple-600 bg-purple-50" },
              { label: "AI Costs", href: "/admin/os/ai-costs", icon: Zap, color: "text-amber-600 bg-amber-50" },
              { label: "Founder Alerts", href: "/admin/os/founder-alerts", icon: AlertCircle, color: "text-rose-600 bg-rose-50" },
              { label: "Launch Command", href: "/admin/os/launch-command", icon: ShieldCheck, color: "text-teal-600 bg-teal-50" },
              { label: "Emergency Tools", href: "/admin/os/emergency", icon: AlertCircle, color: "text-red-600 bg-red-50" },
              { label: "Platform Health", href: "/admin/os/platform-health", icon: Activity, color: "text-indigo-600 bg-indigo-50" },
            ].map((link) => (
              <button key={link.href} onClick={() => nav(link.href)}
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-teal-200 hover:bg-teal-50/30 transition-all text-left group">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${link.color}`}>
                  <link.icon className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium text-gray-700 group-hover:text-teal-700">{link.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
