import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/api";
import {
  AlertTriangle, Bot, Shield, RefreshCw, Clock, CheckCircle2,
  XCircle, Activity, Terminal, Database,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const TEAL = "#0D9488";

interface DebugStats {
  failedApiCalls: Array<{
    id: number;
    route: string;
    method: string;
    status_code: number;
    error_message: string;
    created_at: string;
    user_role?: string;
  }>;
  aiLogs: Array<{
    id: number;
    type: string;
    success: boolean;
    latency_ms: number;
    failure_reason?: string;
    created_at: string;
  }>;
  permissionErrors: Array<{
    route: string;
    count: number;
    last_seen: string;
  }>;
  systemHealth: {
    dbConnected: boolean;
    aiConfigured: boolean;
    sessionCount: number;
  };
}

function StatCard({ icon: Icon, label, value, color = TEAL }: {
  icon: React.ComponentType<any>; label: string; value: string | number; color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className="text-lg font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

export default function AdminDebugPage() {
  const [tab, setTab] = useState<"api" | "ai" | "permission">("api");

  const { data, isLoading, refetch, dataUpdatedAt } = useQuery<DebugStats>({
    queryKey: ["admin-debug"],
    queryFn: () => apiFetch("/api/admin/debug"),
    refetchInterval: 30_000,
  });

  const aiStats = data?.aiLogs ?? [];
  const failedApi = data?.failedApiCalls ?? [];
  const permErrors = data?.permissionErrors ?? [];

  const aiFailRate = aiStats.length > 0
    ? Math.round((aiStats.filter(l => !l.success).length / aiStats.length) * 100)
    : 0;

  const lastUpdate = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : "—";

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Terminal className="w-5 h-5" style={{ color: TEAL }} />
            System Diagnostic Panel
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Last updated: {lastUpdate}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="gap-2 text-xs"
          disabled={isLoading}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={XCircle} label="API Failures (24h)" value={failedApi.length} color="#ef4444" />
        <StatCard icon={Bot} label="AI Calls (24h)" value={aiStats.length} color={TEAL} />
        <StatCard icon={AlertTriangle} label="AI Fail Rate" value={`${aiFailRate}%`} color={aiFailRate > 20 ? "#f59e0b" : TEAL} />
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
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100">
          {([
            { key: "api", label: "Failed API Calls", count: failedApi.length },
            { key: "ai", label: "AI Logs", count: aiStats.length },
            { key: "permission", label: "Permission Errors", count: permErrors.reduce((s, e) => s + e.count, 0) },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                tab === t.key
                  ? "border-b-2 text-teal-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
              style={tab === t.key ? { borderBottomColor: TEAL } : {}}
            >
              {t.label}
              {t.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                  tab === t.key ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-500"
                }`}>
                  {t.count}
                </span>
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
                      <motion.div
                        key={call.id ?? i}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-start gap-3 p-3 rounded-lg bg-red-50/60 border border-red-100"
                      >
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
                      <motion.div
                        key={log.id ?? i}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className={`flex items-start gap-3 p-3 rounded-lg border ${
                          log.success ? "bg-emerald-50/60 border-emerald-100" : "bg-amber-50/60 border-amber-100"
                        }`}
                      >
                        {log.success
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                          : <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                        }
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
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-center gap-3 p-3 rounded-lg bg-purple-50/60 border border-purple-100"
                      >
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
