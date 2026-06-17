import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Layers, Cpu, Database, Shield, Brain, CreditCard, BookOpen, Activity, Zap, ArrowRight } from "lucide-react";

const LAYER_ICONS: Record<string, any> = {
  frontend:          Layers,
  "api-gateway":     Shield,
  "ai-service":      Brain,
  "billing-service": CreditCard,
  "ledger-service":  Database,
  "fraud-service":   Shield,
  "education-service": BookOpen,
  "data-layer":      Database,
};

const LAYER_COLORS: Record<string, string> = {
  frontend:            "bg-blue-100 text-blue-700",
  "api-gateway":       "bg-violet-100 text-violet-700",
  "ai-service":        "bg-purple-100 text-purple-700",
  "billing-service":   "bg-emerald-100 text-emerald-700",
  "ledger-service":    "bg-teal-100 text-teal-700",
  "fraud-service":     "bg-red-100 text-red-700",
  "education-service": "bg-amber-100 text-amber-700",
  "data-layer":        "bg-gray-100 text-gray-700",
};

function StatusDot({ status }: { status: string }) {
  const color = status === "healthy" ? "bg-emerald-500" : status === "degraded" ? "bg-amber-400" : "bg-red-500";
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${color} animate-pulse`} />
      <span className={`text-[10px] font-semibold ${status === "healthy" ? "text-emerald-700" : status === "degraded" ? "text-amber-700" : "text-red-700"}`}>
        {status}
      </span>
    </span>
  );
}

export default function ArchitecturePage() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["architecture-status"],
    queryFn: async () => {
      const r = await fetch("/api/architecture/status", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const { data: events } = useQuery<any>({
    queryKey: ["architecture-events"],
    queryFn: async () => {
      const r = await fetch("/api/architecture/events?limit=20", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    refetchInterval: 15_000,
  });

  const layers: any[] = data?.layers ?? [];
  const stats = data?.stats ?? {};
  const runtime = data?.runtime ?? {};

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-violet-100 flex items-center justify-center">
            <Layers className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">System Architecture</h1>
            <p className="text-sm text-gray-500">Production-grade multi-layer architecture overview</p>
          </div>
        </div>
      </motion.div>

      {/* Runtime stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Uptime",        value: runtime.uptime_seconds ? `${Math.floor(runtime.uptime_seconds / 60)}m` : "—", icon: Activity, color: "bg-emerald-100 text-emerald-600" },
          { label: "Heap Memory",   value: runtime.memory_mb ? `${runtime.memory_mb}MB` : "—",  icon: Cpu,      color: "bg-blue-100 text-blue-600" },
          { label: "Domain Events", value: stats.domain_events ?? "—",                           icon: Zap,      color: "bg-purple-100 text-purple-600" },
          { label: "Errors / 1h",   value: stats.errors_last_hour ?? "—",                        icon: Shield,   color: stats.errors_last_hour > 10 ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-0 shadow-sm">
            <CardContent className="p-5 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${color}`}><Icon className="h-4 w-4" /></div>
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-lg font-black text-gray-900">{String(value)}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Architecture layers */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Service Layers</h2>
          {isLoading ? (
            <div className="space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-20 bg-white animate-pulse rounded-xl" />)}</div>
          ) : (
            layers.map((layer: any, i: number) => {
              const Icon = LAYER_ICONS[layer.id] ?? Layers;
              const colorClass = LAYER_COLORS[layer.id] ?? "bg-gray-100 text-gray-700";
              return (
                <motion.div key={layer.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                  <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-sm font-semibold text-gray-900">{layer.name}</p>
                            <StatusDot status={layer.status} />
                          </div>
                          <p className="text-xs text-gray-500 mb-2">{layer.description}</p>
                          <div className="flex flex-wrap gap-1">
                            {layer.tech?.map((t: string) => (
                              <Badge key={t} className="text-[9px] bg-gray-50 text-gray-600 border border-gray-100 font-normal">{t}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Responsibilities</p>
                          <ul className="space-y-0.5">
                            {layer.responsibilities?.slice(0, 3).map((r: string) => (
                              <li key={r} className="text-[10px] text-emerald-700 flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0" />{r}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Prohibited</p>
                          <ul className="space-y-0.5">
                            {layer.prohibited?.slice(0, 2).map((p: string) => (
                              <li key={p} className="text-[10px] text-red-600 flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-red-400 flex-shrink-0" />{p}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />Design Principles
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              {(data?.principles ?? []).map((p: string, i: number) => (
                <div key={i} className="flex items-start gap-2 py-1.5 border-b border-gray-50 last:border-0">
                  <ArrowRight className="h-3 w-3 text-teal-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-700">{p}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-purple-500" />Recent Domain Events
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!events?.events?.length ? (
                <p className="text-xs text-gray-400 text-center py-4">No events yet</p>
              ) : (
                <div className="divide-y max-h-64 overflow-y-auto">
                  {events.events.map((e: any) => (
                    <div key={e.id} className="px-4 py-2 hover:bg-gray-50">
                      <p className="text-[11px] font-mono font-semibold text-purple-700">{e.event_type}</p>
                      <p className="text-[10px] text-gray-400">{new Date(e.created_at).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Platform Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              {[
                { label: "Accounts",      value: stats.total_accounts },
                { label: "Transactions",  value: stats.total_transactions },
                { label: "Ledger Entries",value: stats.ledger_entries },
                { label: "Fraud Alerts",  value: stats.fraud_alerts },
                { label: "Node.js",       value: runtime.node },
                { label: "AI Available",  value: runtime.ai_configured ? "Yes" : "Fallback mode" },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center py-1 border-b border-gray-50 last:border-0">
                  <span className="text-xs text-gray-500">{label}</span>
                  <span className="text-xs font-bold text-gray-900">{String(value ?? "—")}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
