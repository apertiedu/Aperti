import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, CheckCircle2, XCircle, Activity, BarChart3, AlertTriangle, RefreshCw, Play } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const SCENARIOS = [
  { value: "payment_stress",  label: "Payment Stress",    desc: "1000 simultaneous payment queries",     color: "bg-emerald-100 text-emerald-700" },
  { value: "fraud_stress",    label: "Fraud System",      desc: "Burst of suspicious activity signals",  color: "bg-red-100 text-red-700" },
  { value: "dashboard_load",  label: "Dashboard Load",    desc: "Heavy analytics query burst",           color: "bg-blue-100 text-blue-700" },
  { value: "ai_stress",       label: "AI Stress",         desc: "Bulk AI interaction queries",           color: "bg-purple-100 text-purple-700" },
  { value: "failure_db",      label: "Simulate DB Fail",  desc: "Verify graceful DB degradation",        color: "bg-orange-100 text-orange-700" },
  { value: "failure_ai",      label: "Simulate AI Fail",  desc: "Verify fallback when AI is down",       color: "bg-violet-100 text-violet-700" },
  { value: "full_suite",      label: "Full Suite",        desc: "Run all performance scenarios",         color: "bg-gray-100 text-gray-700" },
];

function ResultCard({ result }: { result: any }) {
  const score = Math.max(0, Math.min(100, Math.round(100 - (result.p95_ms / 20) - (result.error_rate * 5))));
  return (
    <Card className={`border-0 shadow-sm ${result.passed ? "ring-1 ring-emerald-200" : "ring-1 ring-red-200"}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-bold text-gray-900 capitalize">{result.scenario.replace("_", " ")}</p>
            <p className="text-[11px] text-gray-500">{result.iterations} iterations · {result.duration_ms}ms total</p>
          </div>
          {result.passed
            ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            : <XCircle className="h-5 w-5 text-red-500" />}
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: "avg",  value: `${result.avg_ms}ms` },
            { label: "p95",  value: `${result.p95_ms}ms` },
            { label: "p99",  value: `${result.p99_ms}ms` },
          ].map(({ label, value }) => (
            <div key={label} className="text-center p-2 bg-gray-50 rounded-lg">
              <p className="text-[10px] text-gray-400 uppercase">{label}</p>
              <p className="text-xs font-bold text-gray-800">{value}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-500">Performance Score</span>
          <span className={`font-bold ${score >= 70 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-red-600"}`}>{score}%</span>
        </div>
        <Progress value={score} className="h-1.5 mb-2" />
        {result.error_count > 0 && (
          <p className="text-[11px] text-red-600">{result.error_count} errors ({result.error_rate}% error rate)</p>
        )}
        <p className="text-[10px] text-gray-400 mt-1 truncate">{result.details}</p>
      </CardContent>
    </Card>
  );
}

export default function LoadSimulation() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [scenario, setScenario] = useState("payment_stress");
  const [iterations, setIterations] = useState(50);
  const [lastResults, setLastResults] = useState<any>(null);

  const { data: metrics } = useQuery<any>({
    queryKey: ["load-sim-metrics"],
    queryFn: async () => {
      const r = await fetch("/api/load-sim/metrics", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    refetchInterval: 60_000,
  });

  const { data: history } = useQuery<any>({
    queryKey: ["load-sim-history"],
    queryFn: async () => {
      const r = await fetch("/api/load-sim/history", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/load-sim/run", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario, iterations }),
      });
      if (!r.ok) throw new Error("Simulation failed");
      return r.json();
    },
    onSuccess: (data) => {
      setLastResults(data);
      qc.invalidateQueries({ queryKey: ["load-sim-history"] });
      toast({
        title: data.overall_passed ? "Simulation passed all thresholds" : "Simulation found performance issues",
        variant: data.overall_passed ? "default" : "destructive",
      });
    },
    onError: () => toast({ title: "Simulation run failed", variant: "destructive" }),
  });

  const metricRows: any[] = metrics?.metrics ?? [];
  const historyRows: any[] = history?.history ?? [];

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <Zap className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Load & Failure Simulation</h1>
              <p className="text-sm text-gray-500">Stress testing, p95/p99 metrics & graceful degradation checks</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Scenario selector */}
      <Card className="border-0 shadow-sm mb-8">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <p className="text-xs font-semibold text-gray-500 mb-2">Scenario</p>
              <Select value={scenario} onValueChange={setScenario}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCENARIOS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      <div>
                        <span className="font-semibold">{s.label}</span>
                        <span className="text-gray-400 text-xs ml-2">{s.desc}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Iterations</p>
              <Select value={String(iterations)} onValueChange={(v) => setIterations(parseInt(v, 10))}>
                <SelectTrigger className="w-32 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100, 150, 200].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} iterations</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="bg-amber-500 hover:bg-amber-600 text-white gap-2"
              disabled={runMutation.isPending}
              onClick={() => runMutation.mutate()}
            >
              {runMutation.isPending
                ? <><RefreshCw className="h-4 w-4 animate-spin" />Running…</>
                : <><Play className="h-4 w-4" />Run Simulation</>}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            {SCENARIOS.map((s) => (
              <button
                key={s.value}
                onClick={() => setScenario(s.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${scenario === s.value ? s.color + " border-current/30" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {lastResults && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            {lastResults.overall_passed
              ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              : <XCircle className="h-5 w-5 text-red-500" />}
            <h2 className="text-base font-semibold text-gray-900">{lastResults.verdict}</h2>
            <Badge className={`border ${lastResults.overall_passed ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-red-100 text-red-800 border-red-200"}`}>
              p95 worst: {lastResults.overall_p95_ms}ms
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lastResults.results?.map((r: any) => <ResultCard key={r.scenario} result={r} />)}
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live API Metrics */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />Live API Metrics (30 min)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {metricRows.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">No API metrics yet — make some requests first</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50 text-gray-500">
                    <th className="text-left px-4 py-2">Endpoint</th>
                    <th className="text-right px-3 py-2">Reqs</th>
                    <th className="text-right px-3 py-2">Avg</th>
                    <th className="text-right px-3 py-2">p95</th>
                    <th className="text-right px-3 py-2">Errors</th>
                  </tr></thead>
                  <tbody className="divide-y">
                    {metricRows.slice(0, 10).map((m: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-mono text-[10px] text-gray-700 max-w-[200px] truncate">{m.endpoint}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{m.request_count}</td>
                        <td className="px-3 py-2 text-right">{m.avg_ms}ms</td>
                        <td className={`px-3 py-2 text-right font-semibold ${(m.p95_ms ?? 0) > 500 ? "text-amber-600" : "text-gray-700"}`}>{m.p95_ms}ms</td>
                        <td className={`px-3 py-2 text-right ${m.error_count > 0 ? "text-red-600 font-semibold" : "text-gray-400"}`}>{m.error_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Simulation history */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-purple-500" />Simulation History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {historyRows.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">No simulations run yet</div>
            ) : (
              <div className="divide-y">
                {historyRows.map((h: any) => {
                  const payload = typeof h.payload === "string" ? JSON.parse(h.payload) : h.payload;
                  const passed = payload?.results?.every((r: any) => r.passed) ?? false;
                  const worstP95 = payload?.results?.reduce((m: number, r: any) => Math.max(m, r.p95 ?? 0), 0) ?? 0;
                  return (
                    <div key={h.id} className="px-4 py-3 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-gray-800 capitalize">{payload?.scenario?.replace("_", " ") ?? "unknown"}</p>
                          <p className="text-[10px] text-gray-400">{payload?.iterations} iterations · by {h.run_by ?? "admin"}</p>
                        </div>
                        <div className="text-right">
                          {passed
                            ? <Badge className="text-[10px] bg-emerald-100 text-emerald-800 border-emerald-200 border">pass</Badge>
                            : <Badge className="text-[10px] bg-red-100 text-red-800 border-red-200 border">fail</Badge>}
                          {worstP95 > 0 && <p className="text-[10px] text-gray-400 mt-0.5">p95: {worstP95}ms</p>}
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-300 mt-1">{new Date(h.created_at).toLocaleString()}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Failure simulation guide */}
      <Card className="border-0 shadow-sm mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />Graceful Degradation Rules
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 pt-0">
          {[
            { title: "DB Failure", rule: "All routes have try/catch → 500 response. No unhandled rejections. safeHandler wraps all async routes.", color: "border-blue-200 bg-blue-50" },
            { title: "AI Failure", rule: "AI_CONFIG.isConfigured gates all AI calls. Fallback text returned when AI unavailable. No hard dependency on AI for data reads.", color: "border-purple-200 bg-purple-50" },
            { title: "Fraud Service Down", rule: "Payments proceed with manual review flag. Fraud check failure logged to domain_events. No payment blocking without explicit fraud confirmation.", color: "border-amber-200 bg-amber-50" },
          ].map(({ title, rule, color }) => (
            <div key={title} className={`p-3 rounded-lg border ${color}`}>
              <p className="text-xs font-bold text-gray-800 mb-1">{title}</p>
              <p className="text-[11px] text-gray-600">{rule}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
