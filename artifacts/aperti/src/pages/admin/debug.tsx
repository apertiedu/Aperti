import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/api";
import {
  AlertTriangle, Bot, Shield, RefreshCw, Clock, CheckCircle2,
  XCircle, Activity, Terminal, Database, Wifi, WifiOff,
  Cpu, MemoryStick, Zap, Flag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const TEAL = "#0D9488";

interface LiveSnapshot {
  ts: string;
  errors: { count1h: number; hotRoutes: string };
  ai: { calls1h: number; cost1h: string };
  sessions: number;
  flags: Array<{ key: string; enabled: boolean }>;
  uptime: number;
  memory: { heapUsedMb: number; rssMb: number };
}

interface DebugStats {
  failedApiCalls: Array<{
    id: number; route: string; method: string;
    status_code: number; error_message: string;
    created_at: string; user_role?: string;
  }>;
  aiLogs: Array<{
    id: number; type: string; success: boolean;
    latency_ms: number; failure_reason?: string; created_at: string;
  }>;
  permissionErrors: Array<{ route: string; count: number; last_seen: string }>;
  systemHealth: { dbConnected: boolean; aiConfigured: boolean; sessionCount: number };
}

function StatCard({ icon: Icon, label, value, sub, color = TEAL, pulse = false }: {
  icon: React.ComponentType<any>; label: string;
  value: string | number; sub?: string; color?: string; pulse?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${pulse ? "animate-pulse" : ""}`}
        style={{ background: `${color}18` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 font-medium truncate">{label}</p>
        <p className="text-lg font-bold text-slate-900 leading-tight">{value}</p>
        {sub && <p className="text-xs text-slate-400 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function LiveDot({ connected }: { connected: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-slate-300"}`} />
      <span className={`text-xs font-medium ${connected ? "text-emerald-600" : "text-slate-400"}`}>
        {connected ? "Live" : "Disconnected"}
      </span>
    </span>
  );
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${seconds % 60}s`;
}

export default function AdminDebugPage() {
  const [tab, setTab] = useState<"api" | "ai" | "permission">("api");
  const [live, setLive] = useState<LiveSnapshot | null>(null);
  const [sseConnected, setSseConnected] = useState(false);
  const [eventLog, setEventLog] = useState<string[]>([]);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    function connect() {
      if (esRef.current) esRef.current.close();
      const es = new EventSource("/api/admin/debug/stream", { withCredentials: true });
      esRef.current = es;

      es.onopen = () => setSseConnected(true);

      es.onmessage = (e: MessageEvent) => {
        try {
          const snapshot = JSON.parse(e.data) as LiveSnapshot;
          if (snapshot.ts) {
            setLive(snapshot);
            setEventLog(prev => [
              `[${new Date(snapshot.ts).toLocaleTimeString()}] errors:${snapshot.errors.count1h} ai:${snapshot.ai.calls1h} sessions:${snapshot.sessions}`,
              ...prev.slice(0, 49),
            ]);
          }
        } catch {}
      };

      es.onerror = () => {
        setSseConnected(false);
        es.close();
        setTimeout(connect, 5_000);
      };
    }

    connect();
    return () => { esRef.current?.close(); };
  }, []);

  const { data, isLoading, refetch, dataUpdatedAt } = useQuery<DebugStats>({
    queryKey: ["admin-debug"],
    queryFn: () => apiFetch("/api/admin/debug").then(r => r.json()),
    refetchInterval: 30_000,
  });

  const aiStats    = data?.aiLogs ?? [];
  const failedApi  = data?.failedApiCalls ?? [];
  const permErrors = data?.permissionErrors ?? [];
  const aiFailRate = aiStats.length > 0
    ? Math.round((aiStats.filter(l => !l.success).length / aiStats.length) * 100) : 0;
  const lastUpdate = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : "—";

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Terminal className="w-5 h-5" style={{ color: TEAL }} />
            Live Debug Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-3">
            <LiveDot connected={sseConnected} />
            <span>Snapshot: {lastUpdate}</span>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}
          className="gap-2 text-xs" disabled={isLoading}>
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Live SSE stats */}
      <AnimatePresence>
        {live && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Real-time stream · updates every 10s
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={XCircle} label="Errors (1h)" value={live.errors.count1h}
                sub={live.errors.hotRoutes?.split(",")[0] || undefined}
                color={live.errors.count1h > 10 ? "#ef4444" : TEAL} pulse={live.errors.count1h > 10} />
              <StatCard icon={Bot} label="AI Calls (1h)" value={live.ai.calls1h}
                sub={`$${live.ai.cost1h} est.`} color={TEAL} />
              <StatCard icon={Activity} label="Active Sessions" value={live.sessions} color="#8b5cf6" />
              <StatCard icon={Cpu} label="Heap Usage" value={`${live.memory.heapUsedMb} MB`}
                sub={`RSS: ${live.memory.rssMb} MB`}
                color={live.memory.heapUsedMb > 400 ? "#f59e0b" : TEAL} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Uptime */}
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Server Uptime
                </h3>
                <p className="text-2xl font-bold text-slate-900">{formatUptime(live.uptime)}</p>
              </div>

              {/* Feature flags live */}
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Flag className="w-3.5 h-3.5" /> Feature Flags
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {live.flags.slice(0, 8).map(f => (
                    <span key={f.key} className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      f.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                    }`}>
                      {f.key.replace(/_/g, " ")}
                    </span>
                  ))}
                  {live.flags.length === 0 && <span className="text-xs text-slate-400">No flags configured</span>}
                </div>
              </div>
            </div>

            {/* Event log */}
            {eventLog.length > 0 && (
              <div className="bg-slate-900 rounded-xl p-4">
                <p className="text-xs text-slate-500 font-mono mb-2">SSE event log</p>
                <div className="space-y-0.5 max-h-28 overflow-y-auto font-mono">
                  {eventLog.map((line, i) => (
                    <p key={i} className={`text-xs ${i === 0 ? "text-emerald-400" : "text-slate-500"}`}>{line}</p>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Historical stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={XCircle} label="API Failures (24h)" value={failedApi.length} color="#ef4444" />
        <StatCard icon={Bot} label="AI Calls (24h)" value={aiStats.length} color={TEAL} />
        <StatCard icon={AlertTriangle} label="AI Fail Rate" value={`${aiFailRate}%`}
          color={aiFailRate > 20 ? "#f59e0b" : TEAL} />
        <StatCard icon={Shield} label="403 Errors" value={permErrors.reduce((s, e) => s + e.count, 0)} color="#8b5cf6" />
      </div>

      {/* System health */}
      {data?.systemHealth && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4" style={{ color: TEAL }} /> System Health
          </h2>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Database className="w-4 h-4 text-slate-400" />
              <span className="text-slate-600">Database:</span>
              {data.systemHealth.dbConnected
                ? <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Connected</Badge>
                : <Badge className="bg-red-100 text-red-700 border-0 text-xs">Disconnected</Badge>}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Bot className="w-4 h-4 text-slate-400" />
              <span className="text-slate-600">AI:</span>
              {data.systemHealth.aiConfigured
                ? <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Configured</Badge>
                : <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">Not configured</Badge>}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Activity className="w-4 h-4 text-slate-400" />
              <span className="text-slate-600">Active sessions:</span>
              <span className="font-medium text-slate-900">{data.systemHealth.sessionCount}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {sseConnected
                ? <Wifi className="w-4 h-4 text-emerald-400" />
                : <WifiOff className="w-4 h-4 text-slate-300" />}
              <span className="text-slate-600">Live stream:</span>
              <Badge className={`text-xs border-0 ${sseConnected ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {sseConnected ? "Active" : "Reconnecting"}
              </Badge>
            </div>
          </div>
        </div>
      )}

      {/* Tabs — historical logs */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100">
          {([
            { key: "api", label: "Failed API Calls", count: failedApi.length },
            { key: "ai", label: "AI Logs", count: aiStats.length },
            { key: "permission", label: "Permission Errors", count: permErrors.reduce((s, e) => s + e.count, 0) },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                tab === t.key ? "border-b-2 text-teal-600" : "text-slate-500 hover:text-slate-700"
              }`}
              style={tab === t.key ? { borderBottomColor: TEAL } : {}}>
              {t.label}
              {t.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                  tab === t.key ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-500"
                }`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        <div className="p-4">
          {isLoading ? (
            <div className="py-12 text-center text-slate-400 text-sm">Loading diagnostic data…</div>
          ) : (
            <>
              {tab === "api" && (
                <div className="space-y-2">
                  {failedApi.length === 0 ? (
                    <div className="py-8 text-center">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">No API failures in the last 24 hours</p>
                    </div>
                  ) : (
                    failedApi.map((call, i) => (
                      <motion.div key={call.id ?? i}
                        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-start gap-3 p-3 rounded-lg bg-red-50/60 border border-red-100">
                        <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <code className="text-xs font-mono bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                              {call.method} {call.route}
                            </code>
                            <Badge className="bg-red-100 text-red-700 border-0 text-xs">{call.status_code}</Badge>
                            {call.user_role && <Badge className="bg-slate-100 text-slate-600 border-0 text-xs">{call.user_role}</Badge>}
                          </div>
                          <p className="text-xs text-red-600 mt-1 truncate">{call.error_message}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            <Clock className="w-3 h-3 inline mr-1" />
                            {new Date(call.created_at).toLocaleString()}
                          </p>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              )}

              {tab === "ai" && (
                <div className="space-y-2">
                  {aiStats.length === 0 ? (
                    <div className="py-8 text-center">
                      <Bot className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">No AI calls recorded yet</p>
                    </div>
                  ) : (
                    aiStats.map((log, i) => (
                      <motion.div key={log.id ?? i}
                        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className={`flex items-start gap-3 p-3 rounded-lg border ${
                          log.success ? "bg-emerald-50/60 border-emerald-100" : "bg-amber-50/60 border-amber-100"
                        }`}>
                        {log.success
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                          : <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge className={`text-xs border-0 ${log.success ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                              {log.type}
                            </Badge>
                            <span className="text-xs text-slate-500">{log.latency_ms}ms</span>
                          </div>
                          {log.failure_reason && (
                            <p className="text-xs text-amber-600 mt-1">{log.failure_reason}</p>
                          )}
                          <p className="text-xs text-slate-400 mt-0.5">
                            <Clock className="w-3 h-3 inline mr-1" />
                            {new Date(log.created_at).toLocaleString()}
                          </p>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              )}

              {tab === "permission" && (
                <div className="space-y-2">
                  {permErrors.length === 0 ? (
                    <div className="py-8 text-center">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">No permission errors in the last 24 hours</p>
                    </div>
                  ) : (
                    permErrors.map((err, i) => (
                      <motion.div key={i}
                        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-center gap-3 p-3 rounded-lg bg-purple-50/60 border border-purple-100">
                        <Shield className="w-4 h-4 text-purple-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <code className="text-xs font-mono text-purple-700">{err.route}</code>
                          <p className="text-xs text-slate-400 mt-0.5">
                            <span className="font-medium text-purple-600">{err.count}×</span>
                            {" · "}last: {new Date(err.last_seen).toLocaleString()}
                          </p>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
