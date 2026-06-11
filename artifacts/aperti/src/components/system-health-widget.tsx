import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, Wifi, Database, Cpu, Server } from "lucide-react";
import { fetchJSON } from "@/lib/api";

interface ServiceHealth {
  name: string;
  status: "healthy" | "degraded" | "critical" | "unknown";
  latencyMs?: number;
  detail?: string;
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    healthy: "bg-emerald-500",
    degraded: "bg-amber-400",
    critical: "bg-red-500",
    unknown: "bg-gray-300",
  };
  return (
    <span className="relative flex h-2 w-2">
      {status === "healthy" && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />}
      <span className={`relative inline-flex rounded-full h-2 w-2 ${colors[status] || colors.unknown}`} />
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { color: string; label: string }> = {
    healthy: { color: "bg-emerald-100 text-emerald-700", label: "Healthy" },
    degraded: { color: "bg-amber-100 text-amber-700", label: "Degraded" },
    critical: { color: "bg-red-100 text-red-700", label: "Critical" },
    unknown: { color: "bg-gray-100 text-gray-500", label: "Unknown" },
  };
  const { color, label } = cfg[status] || cfg.unknown;
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${color}`}>{label}</span>;
}

const SERVICE_ICONS: Record<string, any> = {
  API: Server,
  Database: Database,
  Network: Wifi,
  CPU: Cpu,
};

export default function SystemHealthWidget() {
  const { data: health, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["system-health-widget"],
    queryFn: () => fetchJSON("/api/admin/health"),
    refetchInterval: 60000,
  });

  const services: ServiceHealth[] = health?.services ?? [];
  const overall: string = health?.status ?? "unknown";

  const critical = services.filter(s => s.status === "critical").length;
  const degraded = services.filter(s => s.status === "degraded").length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <StatusDot status={overall} />
          <p className="text-xs font-bold text-gray-900">System Health</p>
          <StatusBadge status={overall} />
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-8 bg-gray-100 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : services.length === 0 ? (
        <div className="text-center py-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-1" />
          <p className="text-xs text-gray-500">All systems operational</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {services.map((svc) => {
            const Icon = SERVICE_ICONS[svc.name] ?? Server;
            return (
              <div key={svc.name} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs font-medium text-gray-700">{svc.name}</span>
                  {svc.detail && <span className="text-[10px] text-gray-400 hidden sm:inline">{svc.detail}</span>}
                </div>
                <div className="flex items-center gap-2">
                  {svc.latencyMs !== undefined && (
                    <span className="text-[10px] text-gray-400">{svc.latencyMs}ms</span>
                  )}
                  <StatusDot status={svc.status} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(critical > 0 || degraded > 0) && (
        <div className={`mt-3 px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 ${
          critical > 0 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
        }`}>
          {critical > 0 ? <XCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          {critical > 0 ? `${critical} critical issue${critical > 1 ? "s" : ""} need attention` : `${degraded} service${degraded > 1 ? "s" : ""} degraded`}
        </div>
      )}

      <p className="text-[10px] text-gray-400 mt-2 text-right">
        Updated {health?.checkedAt ? new Date(health.checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "just now"}
      </p>
    </motion.div>
  );
}
