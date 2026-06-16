import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { RefreshCw, Play, RotateCcw, CheckCircle, Clock } from "lucide-react";

interface Overview {
  active: number;
  expired: number;
  pending_renewal: number;
  trial: number;
  auto_renew_enabled: number;
  expiring_soon: number;
}

interface ExpiryResult {
  run_at: string;
  expired_count: number;
  renewal_pending_count: number;
  error_count: number;
  expired_ids: number[];
  renewal_pending_ids: number[];
  errors: string[];
}

function Stat({ label, value, color = "text-foreground" }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-bold tabular-nums mt-0.5", color)}>{value}</p>
    </div>
  );
}

export default function SubscriptionLifecyclePage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [lastResult, setLastResult] = useState<ExpiryResult | null>(null);
  const [restoreId, setRestoreId] = useState("");
  const [restoreDate, setRestoreDate] = useState("");

  const { data, isLoading, refetch, isFetching } = useQuery<{ overview: Overview }>({
    queryKey: ["lifecycle-overview"],
    queryFn: () => apiFetch("/api/subscriptions/lifecycle/overview").then((r) => r.json()),
    refetchInterval: 60_000,
  });

  const expiryMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/subscriptions/lifecycle/run-expiry-check", { method: "POST" }).then((r) => r.json()),
    onSuccess: (d) => {
      if (d.error) { toast({ title: "Check failed", description: d.error, variant: "destructive" }); return; }
      setLastResult(d);
      toast({ title: "Expiry check complete", description: `${d.expired_count} expired · ${d.renewal_pending_count} pending renewal` });
      qc.invalidateQueries({ queryKey: ["lifecycle-overview"] });
    },
    onError: () => toast({ title: "Expiry check failed", variant: "destructive" }),
  });

  const restoreMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/subscriptions/lifecycle/restore/${restoreId}`, {
        method: "POST",
        body: JSON.stringify(restoreDate ? { new_end_date: restoreDate } : {}),
      }).then((r) => r.json()),
    onSuccess: (d) => {
      if (d.error) { toast({ title: "Restore failed", description: d.error, variant: "destructive" }); return; }
      toast({ title: "Subscription restored", description: `New end date: ${new Date(d.new_end_date).toLocaleDateString()}` });
      setRestoreId("");
      setRestoreDate("");
      qc.invalidateQueries({ queryKey: ["lifecycle-overview"] });
    },
    onError: () => toast({ title: "Restore failed", variant: "destructive" }),
  });

  const o = data?.overview;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Subscription Lifecycle
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Auto-renew management · expiry check · manual restore</p>
        </div>
        <button onClick={() => refetch()} className="p-2 border border-border rounded-lg hover:bg-muted transition-colors">
          <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", isFetching && "animate-spin")} />
        </button>
      </div>

      {isLoading ? (
        <div className="animate-pulse grid grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-20 bg-muted rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Stat label="Active" value={o?.active ?? 0} color="text-emerald-600" />
          <Stat label="Expiring Soon (7d)" value={o?.expiring_soon ?? 0} color={(o?.expiring_soon ?? 0) > 0 ? "text-amber-600" : "text-foreground"} />
          <Stat label="Pending Renewal" value={o?.pending_renewal ?? 0} color={(o?.pending_renewal ?? 0) > 0 ? "text-blue-600" : "text-foreground"} />
          <Stat label="Expired" value={o?.expired ?? 0} color="text-red-600" />
          <Stat label="Trial" value={o?.trial ?? 0} />
          <Stat label="Auto-Renew Enabled" value={o?.auto_renew_enabled ?? 0} color="text-teal-600" />
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Play className="h-4 w-4 text-primary" />
              Run Expiry Check
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Marks expired subscriptions, creates renewal pending transactions for auto-renew subscribers, and retires grace-period failures.
            </p>
          </div>
          <button
            onClick={() => expiryMutation.mutate()}
            disabled={expiryMutation.isPending}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-lg py-2.5 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {expiryMutation.isPending ? (
              <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Running…</>
            ) : (
              <><Play className="h-3.5 w-3.5" /> Run Now</>
            )}
          </button>
          {lastResult && (
            <div className="bg-muted/40 rounded-xl p-3 text-xs space-y-1">
              <p className="font-medium text-foreground">Last run: {new Date(lastResult.run_at).toLocaleString()}</p>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <div className="text-center">
                  <p className="text-lg font-bold text-red-600">{lastResult.expired_count}</p>
                  <p className="text-[10px] text-muted-foreground">Expired</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-blue-600">{lastResult.renewal_pending_count}</p>
                  <p className="text-[10px] text-muted-foreground">Renewal Pending</p>
                </div>
                <div className="text-center">
                  <p className={cn("text-lg font-bold", lastResult.error_count > 0 ? "text-amber-600" : "text-emerald-600")}>{lastResult.error_count}</p>
                  <p className="text-[10px] text-muted-foreground">Errors</p>
                </div>
              </div>
              {lastResult.errors.length > 0 && (
                <div className="mt-2 space-y-0.5">
                  {lastResult.errors.map((e, i) => (
                    <p key={i} className="text-[11px] text-red-600 font-mono">{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-primary" />
              Manual Restore
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Reactivate a specific subscription by ID. Optionally set a new end date (defaults to +30 days).
            </p>
          </div>
          <div className="space-y-2">
            <input
              type="number"
              value={restoreId}
              onInput={(e) => setRestoreId((e.target as HTMLInputElement).value)}
              placeholder="Subscription ID"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <input
              type="date"
              value={restoreDate}
              onInput={(e) => setRestoreDate((e.target as HTMLInputElement).value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button
            onClick={() => restoreMutation.mutate()}
            disabled={restoreMutation.isPending || !restoreId}
            className="w-full bg-card border border-border hover:bg-muted text-foreground text-sm font-medium rounded-lg py-2.5 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {restoreMutation.isPending ? (
              <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Restoring…</>
            ) : (
              <><CheckCircle className="h-3.5 w-3.5 text-primary" /> Restore Subscription</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
