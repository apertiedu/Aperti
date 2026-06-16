import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Activity, Cpu, HardDrive, Database, Clock, RefreshCw, Wifi, AlertTriangle } from "lucide-react";


function MetricCard({ icon: Icon, label, value, unit, color, warn }: {
  icon: any; label: string; value: number | string; unit?: string; color: string; warn?: boolean;
}) {
  const pct = typeof value === "number" ? value : null;
  return (
    <Card className="card-hover">
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${warn ? "bg-amber-50" : "bg-primary/8"}`}>
            <Icon className={`h-5 w-5 ${warn ? "text-amber-500" : color}`} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold tabular-nums">{value}{unit}</p>
          </div>
        </div>
        {pct !== null && (
          <Progress
            value={Math.min(100, pct)}
            className="h-1.5"
          />
        )}
      </CardContent>
    </Card>
  );
}

export default function AutoScale() {
  const { data, isLoading, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["system-metrics"],
    queryFn: () =>
      fetch("/api/founder/system-metrics", { credentials: "include" })
        .then(r => r.json()),
    refetchInterval: 8000,
    staleTime: 4000,
  });

  const cpu       = data?.cpu?.pct ?? 0;
  const memPct    = data?.memory?.pct ?? 0;
  const usedMB    = data?.memory?.usedMB ?? 0;
  const totalMB   = data?.memory?.totalMB ?? 0;
  const diskPct   = data?.disk?.pct ?? 0;
  const uptimeH   = data?.uptime?.hours ?? 0;
  const dbOk      = data?.database?.ok ?? false;
  const dbConns   = data?.database?.activeConnections ?? 0;
  const loadAvg   = data?.loadAvg?.[0] ?? 0;
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : "—";

  const cpuWarn   = cpu > 75;
  const memWarn   = memPct > 85;
  const diskWarn  = diskPct > 80;

  const recommendation =
    cpuWarn ? "High CPU detected. Consider reviewing background jobs or scaling up resources." :
    memWarn ? "Memory pressure is high. Check for memory leaks or increase available RAM." :
    diskWarn ? "Disk is getting full. Archive old data or expand storage." :
    "System is healthy. Resources are within normal operating ranges.";

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" /> Infrastructure Monitor
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Live system metrics · Updated at {lastUpdated}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            {isFetching ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="p-4 h-24 bg-muted/40 animate-pulse rounded-lg" /></Card>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MetricCard icon={Cpu}      label="CPU Usage"   value={cpu}     unit="%" color="text-blue-600"    warn={cpuWarn} />
            <MetricCard icon={HardDrive}label="Memory"      value={memPct}  unit="%" color="text-purple-600"  warn={memWarn} />
            <MetricCard icon={HardDrive}label="Disk"        value={diskPct} unit="%" color="text-orange-600"  warn={diskWarn} />
            <MetricCard icon={Activity} label="Load Avg"    value={loadAvg.toFixed(2)} color="text-primary" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <Database className={`h-8 w-8 ${dbOk ? "text-emerald-500" : "text-red-500"}`} />
                <div>
                  <p className="font-semibold text-sm">{dbOk ? "Database Connected" : "Database Unreachable"}</p>
                  <p className="text-xs text-muted-foreground">{dbConns} active connection{dbConns !== 1 ? "s" : ""}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <Clock className="h-8 w-8 text-sky-500" />
                <div>
                  <p className="font-semibold text-sm">Server Uptime</p>
                  <p className="text-xs text-muted-foreground">{uptimeH}h {Math.floor(((data?.uptime?.seconds ?? 0) % 3600) / 60)}m</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <Wifi className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-semibold text-sm">Memory Usage</p>
                  <p className="text-xs text-muted-foreground">{usedMB} MB / {totalMB} MB</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="max-w-2xl">
            <CardHeader><CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${cpuWarn || memWarn || diskWarn ? "text-amber-500" : "text-emerald-500"}`} />
              Scaling Advisor
            </CardTitle></CardHeader>
            <CardContent>
              <p className={`text-sm ${cpuWarn || memWarn || diskWarn ? "text-amber-700" : "text-emerald-700"} bg-opacity-10 rounded-lg p-3 ${cpuWarn || memWarn || diskWarn ? "bg-amber-50" : "bg-emerald-50"}`}>
                {recommendation}
              </p>
              <p className="text-xs text-muted-foreground mt-3">
                Metrics refresh every 8 seconds from live OS data. No mock values.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
