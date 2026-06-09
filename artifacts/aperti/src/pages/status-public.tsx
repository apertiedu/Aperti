import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useInView } from "framer-motion";
import { Link } from "wouter";
import { CheckCircle2, AlertTriangle, XCircle, Wrench, Activity, Clock } from "lucide-react";

const TEAL = "#0D9488";

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string; dotColor: string; icon: any }> = {
  operational: { label: "All Systems Operational", color: "#059669", bg: "#ECFDF5", border: "#BBF7D0", dotColor: "#10B981", icon: CheckCircle2 },
  degraded:    { label: "Partial Degradation",     color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", dotColor: "#F59E0B", icon: AlertTriangle },
  maintenance: { label: "Scheduled Maintenance",   color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE", dotColor: "#3B82F6", icon: Wrench },
  incident:    { label: "Active Incident",         color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", dotColor: "#EF4444", icon: XCircle },
  resolved:    { label: "Incident Resolved",       color: "#6B7280", bg: "#F9FAFB", border: "#E5E7EB", dotColor: "#9CA3AF", icon: CheckCircle2 },
};

const SERVICES = [
  "Web Application", "API", "Authentication", "Database", "Live Video", "AI Services",
  "File Storage", "Email Delivery", "Payment Processing",
];

function Reveal({ children }: { children: React.ReactNode }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 12 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5 }}>
      {children}
    </motion.div>
  );
}

export default function StatusPublicPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["platform-status"],
    queryFn: () => fetch("/api/platform-status").then((r) => r.json()),
    refetchInterval: 30000,
  });

  const current: any = data?.current || { status: "operational" };
  const history: any[] = data?.history || [];
  const meta = STATUS_META[current.status] || STATUS_META.operational;
  const StatusIcon = meta.icon;

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "Inter, sans-serif" }}>
      <div className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-bold text-lg text-gray-900">Aperti<span style={{ color: TEAL }}>.</span></Link>
          <div className="flex items-center gap-4">
            <Link href="/features" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Features</Link>
            <Link href="/roadmap" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Roadmap</Link>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 md:px-6 py-12 space-y-8">
        {/* Current Status */}
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : (
          <Reveal>
            <motion.div className="rounded-2xl p-8 border" style={{ backgroundColor: meta.bg, borderColor: meta.border }}>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: meta.dotColor + "20" }}>
                    <StatusIcon className="w-6 h-6" style={{ color: meta.color }} />
                  </div>
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white animate-pulse" style={{ backgroundColor: meta.dotColor }} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold" style={{ color: meta.color }}>{meta.label}</h2>
                  <p className="text-sm mt-0.5" style={{ color: meta.color + "99" }}>
                    {current.message || "All Aperti services are running normally."}
                  </p>
                  {current.created_at && (
                    <p className="text-xs mt-1 flex items-center gap-1" style={{ color: meta.color + "80" }}>
                      <Clock className="w-3 h-3" /> Updated {new Date(current.created_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          </Reveal>
        )}

        {/* Services Grid */}
        <Reveal>
          <div>
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">System Components</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {SERVICES.map((service) => (
                <div key={service} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-800">{service}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: current.status === "operational" ? "#10B981" : current.status === "incident" ? "#EF4444" : "#F59E0B" }} />
                    <span className="text-xs font-medium" style={{ color: current.status === "operational" ? "#059669" : current.status === "incident" ? "#DC2626" : "#D97706" }}>
                      {current.status === "operational" ? "Operational" : current.status === "incident" ? "Incident" : "Degraded"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* History */}
        {history.length > 1 && (
          <Reveal>
            <div>
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">
                <Activity className="w-4 h-4 inline mr-1" />Recent Incidents
              </h3>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="divide-y divide-gray-50">
                  {history.slice(1, 8).map((entry: any) => {
                    const m = STATUS_META[entry.status] || STATUS_META.operational;
                    const EIcon = m.icon;
                    return (
                      <div key={entry.id} className="flex items-start gap-4 px-5 py-4">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: m.bg }}>
                          <EIcon className="w-3.5 h-3.5" style={{ color: m.color }} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold" style={{ color: m.color }}>{m.label}</p>
                          {entry.message && <p className="text-xs text-gray-500 mt-0.5">{entry.message}</p>}
                        </div>
                        <p className="text-xs text-gray-400 flex-shrink-0">{new Date(entry.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </Reveal>
        )}

        {history.length <= 1 && !isLoading && (
          <Reveal>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3" style={{ color: "#10B981" }} />
              <p className="text-gray-500 font-medium">No incidents in the past 30 days</p>
              <p className="text-gray-400 text-sm mt-1">Aperti has been fully operational.</p>
            </div>
          </Reveal>
        )}
      </div>
    </div>
  );
}
