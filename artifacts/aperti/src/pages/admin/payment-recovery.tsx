import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, LifeBuoy, CheckCircle2, XCircle, Clock, AlertTriangle, Play } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string; icon: any }> = {
  retry_scheduled:   { color: "text-blue-700",    bg: "bg-blue-100",    label: "Scheduled",    icon: Clock },
  recovered:         { color: "text-emerald-700",  bg: "bg-emerald-100", label: "Recovered",    icon: CheckCircle2 },
  permanently_failed:{ color: "text-red-700",      bg: "bg-red-100",     label: "Failed",       icon: XCircle },
  cancelled:         { color: "text-gray-600",     bg: "bg-gray-100",    label: "Cancelled",    icon: XCircle },
  pending:           { color: "text-amber-700",    bg: "bg-amber-100",   label: "Pending",      icon: AlertTriangle },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.color}`}>
      <Icon className="h-3 w-3" />{cfg.label}
    </span>
  );
}

export default function PaymentRecovery() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [resolveId, setResolveId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["payment-recovery-all", filterStatus],
    queryFn: async () => {
      const qs = filterStatus !== "all" ? `?status=${filterStatus}` : "";
      const r = await fetch(`/api/payment-recovery/admin/all${qs}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/payment-recovery/run-scheduled", { method: "POST", credentials: "include" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      return d;
    },
    onSuccess: (d) => {
      toast({ title: `Run complete: ${d.processed} processed, ${d.expired_permanently} permanently failed` });
      qc.invalidateQueries({ queryKey: ["payment-recovery-all"] });
    },
    onError: (e) => toast({ title: (e as Error).message, variant: "destructive" }),
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, resolution }: { id: number; resolution: string }) => {
      const r = await fetch(`/api/payment-recovery/admin/resolve/${id}`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      return d;
    },
    onSuccess: () => {
      toast({ title: "Recovery resolved" });
      setResolveId(null);
      qc.invalidateQueries({ queryKey: ["payment-recovery-all"] });
    },
    onError: (e) => toast({ title: (e as Error).message, variant: "destructive" }),
  });

  const recoveries: any[] = data?.recoveries ?? [];
  const counts = data?.counts ?? {};

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-orange-100 flex items-center justify-center">
            <LifeBuoy className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payment Recovery</h1>
            <p className="text-sm text-gray-400">Max 3 retries · 48h window · auto-rescue engine</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />Refresh
          </Button>
          <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white gap-2"
            disabled={runMutation.isPending}
            onClick={() => runMutation.mutate()}>
            <Play className="h-3.5 w-3.5" />Run Scheduled
          </Button>
        </div>
      </motion.div>

      {/* Counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { key: "scheduled",          label: "Scheduled",          color: "bg-blue-50 text-blue-700" },
          { key: "recovered",          label: "Recovered",          color: "bg-emerald-50 text-emerald-700" },
          { key: "permanently_failed", label: "Perm. Failed",       color: "bg-red-50 text-red-700" },
          { key: "cancelled",          label: "Cancelled",          color: "bg-gray-50 text-gray-600" },
        ].map(({ key, label, color }) => (
          <div key={key} className={`p-3 rounded-xl text-center border border-transparent ${color}`}>
            <p className="text-2xl font-black">{counts[key] ?? 0}</p>
            <p className="text-[11px] font-semibold">{label}</p>
          </div>
        ))}
      </div>

      {/* Recovery Rules */}
      <Card className="border-0 shadow-sm mb-6">
        <CardContent className="p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Recovery Rules</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-700">
            {[
              "Max 3 retry attempts per subscription",
              "48-hour recovery window (configurable)",
              "8-hour gap between attempts",
              "Push notification sent on each retry",
            ].map((rule, i) => (
              <div key={i} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
                <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                {rule}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filter + Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {["all", "retry_scheduled", "recovered", "permanently_failed", "cancelled"].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                  filterStatus === s ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-500 border-gray-200 hover:border-teal-300"
                }`}
              >
                {s === "all" ? "All" : s.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-gray-100 animate-pulse rounded-lg" />)}</div>
          ) : recoveries.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-300" />
              <p className="text-sm">No recovery records</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-xs">User</TableHead>
                    <TableHead className="text-xs">Plan</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-center">Attempts</TableHead>
                    <TableHead className="text-xs">Next Retry</TableHead>
                    <TableHead className="text-xs">Resolution</TableHead>
                    <TableHead className="text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recoveries.map((r: any) => (
                    <TableRow key={r.id} className="hover:bg-gray-50">
                      <TableCell>
                        <p className="text-xs font-semibold">{r.display_name}</p>
                        <p className="text-[10px] text-gray-400">@{r.username}</p>
                      </TableCell>
                      <TableCell className="text-xs">{r.plan_name ?? "—"}</TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                      <TableCell className="text-xs text-center font-bold">
                        <span className={r.attempts >= r.max_attempts ? "text-red-600" : "text-gray-700"}>
                          {r.attempts}/{r.max_attempts}
                        </span>
                      </TableCell>
                      <TableCell className="text-[10px] text-gray-400">
                        {r.next_retry_at ? new Date(r.next_retry_at).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">{r.resolution ?? "—"}</TableCell>
                      <TableCell>
                        {r.status === "retry_scheduled" && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" className="text-[10px] h-6 px-2 text-emerald-700 border-emerald-200"
                              onClick={() => resolveMutation.mutate({ id: r.id, resolution: "recovered" })}>
                              Mark Recovered
                            </Button>
                            <Button size="sm" variant="outline" className="text-[10px] h-6 px-2 text-red-700 border-red-200"
                              onClick={() => resolveMutation.mutate({ id: r.id, resolution: "permanently_failed" })}>
                              Fail
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
