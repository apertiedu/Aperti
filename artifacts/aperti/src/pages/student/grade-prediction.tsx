import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, TrendingDown, Minus, Sparkles, Brain, AlertCircle,
  CheckCircle2, BarChart2, Target, Loader2, Lightbulb,
  ArrowUpRight, Info, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";

interface WhatIfResult {
  student_id: number;
  topic: string;
  improvement_pct: number;
  current_topic_score: number;
  simulated_topic_score: number;
  estimated_score_gain: number;
  new_predicted_range: [number, number];
  original_range: [number, number];
  confidence: string;
  note?: string;
}

interface PredictionData {
  student_id: number;
  predicted_score_range: [number, number];
  pass_probability: number;
  risk_level: "low" | "medium" | "high";
  key_factors: string[];
  improvement_suggestions: string[];
  what_if_simulations: { scenario: string; predicted_score_increase: string; new_predicted_range: [number, number] }[];
  confidence_level?: "low" | "medium" | "high";
  trend?: "improving" | "stable" | "declining";
  disclaimer: string;
  ai_generated: boolean;
  data_points_used: number;
  recent_avg?: number;
  overall_avg?: number;
}

const RISK_CONFIG = {
  low: { color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", bar: "bg-emerald-500", label: "Low Risk" },
  medium: { color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", bar: "bg-amber-500", label: "Medium Risk" },
  high: { color: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200", bar: "bg-rose-500", label: "High Risk" },
};

const TREND_CONFIG = {
  improving: { icon: TrendingUp, color: "text-emerald-600", label: "Improving" },
  stable: { icon: Minus, color: "text-amber-600", label: "Stable" },
  declining: { icon: TrendingDown, color: "text-rose-600", label: "Declining" },
};

function ScoreGauge({ min, max }: { min: number; max: number }) {
  const mid = (min + max) / 2;
  const passLine = 50;
  return (
    <div className="relative">
      <div className="h-5 w-full rounded-full bg-muted/40 overflow-hidden border border-border">
        <div className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-700"
          style={{ marginLeft: `${min}%`, width: `${max - min}%` }} />
      </div>
      <div className="absolute top-0 bottom-0 flex items-center" style={{ left: `${passLine}%` }}>
        <div className="w-0.5 h-full bg-amber-400 opacity-70" />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
        <span>0%</span>
        <span className="text-amber-600 font-medium">Pass: 50%</span>
        <span>100%</span>
      </div>
      <div className="text-center mt-1">
        <span className="text-3xl font-extrabold text-foreground">{min}–{max}</span>
        <span className="text-base text-muted-foreground">%</span>
        <p className="text-xs text-muted-foreground">Predicted score range</p>
      </div>
    </div>
  );
}

export default function GradePredictionPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const studentId = user?.id;

  const [whatIfTopic, setWhatIfTopic] = useState("");
  const [whatIfPct, setWhatIfPct] = useState(20);
  const [whatIfResult, setWhatIfResult] = useState<WhatIfResult | null>(null);

  const { data: prediction, isLoading, error, refetch } = useQuery<PredictionData>({
    queryKey: ["grade-prediction", studentId],
    queryFn: () => apiFetch(`/api/grade-prediction/student/${studentId}`).then(r => r.json()),
    enabled: !!studentId,
    staleTime: 5 * 60_000,
  });

  const whatIfMutation = useMutation({
    mutationFn: (payload: { student_id: number; topic: string; improvement_pct: number; current_range: [number, number] }) =>
      apiFetch("/api/grade-prediction/what-if", { method: "POST", body: JSON.stringify(payload) }).then(r => r.json()),
    onSuccess: (data: WhatIfResult) => setWhatIfResult(data),
    onError: () => toast({ title: "Error", description: "Simulation failed. Please retry.", variant: "destructive" }),
  });

  function handleWhatIf() {
    if (!studentId || !whatIfTopic.trim() || !prediction) return;
    whatIfMutation.mutate({
      student_id: studentId,
      topic: whatIfTopic.trim(),
      improvement_pct: whatIfPct,
      current_range: prediction.predicted_score_range,
    });
  }

  if (isLoading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Analysing your exam history…</p>
      </div>
    );
  }

  if (error || !prediction) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-6 text-center">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-3" />
          <p className="font-semibold text-destructive">Could not load prediction</p>
          <Button onClick={() => refetch()} size="sm" className="mt-3 gap-2"><Zap className="h-4 w-4" /> Retry</Button>
        </div>
      </div>
    );
  }

  const risk = RISK_CONFIG[prediction.risk_level];
  const trendConf = TREND_CONFIG[prediction.trend ?? "stable"];
  const TrendIcon = trendConf.icon;
  const passProb = Math.round(prediction.pass_probability * 100);
  const hasSufficientData = prediction.data_points_used >= 5;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BarChart2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">Grade Forecast</h1>
            <p className="text-sm text-muted-foreground">Predictive engine based on your exam history</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {prediction.ai_generated && <Badge className="bg-violet-100 text-violet-700 border-violet-200">AI</Badge>}
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
              <Sparkles className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
        </div>
      </motion.div>

      {!hasSufficientData && (
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 p-4">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Limited data available</p>
            <p className="text-xs text-amber-700 mt-0.5">Only {prediction.data_points_used} data points found. Prediction confidence is lower — complete more exams for better accuracy.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="md:col-span-2 rounded-xl bg-card border border-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-foreground">Predicted Score</h2>
            <div className="flex items-center gap-2">
              <TrendIcon className={`h-4 w-4 ${trendConf.color}`} />
              <span className={`text-xs font-medium ${trendConf.color}`}>{trendConf.label}</span>
            </div>
          </div>
          <ScoreGauge min={prediction.predicted_score_range[0]} max={prediction.predicted_score_range[1]} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="space-y-3">
          <div className={`rounded-xl border p-4 ${risk.bg} ${risk.border}`}>
            <div className="text-xs font-medium text-muted-foreground mb-1">Risk level</div>
            <div className={`text-xl font-extrabold ${risk.color}`}>{risk.label}</div>
          </div>
          <div className="rounded-xl bg-card border border-border p-4">
            <div className="text-xs font-medium text-muted-foreground mb-1">Pass probability</div>
            <div className="text-2xl font-extrabold text-foreground">{passProb}%</div>
            <div className="h-1.5 w-full bg-muted rounded-full mt-2 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${passProb >= 70 ? "bg-emerald-500" : passProb >= 50 ? "bg-amber-500" : "bg-rose-500"}`}
                style={{ width: `${passProb}%` }} />
            </div>
          </div>
          {prediction.recent_avg !== undefined && (
            <div className="rounded-xl bg-card border border-border p-4">
              <div className="text-xs font-medium text-muted-foreground mb-1">Recent avg</div>
              <div className="text-2xl font-extrabold text-foreground">{prediction.recent_avg}%</div>
              {prediction.overall_avg !== undefined && (
                <div className="text-xs text-muted-foreground">Overall: {prediction.overall_avg}%</div>
              )}
            </div>
          )}
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="rounded-xl bg-card border border-border p-5 space-y-3">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" /> Key factors affecting your score
        </h2>
        <div className="space-y-2">
          {prediction.key_factors.map((factor, i) => (
            <div key={i} className="flex items-start gap-2.5 text-sm text-foreground">
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-primary">{i + 1}</span>
              </div>
              {factor}
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
        className="rounded-xl bg-card border border-border p-5 space-y-3">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" /> How to improve your score
        </h2>
        <div className="space-y-2">
          {prediction.improvement_suggestions.map((s, i) => (
            <div key={i} className="flex items-start gap-2.5 rounded-lg bg-muted/30 border border-border px-3 py-2.5 text-sm text-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              {s}
            </div>
          ))}
        </div>
      </motion.div>

      {prediction.what_if_simulations.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="rounded-xl bg-card border border-border p-5 space-y-3">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> AI What-if simulations
          </h2>
          <p className="text-xs text-muted-foreground">See how improving specific topics would affect your predicted score.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {prediction.what_if_simulations.map((sim, i) => (
              <div key={i} className="rounded-lg bg-emerald-50 border border-emerald-200 p-4">
                <p className="text-sm font-medium text-emerald-800 mb-1">{sim.scenario}</p>
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                  <span className="text-lg font-extrabold text-emerald-700">{sim.predicted_score_increase}</span>
                </div>
                <p className="text-xs text-emerald-600 mt-1">
                  New range: {sim.new_predicted_range[0]}–{sim.new_predicted_range[1]}%
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        className="rounded-xl bg-card border border-border p-5 space-y-4">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" /> Custom what-if simulation
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Topic to improve</label>
            <input value={whatIfTopic} onChange={e => setWhatIfTopic(e.target.value)}
              placeholder="e.g. Algebra, Forces, Electrolysis"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Improvement: <span className="text-primary font-bold">+{whatIfPct}%</span>
            </label>
            <input type="range" min={5} max={50} step={5} value={whatIfPct} onChange={e => setWhatIfPct(parseInt(e.target.value))}
              className="w-full accent-primary" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>5%</span><span>25%</span><span>50%</span></div>
          </div>
        </div>
        <Button onClick={handleWhatIf} disabled={whatIfMutation.isPending || !whatIfTopic.trim()} size="sm" className="gap-2">
          {whatIfMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
          Run simulation
        </Button>

        <AnimatePresence>
          {whatIfResult && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="h-5 w-5 text-emerald-600" />
                <span className="font-semibold text-emerald-800">Simulation result</span>
                {whatIfResult.confidence === "low" && (
                  <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200 ml-auto">Low confidence</Badge>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-lg font-extrabold text-foreground">{whatIfResult.current_topic_score}%</div>
                  <div className="text-xs text-muted-foreground">Current {whatIfResult.topic}</div>
                </div>
                <div className="flex items-center justify-center">
                  <ArrowUpRight className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <div className="text-lg font-extrabold text-emerald-700">{whatIfResult.simulated_topic_score}%</div>
                  <div className="text-xs text-muted-foreground">Simulated score</div>
                </div>
              </div>
              <div className="text-sm text-emerald-800 font-medium text-center">
                Overall score gain: <span className="font-extrabold">+{whatIfResult.estimated_score_gain} points</span>
                {" · "}New range: {whatIfResult.new_predicted_range[0]}–{whatIfResult.new_predicted_range[1]}%
              </div>
              {whatIfResult.note && (
                <p className="text-xs text-amber-700 flex items-start gap-1"><Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />{whatIfResult.note}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="flex items-start gap-2 rounded-xl bg-muted/30 border border-border p-4">
        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">{prediction.disclaimer}</p>
      </div>
    </div>
  );
}
