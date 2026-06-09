import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { fetchJSON, putJSON } from "@/lib/api";
import { AlertTriangle, AlertCircle, Info, CheckCheck, Circle, CreditCard, Activity, Zap } from "lucide-react";

const SEV_CONFIG: Record<string, { label: string; bg: string; border: string; text: string; icon: any }> = {
  critical: { label: "Critical", bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700", icon: AlertCircle },
  warning:  { label: "Warning",  bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", icon: AlertTriangle },
  info:     { label: "Info",     bg: "bg-blue-50",  border: "border-blue-200",  text: "text-blue-700",  icon: Info },
};

const TYPE_ICONS: Record<string, any> = {
  payment_failure: CreditCard,
  outage: Activity,
  ai_cost_spike: Zap,
  default: AlertTriangle,
};

function AlertCard({ alert, onRead }: { alert: any; onRead: () => void }) {
  const sev = SEV_CONFIG[alert.severity] ?? SEV_CONFIG.info;
  const SevIcon = sev.icon;
  const TypeIcon = TYPE_ICONS[alert.type] ?? TYPE_ICONS.default;

  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
      className={`rounded-xl border p-4 ${sev.bg} ${sev.border} ${alert.is_read ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg bg-white/70 flex items-center justify-center flex-shrink-0`}>
          <TypeIcon className={`w-4 h-4 ${sev.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-semibold uppercase tracking-wide ${sev.text}`}>{sev.label}</span>
            <span className="text-xs text-gray-500 capitalize">· {alert.type?.replace(/_/g, " ")}</span>
            {!alert.is_read && (
              <span className="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0" />
            )}
          </div>
          <p className="text-sm text-gray-800 font-medium">{alert.message}</p>
          <p className="text-xs text-gray-400 mt-1">
            {new Date(alert.created_at).toLocaleString()}
          </p>
        </div>
        {!alert.is_read && (
          <button onClick={onRead}
            className="flex-shrink-0 flex items-center gap-1 text-xs text-gray-500 hover:text-teal-600 transition-colors px-2 py-1 rounded-lg hover:bg-white/60">
            <CheckCheck className="w-3.5 h-3.5" />
            Mark read
          </button>
        )}
      </div>
    </motion.div>
  );
}

export default function FounderAlertsPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["founder-alerts"],
    queryFn: () => fetchJSON("/api/founder/alerts"),
    refetchInterval: 30000,
  });

  const readMut = useMutation({
    mutationFn: (id: number) => putJSON(`/api/founder/alerts/${id}/read`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["founder-alerts"] }),
  });

  const readAllMut = useMutation({
    mutationFn: () => putJSON("/api/founder/alerts/read-all", {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["founder-alerts"] }),
  });

  const alerts = data?.alerts ?? [];
  const unread = alerts.filter((a: any) => !a.is_read);
  const critical = alerts.filter((a: any) => a.severity === "critical" && !a.is_read);
  const warnings = alerts.filter((a: any) => a.severity === "warning" && !a.is_read);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Founder Alerts</h1>
          <p className="text-sm text-gray-500 mt-0.5">Real-time platform alerts — payments, outages, cost spikes</p>
        </div>
        {unread.length > 0 && (
          <button onClick={() => readAllMut.mutate()} disabled={readAllMut.isPending}
            className="flex items-center gap-2 border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm hover:bg-gray-50 transition-colors">
            <CheckCheck className="w-4 h-4" />
            Mark all read
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-rose-50 rounded-xl border border-rose-100 p-4">
          <p className="text-2xl font-bold text-rose-700">{critical.length}</p>
          <p className="text-xs text-rose-600 mt-0.5">Critical unread</p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-100 p-4">
          <p className="text-2xl font-bold text-amber-700">{warnings.length}</p>
          <p className="text-xs text-amber-600 mt-0.5">Warnings unread</p>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
          <p className="text-2xl font-bold text-blue-700">{alerts.length}</p>
          <p className="text-xs text-blue-600 mt-0.5">Total alerts (24h)</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <Circle className="w-10 h-10 text-green-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">All clear — no alerts</p>
          <p className="text-sm text-gray-400 mt-1">
            The background worker checks for payment failures, outages, and AI cost spikes every 5 minutes.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {/* Unread first */}
            {unread.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Unread ({unread.length})</h3>
                <div className="space-y-3">
                  {unread.map((a: any) => (
                    <AlertCard key={a.id} alert={a} onRead={() => readMut.mutate(a.id)} />
                  ))}
                </div>
              </div>
            )}
            {/* Read */}
            {alerts.filter((a: any) => a.is_read).length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Read</h3>
                <div className="space-y-3">
                  {alerts.filter((a: any) => a.is_read).map((a: any) => (
                    <AlertCard key={a.id} alert={a} onRead={() => {}} />
                  ))}
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
