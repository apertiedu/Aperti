import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Rocket, CheckCircle2, XCircle, AlertTriangle, Server, GitBranch, BarChart3, ArrowRight, Shield } from "lucide-react";

const CATEGORY_ICONS: Record<string, any> = {
  infrastructure: Server,
  security:       Shield,
  data:           BarChart3,
  ai:             BarChart3,
  payments:       BarChart3,
  monitoring:     BarChart3,
};

const CATEGORY_COLORS: Record<string, string> = {
  infrastructure: "bg-blue-100 text-blue-700",
  security:       "bg-red-100 text-red-700",
  data:           "bg-teal-100 text-teal-700",
  ai:             "bg-purple-100 text-purple-700",
  payments:       "bg-emerald-100 text-emerald-700",
  monitoring:     "bg-amber-100 text-amber-700",
};

function CheckRow({ check }: { check: any }) {
  const Icon = check.status === "pass" ? CheckCircle2 : check.status === "fail" ? XCircle : AlertTriangle;
  const color = check.status === "pass" ? "text-emerald-500" : check.status === "fail" ? "text-red-500" : "text-amber-500";
  return (
    <div className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 ${check.status === "fail" && check.blocking ? "bg-red-50/50" : ""}`}>
      <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${color}`} />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-gray-800">{check.name}</p>
          {check.blocking && <Badge className="text-[9px] bg-red-50 text-red-600 border-red-200 border">blocking</Badge>}
          <Badge className={`text-[9px] border ${CATEGORY_COLORS[check.category] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>{check.category}</Badge>
        </div>
        <p className="text-[11px] text-gray-500 mt-0.5">{check.detail}</p>
      </div>
    </div>
  );
}

function EnvCard({ env, current }: { env: any; current: string }) {
  const isCurrent = env.name === current;
  return (
    <Card className={`border-0 shadow-sm ${isCurrent ? "ring-2 ring-primary/30" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold text-gray-900 capitalize">{env.name}</p>
          <Badge className={`text-[10px] border ${env.name === "development" ? "bg-blue-100 text-blue-800 border-blue-200" : env.name === "staging" ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-emerald-100 text-emerald-800 border-emerald-200"}`}>
            {isCurrent ? "current" : env.name}
          </Badge>
        </div>
        <div className="space-y-1.5">
          {[
            { label: "Data",     value: env.data },
            { label: "Payments", value: env.payments },
            { label: "AI",       value: env.ai },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between">
              <span className="text-[11px] text-gray-400">{label}</span>
              <span className="text-[11px] font-semibold text-gray-700">{value}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {env.features?.map((f: string) => (
            <Badge key={f} className="text-[9px] bg-gray-50 text-gray-500 border border-gray-100 font-normal">{f}</Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DeploymentPipeline() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["deployment-readiness"],
    queryFn: async () => {
      const r = await fetch("/api/deployment/readiness", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    refetchInterval: 60_000,
  });

  const { data: envData } = useQuery<any>({
    queryKey: ["deployment-environments"],
    queryFn: async () => {
      const r = await fetch("/api/deployment/environments", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const checks: any[] = data?.checks ?? [];
  const summary = data?.summary ?? {};
  const score = data?.score ?? 0;
  const ready = data?.ready_for_production ?? false;
  const current = envData?.current ?? "development";

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Rocket className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Deployment Pipeline</h1>
            <p className="text-sm text-gray-500">Readiness checks, environment status & rollback rules</p>
          </div>
          <div className="ml-auto">
            <Badge className={`text-sm px-4 py-1.5 border font-bold ${ready ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-red-100 text-red-800 border-red-300"}`}>
              {ready ? "Production Ready" : "NOT Ready"}
            </Badge>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs text-gray-500 mb-1">Readiness Score</p>
            <p className="text-3xl font-black text-gray-900">{isLoading ? "—" : `${score}%`}</p>
            <Progress value={score} className="h-1.5 mt-2" />
          </CardContent>
        </Card>
        {[
          { label: "Passed",   value: summary.passed,            color: "bg-emerald-100 text-emerald-600" },
          { label: "Warnings", value: summary.warnings,          color: "bg-amber-100 text-amber-600" },
          { label: "Blocking", value: summary.blocking_failures, color: summary.blocking_failures > 0 ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-600" },
        ].map(({ label, value, color }) => (
          <Card key={label} className="border-0 shadow-sm">
            <CardContent className="p-5 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${color}`}>
                <BarChart3 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-xl font-black text-gray-900">{value ?? "—"}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-blue-500" />Pre-deploy Checks
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-gray-100 animate-pulse rounded-lg" />)}</div>
              ) : (
                <div className="divide-y">{checks.map((c, i) => <CheckRow key={i} check={c} />)}</div>
              )}
            </CardContent>
          </Card>

          {/* Deployment flow */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-violet-500" />Deployment Flow
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="flex flex-col gap-2">
                {(data?.deployment_flow ?? []).map((step: string, i: number) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="h-5 w-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</div>
                    <p className="text-xs text-gray-700">{step.replace(/^\d+\.\s*/, "")}</p>
                    {i < (data?.deployment_flow?.length ?? 0) - 1 && (
                      <ArrowRight className="h-3 w-3 text-gray-300 ml-auto mt-1 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
              {data?.rollback_rule && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                  <p className="text-xs text-amber-700 font-semibold">Rollback Rule</p>
                  <p className="text-xs text-amber-600 mt-0.5">{data.rollback_rule}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Environments</h2>
          {(envData?.environments ?? []).map((env: any) => (
            <EnvCard key={env.name} env={env} current={current} />
          ))}
        </div>
      </div>
    </div>
  );
}
