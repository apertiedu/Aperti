import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fetchJSON } from "@/lib/api";
import {
  Database, RefreshCw, Zap, AlertTriangle, CheckCircle2,
  HardDrive, Activity, Clock, TrendingUp, Loader2,
} from "lucide-react";
import { SkeletonPage } from "@/components/skeleton-layouts";

function StatChip({ label, value, color = "teal" }: { label: string; value: string | number; color?: string }) {
  const cfg: Record<string, string> = {
    teal: "bg-teal-50 text-teal-700 border-teal-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    rose: "bg-rose-50 text-rose-700 border-rose-100",
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    gray: "bg-gray-50 text-gray-600 border-gray-100",
  };
  return (
    <div className={`inline-flex flex-col items-center justify-center border rounded-xl px-4 py-3 ${cfg[color]}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

export default function DBHealthPage() {
  const qc = useQueryClient();
  const [vacuuming, setVacuuming] = useState(false);
  const [vacuumMsg, setVacuumMsg] = useState<string | null>(null);
  const { data, isLoading, isFetching, refetch } = useQuery<any>({
    queryKey: ["admin-db-health"],
    queryFn: () => fetchJSON("/api/admin/db-health"),
    refetchInterval: 120_000,
    staleTime: 60_000,
    retry: false,
  });

  const handleVacuum = async () => {
    setVacuuming(true);
    setVacuumMsg(null);
    try {
      const r = await fetch("/api/admin/db-health/vacuum", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const d = await r.json();
      setVacuumMsg(d.message ?? "VACUUM completed.");
    } catch {
      setVacuumMsg("VACUUM failed — check server logs.");
    } finally {
      setVacuuming(false);
      qc.invalidateQueries({ queryKey: ["admin-db-health"] });
    }
  };

  if (isLoading) return <SkeletonPage />;

  const tables: any[] = data?.tables ?? [];
  const slowQ: any[] = data?.slowQueries ?? [];
  const conns = data?.connections ?? {};

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Database className="w-6 h-6 text-teal-600" />
            Database Health
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Live statistics from PostgreSQL · checked at {data?.checkedAt ? new Date(data.checkedAt).toLocaleTimeString() : "—"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { qc.invalidateQueries({ queryKey: ["admin-db-health"] }); refetch(); }}
            disabled={isFetching}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={handleVacuum}
            disabled={vacuuming}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-60 transition-colors"
          >
            {vacuuming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {vacuuming ? "Running…" : "Run VACUUM ANALYZE"}
          </button>
        </div>
      </div>

      {vacuumMsg && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${vacuumMsg.includes("failed") ? "bg-rose-50 text-rose-700 border border-rose-100" : "bg-teal-50 text-teal-700 border border-teal-100"}`}>
          {vacuumMsg.includes("failed") ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {vacuumMsg}
        </motion.div>
      )}

      {/* Summary chips */}
      <div className="flex flex-wrap gap-3">
        <StatChip label="Total DB Size" value={data?.dbSize ?? "—"} color="teal" />
        <StatChip label="Tables" value={tables.length} color="blue" />
        <StatChip label="Connections" value={conns.total ?? "—"} color="gray" />
        <StatChip label="Active Connections" value={conns.active ?? "—"} color={parseInt(conns.active) > 10 ? "amber" : "gray"} />
        <StatChip label="Errors (24h)" value={data?.errorCount24h ?? 0} color={(data?.errorCount24h ?? 0) > 0 ? "rose" : "gray"} />
      </div>

      {/* Slow queries */}
      {slowQ.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-bold text-amber-800">Slow Endpoints (&gt;500ms in last 24h)</p>
          </div>
          <div className="space-y-2">
            {slowQ.map((q: any, i: number) => (
              <div key={i} className="flex items-center gap-3 bg-white/70 rounded-lg px-3 py-2">
                <span className="text-xs font-mono bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">{q.method}</span>
                <span className="text-xs font-mono text-gray-700 flex-1 truncate">{q.endpoint}</span>
                <span className="text-xs font-bold text-amber-700">{q.max_ms}ms max</span>
                <span className="text-xs text-gray-400">{q.avg_ms}ms avg · {q.count}×</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table stats */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-teal-600" />
            <p className="text-sm font-bold text-gray-900">Table Sizes (Top 20)</p>
          </div>
          <p className="text-xs text-gray-400">Sorted by total size</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50/60 text-gray-400 font-semibold uppercase tracking-wider">
                <th className="text-left px-5 py-2.5">Table</th>
                <th className="text-right px-4 py-2.5">Rows</th>
                <th className="text-right px-4 py-2.5">Size</th>
                <th className="text-right px-4 py-2.5">Last Vacuum</th>
              </tr>
            </thead>
            <tbody>
              {tables.map((t: any, i: number) => (
                <motion.tr key={t.table_name}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.015 }}
                  className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-2.5 font-mono text-gray-800 font-medium">{t.table_name}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{parseInt(t.row_count ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="text-teal-700 font-semibold">{t.total_size}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-400">
                    {t.last_autovacuum ? new Date(t.last_autovacuum).toLocaleDateString() : "—"}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Connection health */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-teal-600" />
          <p className="text-sm font-bold text-gray-900">Connection Pool</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total", value: conns.total ?? "—", color: "bg-gray-100 text-gray-700" },
            { label: "Active", value: conns.active ?? "—", color: "bg-teal-100 text-teal-700" },
            { label: "Idle", value: conns.idle ?? "—", color: "bg-gray-100 text-gray-500" },
          ].map(c => (
            <div key={c.label} className={`rounded-xl p-4 text-center ${c.color}`}>
              <p className="text-2xl font-black">{c.value}</p>
              <p className="text-xs font-medium mt-1 opacity-80">{c.label}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-xs text-gray-400 pb-2">
        Queries <code>pg_stat_user_tables</code> · Auto-refreshes every 2 minutes
      </p>
    </div>
  );
}
