import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, Sparkles, BookOpen, Brain, Zap, Target, ChevronLeft,
  ChevronRight, CheckCircle2, Clock, RefreshCw, Download, FlaskConical,
  GraduationCap, Loader2, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const TEAL = "#0D9488";

interface RevisionTask {
  type: "flashcards" | "questions" | "revision" | "simulation";
  title: string;
  duration_min: number;
  subject: string;
  topic: string;
}
interface RevisionDay {
  day: number;
  date: string;
  theme: string;
  tasks: RevisionTask[];
}
interface PlanResponse {
  plan: RevisionDay[];
  daysAvailable: number;
  generatedAt: string;
  aiGenerated: boolean;
}

const TASK_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  flashcards: Brain,
  questions: BookOpen,
  revision: GraduationCap,
  simulation: FlaskConical,
};

const TASK_COLORS: Record<string, string> = {
  flashcards: "#7C3AED",
  questions: "#DC2626",
  revision: "#0D9488",
  simulation: "#D97706",
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getDayName(dateStr: string): string {
  return DAY_NAMES[new Date(dateStr).getDay()];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

interface PlanForm {
  examDate: string;
  mode: "balanced" | "weak" | "exam";
  subject: string;
}

export default function RevisionPlanPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<PlanForm>({ examDate: "", mode: "balanced", subject: "" });
  const [plan, setPlan] = useState<RevisionDay[] | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string>("");
  const [aiGenerated, setAiGenerated] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  const generate = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/revision/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed to generate plan");
      return res.json() as Promise<PlanResponse>;
    },
    onSuccess: (data) => {
      setPlan(data.plan);
      setGeneratedAt(data.generatedAt);
      setAiGenerated(data.aiGenerated);
      setWeekOffset(0);
      setCompletedTasks(new Set());
      setExpandedDay(null);
      toast({
        title: data.aiGenerated ? "AI Revision Plan Ready" : "Revision Plan Ready",
        description: `${data.plan.length}-day plan generated for you.`,
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not generate plan. Please try again.", variant: "destructive" });
    },
  });

  const toggleTask = (taskKey: string) => {
    setCompletedTasks(s => {
      const next = new Set(s);
      if (next.has(taskKey)) next.delete(taskKey);
      else next.add(taskKey);
      return next;
    });
  };

  const weekDays = plan
    ? plan.slice(weekOffset * 7, weekOffset * 7 + 7)
    : [];
  const totalWeeks = plan ? Math.ceil(plan.length / 7) : 0;

  const completedCount = plan
    ? plan.flatMap((d, di) => d.tasks.map((_, ti) => `${di}-${ti}`)).filter(k => completedTasks.has(k)).length
    : 0;
  const totalTasks = plan ? plan.reduce((s, d) => s + d.tasks.length, 0) : 0;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Calendar className="h-6 w-6" style={{ color: TEAL }} />
            Smart Revision Plan
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-powered daily schedule based on your weak topics and exam date.
          </p>
        </div>
        {plan && (
          <Badge variant="outline" className="gap-1 shrink-0">
            {aiGenerated && <Sparkles className="h-3 w-3" style={{ color: TEAL }} />}
            {aiGenerated ? "AI Plan" : "Smart Plan"}
          </Badge>
        )}
      </div>

      {/* Generator form */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-2xl border border-border shadow-sm p-5"
      >
        <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: TEAL }} />
          Configure Your Plan
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Exam Date (optional)</label>
            <input
              type="date"
              value={form.examDate}
              min={new Date().toISOString().split("T")[0]}
              onChange={e => setForm(f => ({ ...f, examDate: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/20"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Mode</label>
            <select
              value={form.mode}
              onChange={e => setForm(f => ({ ...f, mode: e.target.value as PlanForm["mode"] }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/20 bg-white"
            >
              <option value="balanced">Balanced (all topics)</option>
              <option value="weak">Weak areas first</option>
              <option value="exam">Exam-intensive</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Subject (optional)</label>
            <input
              type="text"
              placeholder="e.g. Physics, Maths"
              value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/20"
            />
          </div>
        </div>
        <Button
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          className="gap-2 text-white"
          style={{ background: TEAL }}
        >
          {generate.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Generating…</>
          ) : (
            <><Sparkles className="h-4 w-4" />Generate My Plan</>
          )}
        </Button>
      </motion.div>

      {/* Plan calendar */}
      <AnimatePresence>
        {plan && (
          <motion.div
            key="plan"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* Progress bar */}
            <div className="bg-card rounded-2xl border border-border shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">
                  Progress — {completedCount}/{totalTasks} tasks
                </span>
                <span className="text-xs text-muted-foreground">
                  {Math.round((completedCount / Math.max(totalTasks, 1)) * 100)}%
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: TEAL }}
                  animate={{ width: `${(completedCount / Math.max(totalTasks, 1)) * 100}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </div>

            {/* Week navigation */}
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-800">
                Week {weekOffset + 1} of {totalWeeks}
              </h3>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="outline" disabled={weekOffset === 0}
                  onClick={() => setWeekOffset(w => w - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" disabled={weekOffset >= totalWeeks - 1}
                  onClick={() => setWeekOffset(w => w + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {weekDays.map((day, di) => {
                const globalDi = weekOffset * 7 + di;
                const isExpanded = expandedDay === globalDi;
                const dayCompleted = day.tasks.every((_, ti) => completedTasks.has(`${globalDi}-${ti}`));
                const isToday = day.date === new Date().toISOString().split("T")[0];

                return (
                  <motion.div
                    key={day.day}
                    layout
                    onClick={() => setExpandedDay(isExpanded ? null : globalDi)}
                    className={`bg-card rounded-xl border cursor-pointer transition-all ${
                      isToday ? "border-teal-500 shadow-md" : dayCompleted ? "border-green-300 bg-green-50/30" : "border-gray-100 shadow-sm"
                    }`}
                    whileHover={{ y: -2 }}
                  >
                    <div className="p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                            {getDayName(day.date)} {formatDate(day.date)}
                          </p>
                          <p className="text-sm font-bold text-gray-900 mt-0.5 leading-tight">{day.theme}</p>
                        </div>
                        {dayCompleted && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
                        {isToday && !dayCompleted && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: TEAL }}>TODAY</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        {day.tasks.map((t, ti) => {
                          const Icon = TASK_ICONS[t.type] ?? BookOpen;
                          const isTaskDone = completedTasks.has(`${globalDi}-${ti}`);
                          return (
                            <button
                              key={ti}
                              onClick={e => { e.stopPropagation(); toggleTask(`${globalDi}-${ti}`); }}
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${
                                isTaskDone ? "opacity-50 line-through" : "hover:opacity-80"
                              }`}
                              style={{ background: `${TASK_COLORS[t.type]}14`, color: TASK_COLORS[t.type] }}
                            >
                              <Icon className="h-2.5 w-2.5" />
                              {t.type}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-gray-100 overflow-hidden"
                        >
                          <div className="p-3 space-y-2">
                            {day.tasks.map((t, ti) => {
                              const Icon = TASK_ICONS[t.type] ?? BookOpen;
                              const isTaskDone = completedTasks.has(`${globalDi}-${ti}`);
                              return (
                                <div
                                  key={ti}
                                  className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                                    isTaskDone ? "opacity-40" : "hover:bg-gray-50"
                                  }`}
                                  onClick={e => { e.stopPropagation(); toggleTask(`${globalDi}-${ti}`); }}
                                >
                                  {isTaskDone
                                    ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                                    : <span style={{ color: TASK_COLORS[t.type] }}><Icon className="h-4 w-4 shrink-0 mt-0.5" /></span>
                                  }
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-xs font-semibold text-gray-900 ${isTaskDone ? "line-through" : ""}`}>
                                      {t.title}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-[10px] text-muted-foreground">{t.subject}</span>
                                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                        <Clock className="h-2.5 w-2.5" />{t.duration_min}min
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>

            {/* Re-generate */}
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" onClick={() => generate.mutate()} className="gap-2 text-muted-foreground">
                <RefreshCw className="h-3.5 w-3.5" />
                Re-generate plan
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!plan && !generate.isPending && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: `${TEAL}12` }}>
            <Calendar className="h-8 w-8" style={{ color: TEAL }} />
          </div>
          <h3 className="font-bold text-gray-800 mb-2">Generate Your Revision Plan</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Aperti analyses your weak areas and builds a personalised daily schedule optimised for your exam.
          </p>
        </motion.div>
      )}
    </div>
  );
}
