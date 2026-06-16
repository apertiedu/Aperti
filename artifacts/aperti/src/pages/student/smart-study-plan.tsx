import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, Sparkles, BookOpen, Brain, Target, Clock,
  ChevronLeft, ChevronRight, Loader2, AlertCircle,
  CheckCircle2, RefreshCw, RotateCcw, Lightbulb, GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";

interface DaySchedule {
  date: string;
  topics: string[];
  focus_type: "learning" | "practice" | "revision";
  estimated_hours: number;
  notes?: string;
}

interface StudyPlanResponse {
  student_id: number;
  exam_date: string;
  exam_name: string;
  total_days: number;
  daily_schedule: DaySchedule[];
  revision_phase: { start_date: string; end_date: string; focus: string };
  summary?: { total_learning_days: number; total_revision_days: number; weak_topic_sessions: number; plan_rationale: string };
  ai_generated: boolean;
}

interface ExamOption {
  id: number;
  name: string;
  exam_date: string;
  subject_name: string;
}

const FOCUS_CONFIG = {
  learning: { label: "Learning", color: "bg-blue-100 text-blue-700 border-blue-200", icon: BookOpen, bar: "bg-blue-500" },
  practice: { label: "Practice", color: "bg-violet-100 text-violet-700 border-violet-200", icon: Target, bar: "bg-violet-500" },
  revision: { label: "Revision", color: "bg-teal-100 text-teal-700 border-teal-200", icon: GraduationCap, bar: "bg-teal-500" },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function getDayName(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", { weekday: "long" });
}

function isToday(dateStr: string): boolean {
  return new Date(dateStr).toDateString() === new Date().toDateString();
}

function isPast(dateStr: string): boolean {
  const d = new Date(dateStr);
  d.setHours(23, 59, 59);
  return d < new Date();
}

export default function SmartStudyPlanPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const studentId = user?.id;

  const [examDate, setExamDate] = useState("");
  const [examName, setExamName] = useState("");
  const [hoursPerDay, setHoursPerDay] = useState(3);
  const [plan, setPlan] = useState<StudyPlanResponse | null>(null);
  const [visibleWeek, setVisibleWeek] = useState(0);

  const { data: examsData } = useQuery<{ exams: ExamOption[] }>({
    queryKey: ["study-plan-exams", studentId],
    queryFn: () => apiFetch(`/api/study-plan/exam-dates?student_id=${studentId}`).then(r => r.json()),
    enabled: !!studentId,
  });

  const generateMutation = useMutation({
    mutationFn: (payload: { student_id: number; exam_date: string; exam_name?: string; hours_per_day?: number }) =>
      apiFetch("/api/study-plan/generate", { method: "POST", body: JSON.stringify(payload) }).then(r => r.json()),
    onSuccess: (data: StudyPlanResponse) => {
      if (data.error) {
        toast({ title: "Error", description: data.error as string, variant: "destructive" });
        return;
      }
      setPlan(data);
      setVisibleWeek(0);
      toast({ title: "Study plan generated", description: `${data.daily_schedule.length} days scheduled until your exam.` });
    },
    onError: () => toast({ title: "Error", description: "Could not generate study plan. Please retry.", variant: "destructive" }),
  });

  const regenMutation = useMutation({
    mutationFn: () => {
      const today = new Date().toISOString().split("T")[0];
      return apiFetch("/api/study-plan/regenerate", {
        method: "POST",
        body: JSON.stringify({ student_id: studentId, exam_date: plan!.exam_date, completed_up_to: today }),
      }).then(r => r.json());
    },
    onSuccess: (data: any) => {
      if (plan) {
        const today = new Date().toISOString().split("T")[0];
        const pastDays = plan.daily_schedule.filter(d => d.date < today);
        setPlan({ ...plan, daily_schedule: [...pastDays, ...data.daily_schedule] });
        toast({ title: "Plan updated", description: "Remaining schedule regenerated based on your latest progress." });
      }
    },
    onError: () => toast({ title: "Error", description: "Regeneration failed. Please retry.", variant: "destructive" }),
  });

  function handleGenerate() {
    if (!studentId || !examDate) return;
    generateMutation.mutate({ student_id: studentId, exam_date: examDate, exam_name: examName || undefined, hours_per_day: hoursPerDay });
  }

  function handleExamSelect(exam: ExamOption) {
    setExamDate(exam.exam_date);
    setExamName(exam.name);
  }

  const schedule = plan?.daily_schedule ?? [];
  const weeks = [];
  for (let i = 0; i < schedule.length; i += 7) weeks.push(schedule.slice(i, i + 7));
  const currentWeek = weeks[visibleWeek] ?? [];

  const todayIdx = schedule.findIndex(d => isToday(d.date));
  const totalHours = schedule.reduce((s, d) => s + (d.estimated_hours ?? 0), 0);
  const learningDays = schedule.filter(d => d.focus_type === "learning").length;
  const revisionDays = schedule.filter(d => d.focus_type === "revision").length;
  const daysUntilExam = plan ? Math.max(0, Math.round((new Date(plan.exam_date).getTime() - Date.now()) / 86_400_000)) : 0;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">Smart Study Plan</h1>
            <p className="text-sm text-muted-foreground">Exam-aware daily schedule — built around your weaknesses</p>
          </div>
          <Badge className="ml-auto bg-primary/10 text-primary border-primary/20">Exam-Aware AI</Badge>
        </div>
      </motion.div>

      {!plan && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-xl bg-card border border-border p-5 space-y-5">
          <h2 className="font-semibold text-foreground">Configure your study plan</h2>

          {examsData?.exams && examsData.exams.length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">Quick select from your exams</label>
              <div className="flex flex-wrap gap-2">
                {examsData.exams.map(e => (
                  <button key={e.id} onClick={() => handleExamSelect(e)}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${examDate === e.exam_date && examName === e.name ? "bg-primary text-primary-foreground border-primary" : "bg-muted/30 border-border hover:border-primary/40"}`}>
                    {e.name} — {new Date(e.exam_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Exam name</label>
              <input value={examName} onChange={e => setExamName(e.target.value)}
                placeholder="e.g. IGCSE Physics Paper 4"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Exam date <span className="text-destructive">*</span>
              </label>
              <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)}
                min={new Date(Date.now() + 86_400_000).toISOString().split("T")[0]}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
              Study hours per day: <span className="text-primary font-bold">{hoursPerDay}h</span>
              <span className="text-muted-foreground ml-2">(max 5h recommended)</span>
            </label>
            <input type="range" min={1} max={5} value={hoursPerDay} onChange={e => setHoursPerDay(parseInt(e.target.value))}
              className="w-full accent-primary" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>1h</span><span>2h</span><span>3h</span><span>4h</span><span>5h</span>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg bg-blue-50 border border-blue-100 p-3">
            <Lightbulb className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-800">
              The AI will automatically reserve the last 20–30% of your time for revision only, prioritise your weak topics, and never schedule anything after your exam date.
            </p>
          </div>

          <Button onClick={handleGenerate} disabled={generateMutation.isPending || !examDate}
            className="w-full gap-2">
            {generateMutation.isPending
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Building your personalised plan…</>
              : <><Sparkles className="h-4 w-4" /> Generate my study plan</>}
          </Button>
        </motion.div>
      )}

      <AnimatePresence>
        {plan && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Days until exam", value: daysUntilExam, icon: Calendar, color: "text-primary" },
                { label: "Total study hours", value: `${totalHours}h`, icon: Clock, color: "text-violet-600" },
                { label: "Learning days", value: learningDays, icon: BookOpen, color: "text-blue-600" },
                { label: "Revision days", value: revisionDays, icon: Brain, color: "text-teal-600" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="rounded-xl bg-card border border-border p-4 text-center">
                  <Icon className={`h-5 w-5 ${color} mx-auto mb-1`} />
                  <div className="text-xl font-extrabold text-foreground">{value}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>

            {plan.summary?.plan_rationale && (
              <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/20 p-3">
                <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-primary">{plan.summary.plan_rationale}</p>
              </div>
            )}

            <div className="rounded-xl bg-card border border-border p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-bold text-foreground">{plan.exam_name}</h2>
                  <p className="text-sm text-muted-foreground">
                    Exam: {formatDate(plan.exam_date)} · Week {visibleWeek + 1} of {Math.max(1, weeks.length)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => setVisibleWeek(v => Math.max(0, v - 1))} disabled={visibleWeek === 0}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => setVisibleWeek(v => Math.min(weeks.length - 1, v + 1))} disabled={visibleWeek >= weeks.length - 1}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {currentWeek.map((day, i) => {
                  const focus = FOCUS_CONFIG[day.focus_type];
                  const FocusIcon = focus.icon;
                  const past = isPast(day.date);
                  const today = isToday(day.date);
                  return (
                    <motion.div key={day.date} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                      className={`rounded-lg border p-3 ${today ? "border-primary bg-primary/5 ring-1 ring-primary/20" : past ? "border-border bg-muted/20 opacity-60" : "border-border bg-card"}`}>
                      <div className="flex items-center gap-3">
                        <div className="text-center w-12 shrink-0">
                          <div className="text-xs text-muted-foreground">{new Date(day.date).toLocaleDateString("en-GB", { weekday: "short" })}</div>
                          <div className="text-base font-bold text-foreground">{new Date(day.date).getDate()}</div>
                        </div>
                        <div className={`w-1 h-10 rounded-full shrink-0 ${focus.bar}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <FocusIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <div className="flex flex-wrap gap-1">
                              {day.topics.map((t, ti) => (
                                <span key={ti} className="text-xs font-semibold text-foreground">{t}{ti < day.topics.length - 1 ? " · " : ""}</span>
                              ))}
                            </div>
                          </div>
                          {day.notes && <p className="text-xs text-muted-foreground truncate">{day.notes}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className={`text-xs border ${focus.color}`}>{focus.label}</Badge>
                          <span className="text-xs text-muted-foreground">{day.estimated_hours}h</span>
                          {past && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                          {today && <span className="text-xs font-bold text-primary">Today</span>}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl bg-teal-50 border border-teal-200 p-4">
              <div className="flex items-center gap-2 mb-1">
                <GraduationCap className="h-4 w-4 text-teal-700" />
                <span className="text-sm font-semibold text-teal-800">Revision phase</span>
              </div>
              <p className="text-sm text-teal-700">
                {formatDate(plan.revision_phase.start_date)} — {formatDate(plan.revision_phase.end_date)} · Full review of all topics before exam day
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" size="sm" onClick={() => { setPlan(null); setVisibleWeek(0); }} className="gap-2">
                <RotateCcw className="h-4 w-4" /> New plan
              </Button>
              <Button variant="outline" size="sm" onClick={() => regenMutation.mutate()} disabled={regenMutation.isPending} className="gap-2">
                {regenMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Regenerate remaining
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
