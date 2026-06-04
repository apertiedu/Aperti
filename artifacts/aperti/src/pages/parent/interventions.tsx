import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const authFetch = (url: string, opts?: RequestInit) =>
  fetch(url, { ...opts, headers: { Authorization: `Bearer ${localStorage.getItem("aperti_token") || ""}`, "Content-Type": "application/json", ...(opts?.headers || {}) } });

const riskConfig: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  high:     { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  moderate: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  low:      { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
};

export default function ParentInterventions() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: alerts = [], isLoading } = useQuery<any[]>({
    queryKey: ["parent-interventions"],
    queryFn: () => authFetch("/api/parent/intervention-alerts").then(r => r.json()),
    refetchInterval: 30000,
  });

  const resolveMutation = useMutation({
    mutationFn: (id: number) => authFetch(`/api/parent/resolve-alert/${id}`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["parent-interventions"] }); toast({ title: "Alert resolved ✅" }); },
    onError: () => toast({ title: "Failed to resolve", variant: "destructive" }),
  });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-red-50">
          <AlertTriangle className="h-5 w-5 text-red-500" />
        </div>
        <div>
          <h1 className="text-xl font-black text-gray-900">Intervention Center</h1>
          <p className="text-sm text-gray-500">Active alerts requiring your attention</p>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="space-y-3">{[0,1,2].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-16">
          <ShieldCheck className="h-16 w-16 mx-auto mb-4 text-teal-200" />
          <h3 className="text-lg font-bold text-gray-700 mb-1">All clear!</h3>
          <p className="text-gray-400 text-sm">No active alerts for your children right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert, i) => {
            const cfg = riskConfig[alert.risk_level] || riskConfig.low;
            return (
              <motion.div key={alert.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Card className={`border ${cfg.border} shadow-sm`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
                        <AlertTriangle className={`h-5 w-5 ${cfg.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-sm font-semibold text-gray-900">{alert.display_name || alert.student_name}</p>
                          <Badge className={`text-[10px] rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>{alert.risk_level} risk</Badge>
                          <Badge className="text-[10px] rounded-full bg-gray-100 text-gray-600 border-gray-200">{alert.type}</Badge>
                        </div>
                        <p className="text-sm text-gray-600">{alert.message}</p>
                        <p className="text-[10px] text-gray-400 mt-1">{new Date(alert.created_at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 gap-1.5 text-xs rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        onClick={() => resolveMutation.mutate(alert.id)}
                        disabled={resolveMutation.isPending}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
