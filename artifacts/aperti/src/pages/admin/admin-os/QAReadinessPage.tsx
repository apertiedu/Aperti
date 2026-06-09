import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Rocket, RefreshCw, CheckCircle, Circle, AlertTriangle, Shield, Zap, Eye, Cpu, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const tok = () => localStorage.getItem("aperti_token") || "";
const api = (path: string, opts?: RequestInit) =>
  fetch(path, { ...opts, headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) } });

const RECOMMENDATION: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  not_ready:       { label: "Not Launch Ready",    color: "text-red-700",    bg: "bg-red-50 border-red-200",    icon: AlertTriangle },
  needs_review:    { label: "Needs Review",         color: "text-orange-700", bg: "bg-orange-50 border-orange-200", icon: AlertTriangle },
  ready_for_beta:  { label: "Ready for Beta",       color: "text-blue-700",   bg: "bg-blue-50 border-blue-200",  icon: Star },
  ready_for_launch:{ label: "Ready for Launch! 🚀", color: "text-green-700",  bg: "bg-green-50 border-green-200", icon: Rocket },
};

const CAT_ICONS: Record<string, any> = {
  functionality: Cpu, reliability: RefreshCw, security: Shield,
  performance: Zap, accessibility: Eye, ux: Star,
};

const CHECKLIST_CATEGORIES = [
  "auth", "payments", "performance", "security", "content", "legal", "general"
];

function ScoreGauge({ score }: { score: number }) {
  const angle = -135 + (score / 100) * 270;
  const color = score >= 85 ? "#16a34a" : score >= 70 ? "#2563eb" : score >= 50 ? "#d97706" : "#dc2626";

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-40 h-24 overflow-hidden">
        <svg viewBox="0 0 160 96" className="w-full h-full">
          {/* Background arc */}
          <path d="M 16 80 A 64 64 0 0 1 144 80" stroke="#e5e7eb" strokeWidth="14" fill="none" strokeLinecap="round" />
          {/* Score arc */}
          <path
            d="M 16 80 A 64 64 0 0 1 144 80"
            stroke={color}
            strokeWidth="14"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 201} 201`}
          />
          {/* Needle */}
          <g transform={`translate(80,80) rotate(${angle - 90})`}>
            <line x1="0" y1="0" x2="0" y2="-50" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="0" cy="0" r="5" fill="#374151" />
          </g>
        </svg>
      </div>
      <div className="text-center -mt-2">
        <p className="text-4xl font-black" style={{ color }}>{score}</p>
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">/ 100</p>
      </div>
    </div>
  );
}

export default function QAReadinessPage() {
  const qc = useQueryClient();

  const { data: score, isLoading: scoreLoading } = useQuery({
    queryKey: ["admin-quality-score"],
    queryFn: () => api("/api/admin/quality/score").then(r => r.json()),
  });

  const { data: checklist = [], isLoading: checklistLoading } = useQuery({
    queryKey: ["admin-launch-checklist"],
    queryFn: () => api("/api/admin/launch-checklist").then(r => r.json()),
  });

  const { data: bugStats } = useQuery({
    queryKey: ["admin-bug-stats"],
    queryFn: () => api("/api/admin/bugs/stats").then(r => r.json()),
  });

  const calculateScore = useMutation({
    mutationFn: () => api("/api/admin/quality/calculate", { method: "POST" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-quality-score"] }),
  });

  const toggleChecklist = useMutation({
    mutationFn: ({ id, isCompleted }: { id: number; isCompleted: boolean }) =>
      api(`/api/admin/launch-checklist/${id}`, { method: "PUT", body: JSON.stringify({ isCompleted }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-launch-checklist"] }),
  });

  const overall = score?.overallScore ?? null;
  const categories = score?.scores ?? [];
  const recommendation = calculateScore.data?.recommendation ?? null;
  const calcMetrics = calculateScore.data?.metrics ?? null;
  const checklistDone = checklist.filter((c: any) => c.isCompleted).length;
  const checklistTotal = checklist.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Rocket className="w-6 h-6 text-teal-600" /> Launch Readiness
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Verify platform is ready to launch</p>
        </div>
        <Button
          onClick={() => calculateScore.mutate()}
          disabled={calculateScore.isPending}
          className="bg-teal-600 hover:bg-teal-700 gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${calculateScore.isPending ? "animate-spin" : ""}`} />
          {calculateScore.isPending ? "Calculating…" : "Recalculate Score"}
        </Button>
      </div>

      {/* Recommendation banner */}
      {recommendation && (() => {
        const rec = RECOMMENDATION[recommendation];
        const RecIcon = rec.icon;
        return (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-xl border flex items-center gap-3 ${rec.bg}`}
          >
            <RecIcon className={`w-5 h-5 ${rec.color} shrink-0`} />
            <div>
              <p className={`font-semibold ${rec.color}`}>{rec.label}</p>
              <p className="text-xs text-gray-600 mt-0.5">
                {recommendation === "ready_for_launch"
                  ? "All criteria met. Platform is cleared for public launch."
                  : recommendation === "ready_for_beta"
                  ? "Platform is stable enough for limited beta access. Address remaining issues before full launch."
                  : recommendation === "needs_review"
                  ? "Several issues require attention before launch. Review open bugs and failing tests."
                  : "Critical issues detected. Do not launch until all critical bugs are resolved."}
              </p>
            </div>
          </motion.div>
        );
      })()}

      {/* Main score + breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Gauge */}
        <Card className="border-0 shadow-sm md:col-span-1">
          <CardContent className="p-6 flex flex-col items-center justify-center">
            {scoreLoading ? (
              <div className="text-sm text-gray-400">Loading score…</div>
            ) : overall !== null ? (
              <>
                <ScoreGauge score={overall} />
                <p className="text-sm font-semibold text-gray-700 mt-3">Overall Quality Score</p>
                <p className="text-xs text-gray-400 mt-0.5">{score.date}</p>
              </>
            ) : (
              <div className="text-center space-y-3">
                <div className="w-20 h-20 bg-gray-100 rounded-full mx-auto flex items-center justify-center">
                  <Rocket className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500">Click "Recalculate Score" to compute</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category breakdown */}
        <Card className="border-0 shadow-sm md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">Score Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {categories.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No scores calculated yet</p>
            ) : categories.map((cat: any, i: number) => {
              const Icon = CAT_ICONS[cat.category] ?? Cpu;
              const s = Number(cat.score);
              const color = s >= 85 ? "bg-green-500" : s >= 70 ? "bg-blue-500" : s >= 50 ? "bg-yellow-500" : "bg-red-500";
              return (
                <motion.div key={cat.category} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-gray-400 shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700 capitalize">{cat.category}</span>
                        <span className="text-xs font-bold text-gray-900">{s}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${s}%` }}
                          transition={{ delay: 0.2 + i * 0.05, duration: 0.6 }}
                          className={`h-full rounded-full ${color}`}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Metrics row */}
      {calcMetrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Open Bugs", value: calcMetrics.openBugs, warn: calcMetrics.openBugs > 0 },
            { label: "Critical Bugs", value: calcMetrics.criticalOpen, warn: calcMetrics.criticalOpen > 0 },
            { label: "Tests Passing", value: `${calcMetrics.passed}/${calcMetrics.totalTestCases}`, warn: false },
            { label: "Checklist", value: calcMetrics.checklistProgress, warn: false },
          ].map(m => (
            <Card key={m.label} className={`border-0 shadow-sm ${m.warn ? "bg-red-50" : "bg-white"}`}>
              <CardContent className="p-4">
                <p className={`text-2xl font-bold ${m.warn ? "text-red-700" : "text-gray-900"}`}>{m.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{m.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Launch Checklist */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center justify-between">
            <span>Launch Checklist</span>
            <span className="text-teal-600 font-bold">{checklistDone}/{checklistTotal} complete</span>
          </CardTitle>
          {checklistTotal > 0 && (
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${checklistTotal > 0 ? (checklistDone / checklistTotal) * 100 : 0}%` }}
                transition={{ duration: 0.8 }}
                className="h-full bg-teal-500 rounded-full"
              />
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {checklistLoading ? (
            <div className="p-6 text-center text-sm text-gray-400">Loading checklist…</div>
          ) : checklist.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">Checklist items not seeded yet. Run the DB seed to populate.</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {CHECKLIST_CATEGORIES.map(cat => {
                const items = checklist.filter((c: any) => c.category === cat);
                if (items.length === 0) return null;
                return (
                  <div key={cat}>
                    <div className="px-5 py-2 bg-gray-50 border-b border-gray-100">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{cat}</p>
                    </div>
                    {items.map((item: any, i: number) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors"
                      >
                        <button
                          onClick={() => toggleChecklist.mutate({ id: item.id, isCompleted: !item.isCompleted })}
                          className="shrink-0"
                        >
                          {item.isCompleted
                            ? <CheckCircle className="w-5 h-5 text-teal-600" />
                            : <Circle className="w-5 h-5 text-gray-300 hover:text-teal-400 transition-colors" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${item.isCompleted ? "line-through text-gray-400" : "text-gray-800"}`}>{item.item}</p>
                          {item.notes && <p className="text-xs text-gray-400 mt-0.5">{item.notes}</p>}
                        </div>
                        {item.completedAt && (
                          <p className="text-xs text-gray-400 shrink-0">{new Date(item.completedAt).toLocaleDateString()}</p>
                        )}
                      </motion.div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
