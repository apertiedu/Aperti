import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { TrendingDown, RefreshCw, Users, AlertTriangle, MousePointerClick } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const tok = () => localStorage.getItem("aperti_token") || "";
const api = (path: string) =>
  fetch(path, { headers: { Authorization: `Bearer ${tok()}` } }).then(r => r.json());

const STEP_LABELS: Record<string, string> = {
  registration:  "Registration",
  onboarding:    "Onboarding",
  payment:       "Payment",
  enrollment:    "Enrollment",
  exam_start:    "Exam Start",
  exam_submit:   "Exam Submit",
  profile_setup: "Profile Setup",
  login:         "Login",
};

export default function FrictionAnalyticsPage() {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["friction-analytics"],
    queryFn: () => api("/api/founder/friction-analytics"),
    refetchInterval: 120000,
    staleTime: 60000,
  });

  const byStep: any[]   = data?.byStep ?? [];
  const byDay: any[]    = data?.byDay ?? [];
  const topDrops: any[] = data?.topDrops ?? [];
  const total: number   = data?.total ?? 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingDown className="w-6 h-6 text-purple-600" />
            Friction Analytics
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Where users drop off — registration, payment, enrollment &amp; more</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-60 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "Total Friction Events (30d)", value: total, icon: MousePointerClick, color: "text-purple-600" },
          { label: "Top Drop-off Step",
            value: topDrops[0]?.step ? (STEP_LABELS[topDrops[0].step] ?? topDrops[0].step) : "None recorded",
            icon: AlertTriangle, color: "text-red-500" },
          { label: "Steps Tracked", value: byStep.length, icon: Users, color: "text-blue-600" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
                <p className="text-base font-bold text-gray-900">{s.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {isLoading ? (
        <div className="h-48 bg-gray-50 rounded-2xl animate-pulse" />
      ) : total === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <TrendingDown className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500">No friction events recorded yet</p>
            <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
              The platform tracks where users abandon flows. Events will populate as real users interact with registration, payment, and enrollment.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Top drop-offs */}
          {topDrops.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm font-semibold text-gray-700">Top Drop-off Points</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {topDrops.map((d: any, i: number) => (
                  <motion.div key={d.step} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">
                        {STEP_LABELS[d.step] ?? d.step}
                      </span>
                      <Badge variant={i === 0 ? "destructive" : "secondary"} className="text-[10px]">
                        {d.drop_offs} drop-off{parseInt(d.drop_offs) !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${i === 0 ? "bg-red-500" : i === 1 ? "bg-amber-500" : "bg-blue-400"}`}
                        style={{ width: `${Math.min(100, (parseInt(d.drop_offs) / (parseInt(topDrops[0].drop_offs) || 1)) * 100)}%` }}
                      />
                    </div>
                  </motion.div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* 14-day trend */}
          {byDay.length > 1 && (
            <Card>
              <CardHeader><CardTitle className="text-sm font-semibold text-gray-700">14-Day Friction Trend</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={byDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} width={24} />
                    <Tooltip />
                    <Bar dataKey="events" fill="#9333ea" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* By step breakdown */}
          {byStep.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm font-semibold text-gray-700">All Steps (30d)</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-50">
                  {byStep.map((s: any) => (
                    <div key={`${s.step}-${s.route}`} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {STEP_LABELS[s.step] ?? s.step}
                        </p>
                        {s.route && <p className="text-xs text-gray-400 truncate">{s.route}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {parseInt(s.errors) > 0 && (
                          <Badge variant="destructive" className="text-[10px]">{s.errors} err</Badge>
                        )}
                        {parseInt(s.drop_offs) > 0 && (
                          <Badge className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">{s.drop_offs} drop</Badge>
                        )}
                        <span className="text-sm font-semibold text-gray-700 tabular-nums">{s.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
