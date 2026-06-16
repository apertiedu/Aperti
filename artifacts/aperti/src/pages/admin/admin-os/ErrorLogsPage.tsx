import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fetchJSON } from "@/lib/api";
import { AlertCircle, AlertTriangle, Info, RefreshCw, Search, Download, X } from "lucide-react";
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

const TIME_OPTIONS = [
  { label: "1h",  value: "1" },
  { label: "24h", value: "24" },
  { label: "7d",  value: "168" },
  { label: "All", value: "all" },
];

const SOURCE_OPTIONS = [
  { label: "All",      value: "all" },
  { label: "Browser",  value: "browser" },
  { label: "Backend",  value: "server" },
];

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

function exportCSV(rows: any[]) {
  const header = ["id", "level", "message", "route", "role", "device", "browser", "created_at"];
  const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [header.join(","), ...rows.map(r => header.map(k => escape(r[k])).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `error-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function ErrorLogsPage() {
  const [search, setSearch]         = useState("");
  const [filterLevel, setFilterLevel] = useState("all");
  const [timeRange, setTimeRange]   = useState("24");
  const [source, setSource]         = useState("all");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["founder-error-logs", timeRange, source],
    queryFn: () => {
      const params = new URLSearchParams();
      if (timeRange !== "all") params.set("hours", timeRange);
      if (source !== "all") params.set("source", source);
      return fetchJSON(`/api/founder/error-logs?${params}`);
    },
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

  const hasFilters = filterLevel !== "all" || search !== "" || timeRange !== "24" || source !== "all";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Error Logs</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Frontend and backend errors — {data?.total ?? 0} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm"
            onClick={() => exportCSV(filtered)}
            disabled={filtered.length === 0}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
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
              <p className="text-xs opacity-70">matched</p>
            </motion.div>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
          {TIME_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setTimeRange(opt.value)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                timeRange === opt.value
                  ? "bg-white shadow-sm text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
          {SOURCE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setSource(opt.value)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                source === opt.value
                  ? "bg-white shadow-sm text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search message, route, browser…"
            className="pl-9"
          />
        </div>
        {hasFilters && (
          <Button
            variant="ghost" size="sm"
            onClick={() => { setFilterLevel("all"); setSearch(""); setTimeRange("24"); setSource("all"); }}
            className="gap-1 text-gray-500"
          >
            <X className="w-3 h-3" /> Clear
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Source</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${60 + (i + j) % 3 * 20}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <AlertCircle className="w-8 h-8 opacity-30" />
                      <p className="text-sm font-medium">No error logs found</p>
                      <p className="text-xs">Try expanding the time range or clearing the filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((log: any, i: number) => (
                  <motion.tr
                    key={log.id ?? i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.01 }}
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
        {filtered.length > 0 && (
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">{filtered.length} log{filtered.length !== 1 ? "s" : ""} shown</p>
            <button
              onClick={() => exportCSV(filtered)}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Download className="w-3 h-3" /> Download CSV
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
