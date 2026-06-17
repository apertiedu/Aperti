import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Brain, AlertTriangle, Activity, ShieldCheck, Zap, RefreshCw, Eye, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function RiskBadge({ score }: { score: number }) {
  if (score >= 0.7) return <Badge className="bg-red-100 text-red-800 border-red-200 text-[10px] font-bold border">High Risk {Math.round(score * 100)}%</Badge>;
  if (score >= 0.4) return <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] font-bold border">Medium {Math.round(score * 100)}%</Badge>;
  return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold border">Low {Math.round(score * 100)}%</Badge>;
}

function SeverityBadge({ severity }: { severity: string }) {
  const cfg: Record<string, string> = {
    critical: "bg-red-100 text-red-800 border-red-200",
    high:     "bg-orange-100 text-orange-800 border-orange-200",
    medium:   "bg-amber-100 text-amber-800 border-amber-200",
    low:      "bg-blue-100 text-blue-700 border-blue-200",
  };
  return <Badge className={`text-[10px] font-semibold border ${cfg[severity] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>{severity}</Badge>;
}

function StatCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-gray-500 font-medium">{label}</p>
          <p className="text-xl font-black text-gray-900">{value}</p>
          {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function FinancialAnomalyDetection() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: fraudAlerts = [], isLoading: alertsLoading } = useQuery<any[]>({
    queryKey: ["admin-fraud-alerts"],
    queryFn: async () => {
      const r = await fetch("/api/ai-anomaly/fraud-alerts", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      const j = await r.json();
      return Array.isArray(j) ? j : (j.alerts ?? []);
    },
    retry: false,
    refetchInterval: 60_000,
  });

  const { data: predictions = [], isLoading: predLoading } = useQuery<any[]>({
    queryKey: ["admin-anomaly-predictions"],
    queryFn: async () => {
      const r = await fetch("/api/ai-anomaly/predictions", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      const j = await r.json();
      return Array.isArray(j) ? j : (j.predictions ?? []);
    },
    retry: false,
    refetchInterval: 60_000,
  });

  const batchScanMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/ai-anomaly/batch-scan", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!r.ok) throw new Error("Batch scan failed");
      return r.json();
    },
    onSuccess: (data) => {
      toast({ title: `Batch scan complete — ${data.scanned ?? 0} users analyzed` });
      qc.invalidateQueries({ queryKey: ["admin-anomaly-predictions"] });
      qc.invalidateQueries({ queryKey: ["admin-fraud-alerts"] });
    },
    onError: () => toast({ title: "Batch scan failed", variant: "destructive" }),
  });

  const critical = fraudAlerts.filter((a: any) => a.severity === "critical").length;
  const high     = fraudAlerts.filter((a: any) => a.severity === "high").length;
  const open     = fraudAlerts.filter((a: any) => a.status === "open").length;
  const highRisk = predictions.filter((p: any) => parseFloat(p.risk_score) >= 0.7).length;

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <Brain className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AI Financial Anomaly Detection</h1>
              <p className="text-sm text-gray-500">GPT-powered fraud & risk signal analysis</p>
            </div>
          </div>
          <Button
            onClick={() => batchScanMutation.mutate()}
            disabled={batchScanMutation.isPending}
            className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${batchScanMutation.isPending ? "animate-spin" : ""}`} />
            {batchScanMutation.isPending ? "Scanning..." : "Run Batch Scan"}
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={AlertTriangle}  label="Critical Alerts"  value={critical}  color="bg-red-100 text-red-600" />
        <StatCard icon={ShieldCheck}    label="High Severity"    value={high}      color="bg-orange-100 text-orange-600" />
        <StatCard icon={Activity}       label="Open Alerts"      value={open}      color="bg-amber-100 text-amber-600" />
        <StatCard icon={TrendingUp}     label="High-Risk Users"  value={highRisk}  color="bg-purple-100 text-purple-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Fraud Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {alertsLoading ? (
              <div className="p-6 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-gray-100 animate-pulse rounded-lg" />)}</div>
            ) : fraudAlerts.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-20" />
                No fraud alerts detected
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-xs">User</TableHead>
                    <TableHead className="text-xs">Reason</TableHead>
                    <TableHead className="text-xs">Severity</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fraudAlerts.slice(0, 15).map((a: any) => (
                    <TableRow key={a.id} className="hover:bg-gray-50">
                      <TableCell className="text-xs">{a.username ?? `User ${a.user_id}`}</TableCell>
                      <TableCell className="text-xs max-w-[180px] truncate">{a.reason ?? a.description}</TableCell>
                      <TableCell><SeverityBadge severity={a.severity} /></TableCell>
                      <TableCell className="text-xs text-gray-500">{new Date(a.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-500" />
              AI Risk Predictions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {predLoading ? (
              <div className="p-6 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-gray-100 animate-pulse rounded-lg" />)}</div>
            ) : predictions.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                <Brain className="h-10 w-10 mx-auto mb-3 opacity-20" />
                Run a batch scan to generate predictions
              </div>
            ) : (
              <div className="divide-y">
                {predictions.slice(0, 12).map((p: any) => {
                  const score = parseFloat(p.risk_score ?? 0);
                  return (
                    <div key={p.id} className="px-4 py-3 hover:bg-gray-50">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold text-gray-800">{p.username ?? `User ${p.user_id}`}</p>
                        <RiskBadge score={score} />
                      </div>
                      <Progress value={score * 100} className="h-1.5 mb-1" />
                      {p.explanation && (
                        <p className="text-[11px] text-gray-400 truncate">{p.explanation}</p>
                      )}
                      <p className="text-[10px] text-gray-300 mt-0.5">{new Date(p.created_at).toLocaleString()}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
