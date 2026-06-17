import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Database, CheckCircle2, XCircle, AlertTriangle, Lock, Shield, RefreshCw, Bookmark } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function CheckBadge({ status }: { status: "pass" | "fail" | "warn" | "skip" }) {
  const cfg = {
    pass: { color: "bg-emerald-100 text-emerald-800 border-emerald-200", label: "PASS" },
    fail: { color: "bg-red-100 text-red-800 border-red-200",             label: "FAIL" },
    warn: { color: "bg-amber-100 text-amber-800 border-amber-200",       label: "WARN" },
    skip: { color: "bg-gray-100 text-gray-600 border-gray-200",          label: "SKIP" },
  }[status];
  return <Badge className={`text-[10px] font-bold border ${cfg.color}`}>{cfg.label}</Badge>;
}

export default function MigrationSafety() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: status, isLoading } = useQuery<any>({
    queryKey: ["migration-status"],
    queryFn: async () => {
      const r = await fetch("/api/migration-safety/status", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    refetchInterval: 60_000,
  });

  const { data: validation, refetch: revalidate, isFetching: validating } = useQuery<any>({
    queryKey: ["migration-validate"],
    queryFn: async () => {
      const r = await fetch("/api/migration-safety/validate", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const checkpointMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/migration-safety/checkpoint", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Schema checkpoint recorded" });
      qc.invalidateQueries({ queryKey: ["migration-status"] });
    },
    onError: () => toast({ title: "Checkpoint failed", variant: "destructive" }),
  });

  const checks: any[] = validation?.checks ?? [];
  const passed = checks.filter((c: any) => c.status === "pass").length;
  const failed = checks.filter((c: any) => c.status === "fail").length;
  const warned = checks.filter((c: any) => c.status === "warn").length;

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-teal-100 flex items-center justify-center">
              <Database className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Migration Safety</h1>
              <p className="text-sm text-gray-500">Schema evolution, normalization & rollback strategy</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={validating}
              onClick={() => revalidate()}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${validating ? "animate-spin" : ""}`} />
              Re-validate
            </Button>
            <Button
              size="sm"
              className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
              disabled={checkpointMutation.isPending}
              onClick={() => checkpointMutation.mutate()}
            >
              <Bookmark className="h-3.5 w-3.5" />
              Create Checkpoint
            </Button>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs text-gray-500 mb-1">Schema Score</p>
            <p className="text-3xl font-black text-gray-900">{isLoading ? "—" : `${status?.schema_score ?? 0}%`}</p>
            <div className="h-1.5 bg-gray-100 rounded-full mt-2">
              <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: `${status?.schema_score ?? 0}%` }} />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Database className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Tables</p>
              <p className="text-xl font-black text-gray-900">{status?.total_tables ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Checks Passed</p>
              <p className="text-xl font-black text-gray-900">{passed} / {checks.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${failed > 0 ? "bg-red-100" : "bg-gray-100"}`}>
              <XCircle className={`h-4 w-4 ${failed > 0 ? "text-red-600" : "text-gray-400"}`} />
            </div>
            <div>
              <p className="text-xs text-gray-500">Failed</p>
              <p className="text-xl font-black text-gray-900">{failed}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4 text-teal-500" />Validation Checks
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {checks.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-sm">Run validation to see checks</div>
              ) : (
                <div className="divide-y">
                  {checks.map((c: any, i: number) => (
                    <div key={i} className="px-4 py-3 flex items-start gap-3 hover:bg-gray-50">
                      <CheckBadge status={c.status} />
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-gray-800">{c.name}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">{c.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Lock className="h-4 w-4 text-red-500" />Financial Immutable Tables
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-xs">Table</TableHead>
                    <TableHead className="text-xs">Exists</TableHead>
                    <TableHead className="text-xs">Rule</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(status?.financial_immutable_tables ?? []).map((t: any) => (
                    <TableRow key={t.table}>
                      <TableCell className="text-xs font-mono font-semibold text-gray-700">{t.table}</TableCell>
                      <TableCell>
                        {t.exists
                          ? <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 border text-[10px]">present</Badge>
                          : <Badge className="bg-red-100 text-red-800 border-red-200 border text-[10px]">missing</Badge>}
                      </TableCell>
                      <TableCell className="text-[10px] text-gray-500 max-w-[240px] truncate">{t.rule}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Migration Rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              {(status?.rules ?? []).map((r: string, i: number) => (
                <div key={i} className="flex items-start gap-2 py-1.5 border-b border-gray-50 last:border-0">
                  <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-700">{r}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Index Coverage</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {(status?.index_checks ?? []).map((idx: any) => (
                  <div key={`${idx.table}.${idx.column}`} className="px-4 py-2.5 flex items-center justify-between hover:bg-gray-50">
                    <div>
                      <p className="text-xs font-mono text-gray-700">{idx.table}</p>
                      <p className="text-[10px] text-gray-400">.{idx.column}</p>
                    </div>
                    <Badge className={`text-[10px] border ${idx.status === "ok" ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-red-100 text-red-800 border-red-200"}`}>
                      {idx.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Critical Tables</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-xs text-gray-500 mb-2">{status?.critical_tables?.present ?? 0} / {status?.critical_tables?.required ?? 0} present</p>
              {(status?.critical_tables?.missing ?? []).length > 0 ? (
                <div className="space-y-1">
                  {status.critical_tables.missing.map((t: string) => (
                    <Badge key={t} className="mr-1 bg-red-100 text-red-800 border-red-200 border text-[10px]">{t}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-emerald-600 font-semibold">All critical tables present</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
