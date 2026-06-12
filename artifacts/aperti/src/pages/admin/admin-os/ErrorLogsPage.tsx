import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fetchJSON } from "@/lib/api";
import { AlertCircle, AlertTriangle, Info, RefreshCw, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const LEVEL_BADGE: Record<string, string> = {
  error: "bg-red-100 text-red-700 border-red-200",
  warn:  "bg-yellow-100 text-yellow-700 border-yellow-200",
  info:  "bg-blue-100 text-blue-700 border-blue-200",
};

const LEVEL_ICON: Record<string, typeof AlertCircle> = {
  error: AlertCircle,
  warn:  AlertTriangle,
  info:  Info,
};

function LevelBadge({ level }: { level: string }) {
  const cls = LEVEL_BADGE[level] ?? LEVEL_BADGE.error;
  const Icon = LEVEL_ICON[level] ?? AlertCircle;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      <Icon className="w-3 h-3" />
      {level}
    </span>
  );
}

export default function ErrorLogsPage() {
  const [search, setSearch] = useState("");
  const [filterLevel, setFilterLevel] = useState("all");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["founder-error-logs"],
    queryFn: () => fetchJSON("/api/founder/error-logs"),
    refetchInterval: 30000,
  });

  const logs: any[] = data?.logs ?? [];

  const filtered = logs.filter(l => {
    const matchLevel = filterLevel === "all" || l.level === filterLevel;
    const matchSearch = !search || [l.message, l.route, l.browser, l.role].some(
      v => v && String(v).toLowerCase().includes(search.toLowerCase()),
    );
    return matchLevel && matchSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Error Logs</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Frontend and backend errors captured in real time
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {(["error", "warn", "info"] as const).map(level => {
          const count = logs.filter(l => l.level === level).length;
          const Icon = LEVEL_ICON[level];
          const colors: Record<string, string> = {
            error: "border-red-100 bg-red-50 text-red-700",
            warn:  "border-yellow-100 bg-yellow-50 text-yellow-700",
            info:  "border-blue-100 bg-blue-50 text-blue-700",
          };
          return (
            <motion.div
              key={level}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-xl border-2 p-4 cursor-pointer transition-all ${colors[level]} ${filterLevel === level ? "ring-2 ring-offset-1 ring-current" : ""}`}
              onClick={() => setFilterLevel(filterLevel === level ? "all" : level)}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">{level}</span>
              </div>
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-xs opacity-70">in last 500</p>
            </motion.div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search message, route, browser…"
            className="pl-9"
          />
        </div>
        {filterLevel !== "all" && (
          <Button variant="ghost" size="sm" onClick={() => setFilterLevel("all")}>
            Clear filter
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Severity</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Message</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Route</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Device</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading…</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <AlertCircle className="w-8 h-8 opacity-30" />
                      <p className="text-sm">No error logs found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((log: any, i: number) => (
                  <motion.tr
                    key={log.id ?? i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-4 py-3"><LevelBadge level={log.level ?? "error"} /></td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="font-medium text-gray-900 truncate">{log.message}</p>
                      {log.stack && (
                        <p className="text-xs text-gray-400 truncate font-mono mt-0.5">{log.stack.split("\n")[0]}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{log.route || "—"}</td>
                    <td className="px-4 py-3">
                      {log.role ? (
                        <Badge variant="secondary" className="text-xs">{log.role}</Badge>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[120px] truncate">{log.device || log.browser || "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {log.created_at ? new Date(log.created_at).toLocaleString() : "—"}
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
