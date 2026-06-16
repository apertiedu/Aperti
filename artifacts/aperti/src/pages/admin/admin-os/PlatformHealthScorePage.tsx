import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Shield, Zap, Activity, Database, RefreshCw, TrendingUp } from "lucide-react";
import { fetchJSON } from "@/lib/api";


const DIM_ICONS: Record<string, any> = {
  security: Shield,
  performance: Zap,
  reliability: Activity,
  database: Database,
};

function ScoreArc({ score }: { score: number }) {
  const color = score >= 90 ? "#22c55e" : score >= 75 ? "hsl(var(--primary))" : score >= 50 ? "#f59e0b" : "#ef4444";
  const r = 56;
  const circ = Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width="140" height="80" viewBox="0 0 140 80" className="overflow-visible">
      <path d="M14 70 A56 56 0 0 1 126 70" fill="none" stroke="#e5e7eb" strokeWidth="10" strokeLinecap="round" />
      <path d="M14 70 A56 56 0 0 1 126 70" fill="none" stroke={color} strokeWidth="10"
        strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} />
      <text x="70" y="62" textAnchor="middle" fontSize="24" fontWeight="800" fill={color}>{score}</text>
    </svg>
  );
}

function DimCard({ id, dim }: { id: string; dim: any }) {
  const Icon = DIM_ICONS[id] ?? Activity;
  const color = dim.score >= 90 ? "text-green-600 bg-green-50" : dim.score >= 70 ? "text-primary bg-primary/8" : dim.score >= 50 ? "text-amber-600 bg-amber-50" : "text-red-600 bg-red-50";
  const scoreColor = dim.score >= 90 ? "#22c55e" : dim.score >= 70 ? "hsl(var(--primary))" : dim.score >= 50 ? "#f59e0b" : "#ef4444";
  const r = 16; const circ = 2 * Math.PI * r; const dash = (dim.score / 100) * circ;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4"
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800">{dim.label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{dim.detail}</p>
      </div>
      <svg width="44" height="44" viewBox="0 0 44 44" className="flex-shrink-0">
        <circle cx="22" cy="22" r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
        <circle cx="22" cy="22" r={r} fill="none" stroke={scoreColor} strokeWidth="4"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 22 22)" />
        <text x="22" y="26" textAnchor="middle" fontSize="10" fontWeight="700" fill={scoreColor}>{dim.score}</text>
      </svg>
    </motion.div>
  );
}

export default function PlatformHealthScorePage() {
  const { data, isLoading, isFetching, refetch } = useQuery<any>({
    queryKey: ["platform-health-score"],
    queryFn: () => fetchJSON("/api/founder/platform-health-score"),
    refetchInterval: 120000,
    staleTime: 60000,
  });

  const score: number = data?.composite ?? 0;
  const scoreColor = score >= 90 ? "#22c55e" : score >= 75 ? "hsl(var(--primary))" : score >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            Platform Health Score
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Composite 0–100 score across security, performance, reliability, and database</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-60 transition-colors bg-primary text-primary-foreground"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          {isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {isLoading ? (
        <div className="h-48 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 flex flex-col items-center gap-4"
          >
            <ScoreArc score={score} />
            <div className="text-center">
              <p className="text-3xl font-black" style={{ color: scoreColor }}>{data?.label ?? "—"}</p>
              <p className="text-sm text-gray-500 mt-1">Grade: <span className="font-bold" style={{ color: scoreColor }}>{data?.grade ?? "—"}</span></p>
              {data?.generatedAt && (
                <p className="text-xs text-gray-400 mt-1.5">Last computed {new Date(data.generatedAt).toLocaleTimeString()}</p>
              )}
            </div>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-3">
            {data?.dimensions && Object.entries(data.dimensions).map(([id, dim]: [string, any]) => (
              <DimCard key={id} id={id} dim={dim} />
            ))}
          </div>

          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-xs text-gray-500 space-y-1">
            <p className="font-semibold text-gray-600 mb-2">Scoring Methodology</p>
            <p><span className="font-medium text-gray-700">Security (25%):</span> Critical QA bugs, unauthorized access errors</p>
            <p><span className="font-medium text-gray-700">Performance (25%):</span> Average API latency (target &lt;500ms)</p>
            <p><span className="font-medium text-gray-700">Reliability (25%):</span> Frontend error count in last 24 hours</p>
            <p><span className="font-medium text-gray-700">Database (25%):</span> Schema completeness, active user activity</p>
          </div>
        </>
      )}
    </div>
  );
}
