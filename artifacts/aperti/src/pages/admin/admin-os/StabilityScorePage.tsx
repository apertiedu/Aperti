import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, Minus, RefreshCw, Zap, AlertTriangle,
  CheckCircle2, Activity
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

const api = (path: string) =>
  fetch(path, { credentials: "include" }).then(r => r.json());

function ScoreRing({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const color = pct >= 80 ? "#22c55e" : pct >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative w-40 h-40 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#f1f5f9" strokeWidth="10" />
        <circle
          cx="64" cy="64" r={r} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black tabular-nums" style={{ color }}>{pct}</span>
        <span className="text-xs text-gray-400 font-medium">/ 100</span>
      </div>
    </div>
  );
}

export default function StabilityScorePage() {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["stability-score"],
    queryFn: () => api("/api/founder/stability-score"),
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const today: number = data?.today ?? 0;
  const trend: string = data?.trend ?? "stable";
  const history: any[] = (data?.history ?? []).reverse();
  const errorCount: number = data?.errorCount ?? 0;
  const avgLatency: number = data?.avgLatency ?? 0;

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "text-green-500" : trend === "down" ? "text-red-500" : "text-gray-400";

  const scoreLabel = today >= 80 ? "Excellent" : today >= 60 ? "Needs Attention" : "Critical";
  const scoreBg    = today >= 80 ? "bg-green-50 border-green-100" : today >= 60 ? "bg-amber-50 border-amber-100" : "bg-red-50 border-red-100";
  const scoreTxt   = today >= 80 ? "text-green-700" : today >= 60 ? "text-amber-700" : "text-red-700";

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-teal-600" />
            Stability Score
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Daily platform health score (0–100) computed from errors, uptime, and latency</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-60 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="h-64 bg-gray-50 rounded-2xl animate-pulse" />
      ) : (
        <>
          {/* Score card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border p-6 ${scoreBg}`}
          >
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <ScoreRing score={today} />
              <div className="flex-1 text-center sm:text-left">
                <div className="flex items-center gap-2 justify-center sm:justify-start mb-1">
                  <span className={`text-xl font-bold ${scoreTxt}`}>{scoreLabel}</span>
                  <TrendIcon className={`w-5 h-5 ${trendColor}`} />
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Today's platform stability score based on real-time data.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/70 p-3">
                    <p className="text-xs text-gray-500">Errors (24h)</p>
                    <p className={`text-lg font-bold tabular-nums ${errorCount > 5 ? "text-red-600" : "text-gray-800"}`}>{errorCount}</p>
                  </div>
                  <div className="rounded-xl bg-white/70 p-3">
                    <p className="text-xs text-gray-500">Avg Query Latency</p>
                    <p className={`text-lg font-bold tabular-nums ${avgLatency > 1000 ? "text-red-600" : avgLatency > 500 ? "text-amber-600" : "text-gray-800"}`}>
                      {avgLatency > 0 ? `${avgLatency}ms` : "—"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Score formula explanation */}
          <Card>
            <CardHeader><CardTitle className="text-sm font-semibold text-gray-700">Score Formula</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                <span>Base score: <strong>100</strong></span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Each frontend error (24h) deducts <strong>2 points</strong> (max −40)</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Zap className="w-4 h-4 text-blue-500 shrink-0" />
                <span>Avg query &gt;500ms deducts <strong>10 points</strong>; &gt;1000ms deducts <strong>20 points</strong></span>
              </div>
            </CardContent>
          </Card>

          {/* 7-day history */}
          {history.length > 1 && (
            <Card>
              <CardHeader><CardTitle className="text-sm font-semibold text-gray-700">7-Day Score History</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={history}>
                    <XAxis
                      dataKey="scored_at"
                      tick={{ fontSize: 10 }}
                      tickFormatter={v => new Date(v).toLocaleDateString("en", { weekday: "short" })}
                    />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={28} />
                    <Tooltip formatter={(v: any) => [`${v}`, "Score"]} />
                    <ReferenceLine y={80} stroke="#22c55e" strokeDasharray="3 3" label={{ value: "80", fontSize: 9 }} />
                    <Line type="monotone" dataKey="score" stroke="#14b8a6" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {history.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center text-gray-400">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Score history will accumulate over the next 7 days.</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
