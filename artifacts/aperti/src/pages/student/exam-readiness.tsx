import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Target, TrendingUp, TrendingDown, Zap, Brain, BarChart3,
  CheckCircle2, AlertTriangle, ArrowRight, Sparkles,
} from "lucide-react";

const IGCSE_COLOR: Record<string, string> = {
  "A*": "text-yellow-500", "A": "text-emerald-500", "B": "text-green-500",
  "C": "text-teal-500", "D": "text-blue-500", "E": "text-orange-500",
  "F": "text-amber-500", "G": "text-red-400", "U": "text-red-600",
};

function ReadinessGauge({ score }: { score: number }) {
  const clamp = Math.min(100, Math.max(0, score));
  const color = clamp >= 75 ? "#10b981" : clamp >= 50 ? "#0d9488" : clamp >= 30 ? "#f59e0b" : "#ef4444";
  const circumference = 2 * Math.PI * 54;
  const dash = (clamp / 100) * circumference;

  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
        <motion.circle
          cx="60" cy="60" r="54" fill="none"
          stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - dash }}
          transition={{ duration: 1.2, delay: 0.3, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold" style={{ color }}>{clamp}</span>
        <span className="text-[11px] text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

export default function ExamReadiness() {
  const { data: profile } = useQuery({
    queryKey: ["student-profile"],
    queryFn: async () => (await apiFetch("/api/student/profile")).json(),
  });
  const studentId = profile?.student?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["exam-readiness", studentId],
    queryFn: async () => {
      const res = await apiFetch(`/api/analytics/exam-readiness/${studentId}`);
      return res.json();
    },
    enabled: !!studentId,
  });

  if (isLoading || !studentId) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted/40 rounded animate-pulse" />
        {[1,2,3].map(i => <div key={i} className="h-32 bg-muted/40 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  const readiness = data?.readiness_score ?? 0;
  const mockAvg = data?.mock_exam_avg;
  const quizAvg = data?.quiz_avg;
  const overallAvg = data?.overall_avg ?? 0;
  const weakTopics = data?.weak_topics ?? [];
  const strongTopics = data?.strong_topics ?? [];
  const ai = data?.ai_insights;

  const readinessLabel = readiness >= 80 ? "Exam Ready" : readiness >= 60 ? "Good Progress" : readiness >= 40 ? "Needs Work" : "Early Stage";
  const readinessColor = readiness >= 80 ? "text-emerald-500" : readiness >= 60 ? "text-primary" : readiness >= 40 ? "text-amber-500" : "text-red-400";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Target className="w-6 h-6 text-primary" /> Exam Readiness
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your CoreMind-powered exam preparation dashboard.</p>
      </div>

      {/* Main readiness gauge */}
      <div className="bg-card border border-border rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6">
        <div className="shrink-0">
          <ReadinessGauge score={readiness} />
          <p className={`text-center font-bold text-sm mt-2 ${readinessColor}`}>{readinessLabel}</p>
        </div>
        <div className="flex-1 space-y-4">
          <div>
            <h2 className="font-bold text-lg">Overall Readiness</h2>
            <p className="text-sm text-muted-foreground">Based on {data?.total_assessments ?? 0} completed assessments across all subjects.</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Mock Exams", value: mockAvg !== null ? `${mockAvg}%` : "—", sub: "avg performance" },
              { label: "Quizzes", value: quizAvg !== null ? `${quizAvg}%` : "—", sub: "avg performance" },
              { label: "Overall", value: `${overallAvg}%`, sub: "all assessments" },
            ].map(s => (
              <div key={s.label} className="bg-muted/50 rounded-xl p-2.5 text-center">
                <p className="text-base font-bold text-primary">{s.value}</p>
                <p className="text-[10px] font-semibold text-muted-foreground">{s.label}</p>
                <p className="text-[9px] text-muted-foreground/70">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Insights */}
      {ai && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-5 space-y-4"
        >
          <h3 className="font-bold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> CoreMind AI Prediction
          </h3>
          <div className="flex items-start gap-4">
            <div className="shrink-0 text-center">
              <p className="text-xs text-muted-foreground mb-1">Predicted Grade</p>
              <span className={`text-3xl font-bold ${IGCSE_COLOR[ai.predicted_grade ?? "U"] ?? "text-foreground"}`}>
                {ai.predicted_grade ?? "—"}
              </span>
              <p className={`text-[10px] mt-1 ${ai.confidence === "high" ? "text-emerald-500" : ai.confidence === "medium" ? "text-amber-500" : "text-red-400"}`}>
                {(ai.confidence ?? "low").charAt(0).toUpperCase() + (ai.confidence ?? "low").slice(1)} confidence
              </p>
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-sm text-muted-foreground">{ai.summary}</p>
              {ai.recommendations?.length > 0 && (
                <div className="space-y-1.5 mt-2">
                  {ai.recommendations.map((r: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <ArrowRight className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Strong topics */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" /> Strong Areas
          </h3>
          {strongTopics.length === 0 ? (
            <p className="text-sm text-muted-foreground">Complete more assessments to see your strong areas.</p>
          ) : (
            <div className="space-y-2">
              {strongTopics.map((t: any) => (
                <div key={t.topic} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{t.topic}</p>
                    <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                      <motion.div className="bg-emerald-500 rounded-full h-1.5"
                        initial={{ width: 0 }} animate={{ width: `${t.pct}%` }} transition={{ duration: 0.8 }} />
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-500 shrink-0">{t.pct}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Weak topics */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-red-400" /> Needs Attention
          </h3>
          {weakTopics.length === 0 ? (
            <p className="text-sm text-muted-foreground">No weak areas detected yet. Keep completing assessments.</p>
          ) : (
            <div className="space-y-2">
              {weakTopics.map((t: any) => (
                <div key={t.topic} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{t.topic}</p>
                    <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                      <motion.div
                        className={`rounded-full h-1.5 ${t.pct < 30 ? "bg-red-400" : t.pct < 50 ? "bg-amber-500" : "bg-yellow-400"}`}
                        initial={{ width: 0 }} animate={{ width: `${t.pct}%` }} transition={{ duration: 0.8 }} />
                    </div>
                  </div>
                  <span className={`text-xs font-bold shrink-0 ${t.pct < 30 ? "text-red-400" : "text-amber-500"}`}>{t.pct}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recommendations */}
      {weakTopics.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 space-y-3">
          <h3 className="font-bold text-sm flex items-center gap-2 text-amber-700">
            <Zap className="w-4 h-4" /> Recommended Actions
          </h3>
          <div className="space-y-2">
            {weakTopics.slice(0, 3).map((t: any) => (
              <div key={t.topic} className="flex items-center gap-3 text-sm">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Revise <strong>{t.topic}</strong> — only {t.pct}% mastery detected</span>
              </div>
            ))}
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>Complete more mock exams to boost your readiness score</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
