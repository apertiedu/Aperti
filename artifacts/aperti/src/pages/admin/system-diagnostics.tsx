import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2, XCircle, AlertTriangle, RefreshCw,
  Brain, Database, Shield, Server, Clock, Zap,
  Activity, ChevronRight, Terminal, Globe,
} from "lucide-react";

const TEAL = "#0D9488";

async function apiFetch(url: string) {
  const res = await fetch(`/api${url}`, { credentials: "include" });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

async function apiPost(url: string) {
  const res = await fetch(`/api${url}`, { method: "POST", credentials: "include" });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

type HealthStatus = "healthy" | "connected" | "degraded" | "error" | "missing";

function StatusBadge({ status }: { status: HealthStatus | string }) {
  const ok = status === "healthy" || status === "connected";
  const warn = status === "degraded";
  if (ok) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-700 border border-teal-200">
      <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
      {status}
    </span>
  );
  if (warn) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
      {status}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700 border border-red-200">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
      {status}
    </span>
  );
}

function EnvRow({ label, present }: { label: string; present: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-sm font-mono text-gray-600">{label}</span>
      {present ? (
        <span className="inline-flex items-center gap-1 text-xs text-teal-700 font-semibold">
          <CheckCircle2 className="h-3.5 w-3.5" /> configured
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-xs text-red-600 font-semibold">
          <XCircle className="h-3.5 w-3.5" /> missing
        </span>
      )}
    </div>
  );
}

function LatencyBar({ ms, maxMs = 2000 }: { ms: number; maxMs?: number }) {
  const pct = Math.min(Math.round((ms / maxMs) * 100), 100);
  const color = ms < 300 ? "#0D9488" : ms < 1000 ? "#F59E0B" : "#EF4444";
  return (
    <div className="mt-2">
      <div className="flex justify-between text-[10px] text-gray-400 mb-1">
        <span>Latency</span>
        <span className="font-bold" style={{ color }}>{ms}ms</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

export default function SystemDiagnostics() {
  const qc = useQueryClient();
  const [lastRun, setLastRun] = useState<string | null>(null);

  const { data: diag, isLoading, error: diagError } = useQuery({
    queryKey: ["system-diagnostics"],
    queryFn: () => apiFetch("/system/diagnostics"),
    refetchInterval: 60_000,
    retry: 1,
    staleTime: 30_000,
  });

  const { data: openaiHealth, isPending: oaiPending, mutate: runOpenAICheck } = useMutation({
    mutationFn: () => apiFetch("/system/openai-health"),
    onSuccess: (data) => {
      setLastRun(new Date().toLocaleTimeString());
      qc.setQueryData(["system-diagnostics"], (old: any) =>
        old ? { ...old, openai: data } : old
      );
    },
  });

  const overallStatus: HealthStatus = diag?.overall ?? "error";
  const openai   = openaiHealth ?? diag?.openai;
  const database = diag?.database;
  const env      = diag?.environment;
  const deploy   = diag?.deployment;

  const overallOk = overallStatus === "healthy";

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: `${TEAL}15` }}>
              <Terminal className="h-5 w-5" style={{ color: TEAL }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">System Diagnostics</h1>
              <p className="text-sm text-gray-500">OpenAI · Database · Environment · Deployment</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lastRun && (
              <span className="text-xs text-gray-400">Last check: {lastRun}</span>
            )}
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => qc.invalidateQueries({ queryKey: ["system-diagnostics"] })}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh All
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Overall status banner */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-6">
        <div className={`rounded-xl p-4 flex items-center gap-3 border ${
          overallOk
            ? "bg-teal-50 border-teal-200"
            : overallStatus === "degraded"
            ? "bg-amber-50 border-amber-200"
            : "bg-red-50 border-red-200"
        }`}>
          {overallOk
            ? <CheckCircle2 className="h-5 w-5 text-teal-600 shrink-0" />
            : overallStatus === "degraded"
            ? <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            : <XCircle className="h-5 w-5 text-red-600 shrink-0" />
          }
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">
              {overallOk
                ? "All systems operational"
                : overallStatus === "degraded"
                ? "One or more systems are degraded"
                : isLoading ? "Running diagnostics…" : "System check failed — review below"}
            </p>
            {diag?.timestamp && (
              <p className="text-xs text-gray-500 mt-0.5">
                Last updated: {new Date(diag.timestamp).toLocaleString()}
              </p>
            )}
          </div>
          <StatusBadge status={overallStatus} />
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── OpenAI ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-0 shadow-sm bg-card h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-purple-50">
                    <Brain className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">OpenAI / AI Provider</CardTitle>
                    <CardDescription className="text-xs">Live connectivity check</CardDescription>
                  </div>
                </div>
                {openai && <StatusBadge status={openai.status} />}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading && !openai ? (
                <div className="space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ) : openai ? (
                <>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Provider</p>
                      <p className="font-semibold text-gray-800">{openai.provider ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Model</p>
                      <p className="font-semibold text-gray-800 truncate">{openai.model ?? "—"}</p>
                    </div>
                  </div>
                  {openai.latency > 0 && <LatencyBar ms={openai.latency} maxMs={3000} />}
                  {openai.status === "error" && openai.message && (
                    <div className="mt-2 p-2.5 rounded-lg bg-red-50 border border-red-100">
                      <p className="text-xs text-red-700 font-medium">{openai.message}</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-400">No data — run a health check below.</p>
              )}

              <div className="pt-2">
                <Button
                  size="sm"
                  className="w-full gap-2 text-white"
                  style={{ background: `linear-gradient(135deg, ${TEAL}, #00897B)` }}
                  onClick={() => runOpenAICheck()}
                  disabled={oaiPending}
                >
                  {oaiPending
                    ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Checking…</>
                    : <><Zap className="h-3.5 w-3.5" /> Run Health Check</>
                  }
                </Button>
              </div>

              <AnimatePresence>
                {openaiHealth && (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className={`p-2.5 rounded-lg border text-xs font-medium flex items-center gap-2 ${
                      openaiHealth.status === "healthy"
                        ? "bg-teal-50 border-teal-200 text-teal-700"
                        : "bg-red-50 border-red-200 text-red-700"
                    }`}>
                      {openaiHealth.status === "healthy"
                        ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        : <XCircle className="h-3.5 w-3.5 shrink-0" />
                      }
                      {openaiHealth.status === "healthy"
                        ? `Connected · ${openaiHealth.latency}ms · ${openaiHealth.model}`
                        : openaiHealth.message ?? "Connection failed"
                      }
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Database ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="border-0 shadow-sm bg-card h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-blue-50">
                    <Database className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Database</CardTitle>
                    <CardDescription className="text-xs">PostgreSQL connection status</CardDescription>
                  </div>
                </div>
                {database && <StatusBadge status={database.status} />}
              </div>
            </CardHeader>
            <CardContent>
              {isLoading && !database ? (
                <div className="space-y-2">
                  <Skeleton className="h-5 w-1/2" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ) : database ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Connection</p>
                    <p className="text-sm font-semibold text-gray-800">PostgreSQL</p>
                  </div>
                  {database.latencyMs !== undefined && (
                    <LatencyBar ms={database.latencyMs} maxMs={1000} />
                  )}
                  {database.status === "error" && (
                    <div className="p-2.5 rounded-lg bg-red-50 border border-red-100">
                      <p className="text-xs text-red-700 font-medium">{database.message ?? "Connection failed"}</p>
                    </div>
                  )}
                  {database.status === "connected" && (
                    <div className="p-2.5 rounded-lg bg-teal-50 border border-teal-100">
                      <p className="text-xs text-teal-700 font-medium">
                        <CheckCircle2 className="inline h-3 w-3 mr-1" />
                        Pool responding normally
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400 py-2">No data yet. Refresh to check.</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Environment ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-0 shadow-sm bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-orange-50">
                    <Shield className="h-4 w-4 text-orange-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Environment</CardTitle>
                    <CardDescription className="text-xs">Required secrets — presence only, no values</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading && !env ? (
                <div className="space-y-2">
                  {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-8 rounded" />)}
                </div>
              ) : env ? (
                <div>
                  <EnvRow label="DATABASE_URL"   present={env.DATABASE_URL} />
                  <EnvRow label="JWT_SECRET"      present={env.JWT_SECRET} />
                  <EnvRow label="SESSION_SECRET"  present={env.SESSION_SECRET} />
                  <EnvRow label="OPENAI_API_KEY"  present={env.OPENAI_API_KEY} />
                  <EnvRow label="NVIDIA_API_KEY"  present={env.NVIDIA_API_KEY} />
                  <EnvRow label="AI_INTEGRATION"  present={env.AI_INTEGRATION} />
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Active AI Provider</p>
                    <p className="text-sm font-semibold text-gray-800">{env.activeAiProvider ?? "none"}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400">No data yet.</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Deployment ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="border-0 shadow-sm bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-teal-50">
                    <Globe className="h-4 w-4" style={{ color: TEAL }} />
                  </div>
                  <div>
                    <CardTitle className="text-base">Deployment</CardTitle>
                    <CardDescription className="text-xs">Runtime environment & resource usage</CardDescription>
                  </div>
                </div>
                {deploy && (
                  <Badge variant="outline" className="text-[10px]">
                    {deploy.nodeEnv}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoading && !deploy ? (
                <div className="space-y-2">
                  {[1,2,3,4].map(i => <Skeleton key={i} className="h-6 rounded" />)}
                </div>
              ) : deploy ? (
                <div className="space-y-0">
                  {[
                    { label: "Node.js version", value: deploy.nodeVersion ?? "—" },
                    { label: "Platform",         value: deploy.platform ?? "—" },
                    { label: "Uptime",           value: `${Math.floor((deploy.uptime ?? 0) / 3600)}h ${Math.floor(((deploy.uptime ?? 0) % 3600) / 60)}m` },
                    { label: "Memory used",      value: deploy.memoryMB ? `${deploy.memoryMB.used} MB / ${deploy.memoryMB.total} MB (${deploy.memoryMB.percent}%)` : "—" },
                    { label: "Environment",      value: deploy.nodeEnv ?? "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center py-2 border-b border-border last:border-0 text-sm">
                      <span className="text-gray-500">{label}</span>
                      <span className="font-semibold text-gray-800">{value}</span>
                    </div>
                  ))}
                  {deploy.memoryMB && (
                    <div className="mt-3">
                      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{
                            background: deploy.memoryMB.percent > 85 ? "#EF4444"
                              : deploy.memoryMB.percent > 65 ? "#F59E0B"
                              : TEAL,
                          }}
                          initial={{ width: 0 }}
                          animate={{ width: `${deploy.memoryMB.percent}%` }}
                          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">Memory pressure: {deploy.memoryMB.percent}%</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No data yet.</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Error state */}
      {diagError && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-5">
          <Card className="border-red-200 bg-red-50 border shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <XCircle className="h-5 w-5 text-red-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-800">Diagnostics endpoint unreachable</p>
                <p className="text-xs text-red-600 mt-0.5">{(diagError as Error).message}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Navigation hint */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="mt-6">
        <p className="text-xs text-gray-400 flex items-center gap-1">
          <Activity className="h-3 w-3" />
          Secrets are never transmitted to the frontend — only presence is indicated.
          <ChevronRight className="h-3 w-3 mx-1" />
          For full infrastructure metrics, see{" "}
          <a href="/admin/health" className="underline hover:text-gray-600">Platform Health</a>.
        </p>
      </motion.div>
    </div>
  );
}
