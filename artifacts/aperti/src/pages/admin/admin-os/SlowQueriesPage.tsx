import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Clock, RefreshCw, AlertTriangle, Zap, Database } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const api = (path: string) =>
  fetch(path, { credentials: "include" }).then(r => r.json());

function SeverityBadge({ ms }: { ms: number }) {
  if (ms > 2000) return <Badge variant="destructive" className="text-[10px]">Critical &gt;2s</Badge>;
  if (ms > 1000) return <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">Slow &gt;1s</Badge>;
  return <Badge variant="outline" className="text-[10px] text-gray-500">Moderate</Badge>;
}

export default function SlowQueriesPage() {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["slow-queries"],
    queryFn: () => api("/api/founder/slow-queries"),
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const queries: any[] = data?.queries ?? [];
  const stats = data?.stats ?? {};

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Clock className="w-6 h-6 text-amber-600" />
            Slow Query Monitor
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Database queries that took longer than 500ms</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-60 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total (24h)", value: stats.total ?? 0, icon: Database, color: "text-blue-600" },
          { label: "Avg Duration", value: stats.avg_ms ? `${stats.avg_ms}ms` : "—", icon: Clock, color: "text-primary" },
          { label: "Slowest", value: stats.max_ms ? `${stats.max_ms}ms` : "—", icon: Zap, color: "text-orange-600" },
          { label: "Critical (>2s)", value: stats.critical_count ?? 0, icon: AlertTriangle, color: "text-red-600" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
                <p className="text-lg font-bold tabular-nums text-gray-900">{s.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-gray-700">Recent Slow Queries</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-400">Loading query log…</p>
            </div>
          ) : queries.length === 0 ? (
            <div className="p-10 text-center">
              <Clock className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">No slow queries recorded</p>
              <p className="text-xs text-gray-400 mt-1">
                Queries taking longer than 500ms will be logged here automatically.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Query</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queries.map((q: any) => (
                  <TableRow key={q.id}>
                    <TableCell className="max-w-xs">
                      <code className="text-xs text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded break-all line-clamp-2">
                        {q.query_preview || "—"}
                      </code>
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">{q.route || "—"}</TableCell>
                    <TableCell>
                      <span className={`text-sm font-mono font-bold ${q.duration_ms > 2000 ? "text-red-600" : q.duration_ms > 1000 ? "text-amber-600" : "text-gray-700"}`}>
                        {q.duration_ms}ms
                      </span>
                    </TableCell>
                    <TableCell><SeverityBadge ms={q.duration_ms} /></TableCell>
                    <TableCell className="text-xs text-gray-400">
                      {q.created_at ? new Date(q.created_at).toLocaleString() : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-gray-400 text-center pb-2">
        Queries are logged automatically when duration exceeds 500ms · Refreshes every 30s
      </p>
    </div>
  );
}
