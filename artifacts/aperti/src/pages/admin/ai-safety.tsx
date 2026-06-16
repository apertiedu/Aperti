import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck, CheckCircle2, XCircle, Clock, AlertTriangle,
  Brain, ChevronRight, RefreshCw, Sparkles,
} from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";

const MODULE_COLORS: Record<string, string> = {
  mentor: "bg-primary/15 text-primary",
  grading: "bg-indigo-100 text-indigo-700",
  coremind: "bg-amber-100 text-amber-700",
  "trial-vault": "bg-emerald-100 text-emerald-700",
  "generate-content": "bg-violet-100 text-violet-700",
};

function ConfidenceDot({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-400" : "bg-rose-400";
  return (
    <span className="flex items-center gap-1 text-xs text-slate-500">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {pct}%
    </span>
  );
}

export default function AiSafety() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pending" | "misconceptions">("pending");

  const { data: pending = [], isLoading } = useQuery({
    queryKey: ["ai-safety-pending"],
    queryFn: async () => {
      const res = await apiFetch("/api/coremind/safety/pending");
      return res.json();
    },
    refetchInterval: 20000,
  });

  const { data: stats } = useQuery({
    queryKey: ["ai-analytics-stats"],
    queryFn: async () => {
      const res = await apiFetch("/api/coremind/analytics/stats");
      return res.json();
    },
  });

  const { data: misconceptions = [], refetch: refetchMiscs } = useQuery({
    queryKey: ["misconceptions-all"],
    queryFn: async () => {
      const res = await apiFetch("/api/admin/misconceptions");
      return res.json();
    },
    enabled: tab === "misconceptions",
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, accepted }: { id: number; accepted: boolean }) => {
      const res = await apiFetch(`/api/coremind/safety/review/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted }),
      });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-safety-pending"] }),
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/admin/misconceptions/seed", { method: "POST" });
      return res.json();
    },
    onSuccess: () => refetchMiscs(),
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={22} className="text-amber-600" />
            <h1 className="text-2xl font-bold text-slate-800">AI Safety</h1>
          </div>
          <p className="text-sm text-slate-500">Review AI-generated outputs and manage misconception patterns</p>
        </div>
        <Link href="/admin/ai-analytics">
          <Button variant="outline" size="sm">
            <Brain size={14} className="mr-1.5" /> AI Analytics
          </Button>
        </Link>
      </motion.div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border border-slate-100 shadow-sm">
          <CardContent className="p-4 text-center">
            <Clock size={18} className="mx-auto text-amber-500 mb-1" />
            <p className="text-xl font-bold text-slate-800">{pending.length}</p>
            <p className="text-xs text-slate-500">Pending Review</p>
          </CardContent>
        </Card>
        <Card className="border border-slate-100 shadow-sm">
          <CardContent className="p-4 text-center">
            <CheckCircle2 size={18} className="mx-auto text-emerald-500 mb-1" />
            <p className="text-xl font-bold text-slate-800">{stats?.totalAccepted ?? 0}</p>
            <p className="text-xs text-slate-500">Accepted</p>
          </CardContent>
        </Card>
        <Card className="border border-slate-100 shadow-sm">
          <CardContent className="p-4 text-center">
            <XCircle size={18} className="mx-auto text-rose-500 mb-1" />
            <p className="text-xl font-bold text-slate-800">{stats?.totalRejected ?? 0}</p>
            <p className="text-xs text-slate-500">Rejected</p>
          </CardContent>
        </Card>
        <Card className="border border-slate-100 shadow-sm">
          <CardContent className="p-4 text-center">
            <AlertTriangle size={18} className="mx-auto text-violet-500 mb-1" />
            <p className="text-xl font-bold text-slate-800">{stats?.overallAcceptanceRate ?? 0}%</p>
            <p className="text-xs text-slate-500">Acceptance Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-100 pb-1">
        {(["pending", "misconceptions"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
              tab === t ? "bg-card border border-b-card border-border text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "pending" ? "Pending Review" : "Misconception Patterns"}
          </button>
        ))}
      </div>

      {/* Pending Review Tab */}
      {tab === "pending" && (
        <section className="space-y-3">
          {isLoading && <div className="space-y-3 animate-pulse py-2">{[1,2,3].map(i=><div key={i} className="h-12 bg-gray-100 rounded-xl" />)}</div>}
          {!isLoading && pending.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <ShieldCheck size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">All caught up! No pending reviews.</p>
            </div>
          )}
          {pending.map((item: any) => (
            <Card key={item.id} className="border border-slate-100 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge className={`text-xs ${MODULE_COLORS[item.module] ?? "bg-slate-100 text-slate-600"}`}>
                        {item.module}
                      </Badge>
                      <span className="text-xs text-slate-500">{item.action}</span>
                      <ConfidenceDot confidence={parseFloat(item.confidence ?? "0")} />
                      <span className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</span>
                    </div>
                    {item.inputSummary && (
                      <p className="text-xs text-slate-600 mb-1">
                        <span className="font-medium text-slate-500">Input:</span> {item.inputSummary}
                      </p>
                    )}
                    {item.outputSummary && (
                      <p className="text-xs text-slate-600">
                        <span className="font-medium text-slate-500">Output:</span> {item.outputSummary}
                      </p>
                    )}
                    {item.sources?.length > 0 && (
                      <p className="text-xs text-slate-400 mt-1">
                        Sources: {item.sources.join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 h-8"
                      disabled={reviewMutation.isPending}
                      onClick={() => reviewMutation.mutate({ id: item.id, accepted: true })}
                    >
                      <CheckCircle2 size={13} className="mr-1" /> Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-rose-200 text-rose-600 hover:bg-rose-50 h-8"
                      disabled={reviewMutation.isPending}
                      onClick={() => reviewMutation.mutate({ id: item.id, accepted: false })}
                    >
                      <XCircle size={13} className="mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {/* Misconception Patterns Tab */}
      {tab === "misconceptions" && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{misconceptions.length} patterns loaded</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
            >
              <Sparkles size={13} className="mr-1.5" />
              {seedMutation.isPending ? "Seeding..." : "Seed Default Patterns"}
            </Button>
          </div>

          {misconceptions.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <AlertTriangle size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">No misconception patterns yet.</p>
              <p className="text-xs mt-1">Click "Seed Default Patterns" to populate with common mistakes.</p>
            </div>
          )}

          <div className="grid gap-3">
            {misconceptions.map((m: any) => (
              <Card key={m.id} className="border border-slate-100 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-semibold text-slate-800">{m.pattern}</span>
                        <Badge variant="secondary" className="text-xs">{m.subject}</Badge>
                        <span className="text-xs text-slate-400">{m.topic}</span>
                        <Badge
                          className={`text-xs ${m.severity === "high" ? "bg-rose-100 text-rose-700" : m.severity === "medium" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}
                        >
                          {m.severity}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-600">{m.description}</p>
                      {m.examples?.length > 0 && (
                        <p className="text-xs text-slate-400 mt-1">Examples: {m.examples.join("; ")}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
