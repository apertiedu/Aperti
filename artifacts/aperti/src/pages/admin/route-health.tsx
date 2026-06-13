import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Shield, Clock, Activity, Download } from "lucide-react";
import { useState } from "react";
import { apiFetch } from "@/lib/api";

type RouteCheck = {
  path: string;
  method: string;
  category: string;
  status: "pass" | "fail" | "warn";
  httpCode: number | null;
  isProtected: boolean;
  protectionOk: boolean;
  latencyMs: number | null;
  note: string;
};

type HealthReport = {
  summary: { total: number; passed: number; failed: number; warned: number; protectionViolations: number; avgLatencyMs: number };
  routes: RouteCheck[];
  generatedAt: string;
};

function StatusIcon({ status }: { status: "pass" | "fail" | "warn" }) {
  if (status === "pass") return <CheckCircle className="h-4 w-4 text-emerald-500" />;
  if (status === "fail") return <XCircle className="h-4 w-4 text-red-500" />;
  return <AlertCircle className="h-4 w-4 text-amber-500" />;
}

function StatusBadge({ status }: { status: "pass" | "fail" | "warn" }) {
  const variants = { pass: "bg-emerald-100 text-emerald-700", fail: "bg-red-100 text-red-700", warn: "bg-amber-100 text-amber-700" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${variants[status]}`}>{status.toUpperCase()}</span>;
}

export default function RouteHealthPage() {
  const [runKey, setRunKey] = useState(0);
  const [filter, setFilter] = useState<"all" | "pass" | "fail" | "warn">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const { data, isLoading, isFetching } = useQuery<HealthReport>({
    queryKey: ["admin", "route-health", runKey],
    queryFn: () => apiFetch("/api/admin/route-health"),
    staleTime: 0,
    refetchOnMount: true,
  });

  const routes = data?.routes ?? [];
  const categories = ["all", ...Array.from(new Set(routes.map(r => r.category)))];
  const filtered = routes.filter(r =>
    (filter === "all" || r.status === filter) &&
    (categoryFilter === "all" || r.category === categoryFilter)
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Route Health</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Audit all API endpoints — availability, auth protection & latency</p>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => {
              const csv = [
                ["Method","Path","Category","Status","HTTP","Auth","Latency(ms)","Note"].join(","),
                ...data.routes.map(r => [r.method, r.path, r.category, r.status, r.httpCode ?? "", r.isProtected ? (r.protectionOk ? "OK" : "BREACH") : "Public", r.latencyMs ?? "", `"${r.note}"`].join(","))
              ].join("\n");
              const a = document.createElement("a");
              a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
              a.download = `route-health-${new Date().toISOString().slice(0,10)}.csv`;
              a.click();
            }}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          )}
          <Button onClick={() => setRunKey(k => k + 1)} disabled={isLoading || isFetching} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            {isFetching ? "Scanning…" : "Run Scan"}
          </Button>
        </div>
      </div>

      {/* Health score bar */}
      {data && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-foreground">Overall Route Health Score</span>
            <span className={`text-sm font-bold ${data.summary.passed / data.summary.total >= 0.9 ? "text-emerald-600" : data.summary.passed / data.summary.total >= 0.7 ? "text-amber-600" : "text-red-600"}`}>
              {Math.round((data.summary.passed / data.summary.total) * 100)}%
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all duration-700 ${data.summary.passed / data.summary.total >= 0.9 ? "bg-emerald-500" : data.summary.passed / data.summary.total >= 0.7 ? "bg-amber-500" : "bg-red-500"}`}
              style={{ width: `${Math.round((data.summary.passed / data.summary.total) * 100)}%` }}
            />
          </div>
          <div className="flex items-center gap-4 mt-1.5">
            <span className="text-xs text-muted-foreground">{data.summary.passed} passed</span>
            {data.summary.failed > 0 && <span className="text-xs text-red-600">{data.summary.failed} failed</span>}
            {data.summary.warned > 0 && <span className="text-xs text-amber-600">{data.summary.warned} warned</span>}
            {data.summary.protectionViolations > 0 && <span className="text-xs text-red-600 font-semibold">{data.summary.protectionViolations} auth breach{data.summary.protectionViolations > 1 ? "es" : ""}</span>}
          </div>
        </div>
      )}

      {/* Summary cards */}
      {isLoading || isFetching ? (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            { label: "Total Routes", value: data.summary.total, color: "text-foreground", bg: "bg-muted/50" },
            { label: "Passed", value: data.summary.passed, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
            { label: "Failed", value: data.summary.failed, color: "text-red-600", bg: "bg-red-50 dark:bg-red-900/20" },
            { label: "Warnings", value: data.summary.warned, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20" },
            { label: "Auth Violations", value: data.summary.protectionViolations, color: data.summary.protectionViolations > 0 ? "text-red-600" : "text-emerald-600", bg: data.summary.protectionViolations > 0 ? "bg-red-50 dark:bg-red-900/20" : "bg-emerald-50 dark:bg-emerald-900/20" },
            { label: "Avg Latency", value: `${data.summary.avgLatencyMs}ms`, color: data.summary.avgLatencyMs > 500 ? "text-amber-600" : "text-emerald-600", bg: "bg-muted/50" },
          ].map(({ label, value, color, bg }) => (
            <Card key={label} className={`shadow-sm ${bg}`}>
              <CardContent className="p-4">
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="shadow-sm">
          <CardContent className="p-8 text-center text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Click "Run Scan" to audit all routes</p>
            <p className="text-sm mt-1">This checks every registered API endpoint for availability, auth, and latency.</p>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      {data && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm font-medium text-muted-foreground">Status:</span>
          {(["all", "pass", "fail", "warn"] as const).map(f => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </Button>
          ))}
          <span className="text-sm font-medium text-muted-foreground ml-2">Category:</span>
          {categories.map(c => (
            <Button key={c} variant={categoryFilter === c ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setCategoryFilter(c)}>
              {c === "all" ? "All" : c}
            </Button>
          ))}
          <span className="text-xs text-muted-foreground ml-auto">
            {filtered.length} of {routes.length} routes
          </span>
        </div>
      )}

      {/* Route table */}
      {data && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Route Audit Results
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Method</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Path</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Category</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">HTTP</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Auth</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 inline mr-1" />Latency
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5"><div className="flex items-center gap-1.5"><StatusIcon status={r.status} /><StatusBadge status={r.status} /></div></td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${r.method === "GET" ? "bg-blue-100 text-blue-700" : r.method === "POST" ? "bg-emerald-100 text-emerald-700" : r.method === "PUT" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                          {r.method}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-foreground max-w-64 truncate">{r.path}</td>
                      <td className="px-4 py-2.5"><Badge variant="outline" className="text-[10px]">{r.category}</Badge></td>
                      <td className="px-4 py-2.5 text-xs font-mono">{r.httpCode ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        {r.isProtected
                          ? r.protectionOk
                            ? <span className="flex items-center gap-1 text-emerald-600 text-xs"><CheckCircle className="h-3 w-3" />OK</span>
                            : <span className="flex items-center gap-1 text-red-600 text-xs font-semibold"><XCircle className="h-3 w-3" />BREACH</span>
                          : <span className="text-muted-foreground text-xs">Public</span>
                        }
                      </td>
                      <td className="px-4 py-2.5 text-xs font-mono">{r.latencyMs !== null ? `${r.latencyMs}ms` : "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-48 truncate">{r.note}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-sm">No routes match the current filter</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {data && (
        <p className="text-xs text-muted-foreground text-right">
          Scan completed at {new Date(data.generatedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
