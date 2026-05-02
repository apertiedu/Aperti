import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Wand2, CheckCircle2, BookMarked, ChevronRight, BarChart2,
  AlertCircle, Layers, Target, Zap, Trophy, RotateCcw, ClipboardList
} from "lucide-react";
import { useLocation } from "wouter";

type Subject = { id: number; name: string };
type TopicRow = { topic: string; question_count: number };
type GenerateResult = {
  exam: { id: number; name: string; total_marks: string };
  questionCount: number; totalMarks: number;
  topics: string[];
  difficultyBreakdown: { easy: number; medium: number; hard: number };
};

const MODES = [
  { value: "easy",     label: "Easy",           icon: "🟢", desc: "Lower difficulty questions" },
  { value: "medium",   label: "Medium",         icon: "🟡", desc: "Mixed average difficulty" },
  { value: "hard",     label: "Hard",           icon: "🔴", desc: "Challenging questions only" },
  { value: "mixed",    label: "Mixed",          icon: "🌈", desc: "All difficulties balanced" },
  { value: "predicted", label: "Predicted",    icon: "🎯", desc: "Most-used past paper questions" },
  { value: "topic-specific", label: "Topic Drill", icon: "🔬", desc: "Focus on selected topics" },
];

export default function ExamGeneratorPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [step, setStep] = useState<"config" | "generating" | "result">("config");
  const [result, setResult] = useState<GenerateResult | null>(null);

  const [form, setForm] = useState({
    name: "",
    subjectId: "",
    mode: "mixed",
    questionCount: 10,
    examDate: "",
    selectedTopics: [] as string[],
  });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    fetch("/api/subjects", { credentials: "include" })
      .then(r => r.ok ? r.json() : []).then(setSubjects);
  }, []);

  useEffect(() => {
    if (!form.subjectId) { setTopics([]); return; }
    const params = new URLSearchParams({ subjectId: form.subjectId });
    fetch(`/api/exams/generate/topics?${params}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : []).then(setTopics);
  }, [form.subjectId]);

  const toggleTopic = (topic: string) => {
    set("selectedTopics", form.selectedTopics.includes(topic)
      ? form.selectedTopics.filter(t => t !== topic)
      : [...form.selectedTopics, topic]);
  };

  const handleGenerate = async () => {
    if (!form.name.trim()) { toast({ title: "Enter an exam name", variant: "destructive" }); return; }
    setStep("generating");
    try {
      const res = await fetch("/api/exams/generate", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          subjectId: form.subjectId ? parseInt(form.subjectId, 10) : undefined,
          mode: form.mode,
          questionCount: form.questionCount,
          examDate: form.examDate || undefined,
          topics: form.selectedTopics.length > 0 ? form.selectedTopics : undefined,
        }),
      });
      if (!res.ok) {
        const e = await res.json();
        toast({ title: "Generation failed", description: e.message, variant: "destructive" });
        setStep("config"); return;
      }
      const data = await res.json();
      setResult(data);
      setStep("result");
    } catch {
      toast({ title: "Error generating exam", variant: "destructive" });
      setStep("config");
    }
  };

  const selectedMode = MODES.find(m => m.value === form.mode);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
          <Wand2 className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">AI Exam Generator</h1>
          <p className="text-xs text-muted-foreground">Generate exams automatically from your question bank</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === "config" && (
          <motion.div key="config" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            className="space-y-5">

            {/* Exam Name + Subject */}
            <Card className="border border-border/50">
              <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Exam Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Exam Name *</Label>
                  <Input value={form.name} onChange={e => set("name", e.target.value)}
                    placeholder="e.g. Physics Mock Exam 1, Topic Test — Waves" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Subject</Label>
                    <Select value={form.subjectId} onValueChange={v => set("subjectId", v)}>
                      <SelectTrigger><SelectValue placeholder="Any subject" /></SelectTrigger>
                      <SelectContent>
                        {subjects.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Exam Date</Label>
                    <Input type="date" value={form.examDate} onChange={e => set("examDate", e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Mode picker */}
            <Card className="border border-border/50">
              <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Generation Mode</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {MODES.map(mode => (
                    <button key={mode.value} onClick={() => set("mode", mode.value)}
                      className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all ${
                        form.mode === mode.value
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-primary/30 hover:bg-muted/30"
                      }`}>
                      <span className="text-lg leading-none">{mode.icon}</span>
                      <span className={`text-sm font-semibold ${form.mode === mode.value ? "text-primary" : "text-foreground"}`}>{mode.label}</span>
                      <span className="text-xs text-muted-foreground leading-tight">{mode.desc}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Question count */}
            <Card className="border border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Question Count</CardTitle>
                  <span className="text-2xl font-bold text-primary">{form.questionCount}</span>
                </div>
              </CardHeader>
              <CardContent>
                <Slider value={[form.questionCount]} onValueChange={([v]) => set("questionCount", v)}
                  min={1} max={50} step={1} className="w-full" />
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>1 question</span><span>50 questions</span>
                </div>
              </CardContent>
            </Card>

            {/* Topic filter (if subject selected and topics exist) */}
            {topics.length > 0 && (
              <Card className="border border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Filter by Topics</CardTitle>
                    {form.selectedTopics.length > 0 && (
                      <button onClick={() => set("selectedTopics", [])} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Clear</button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-3">Leave empty for all topics, or select specific ones</p>
                  <div className="flex flex-wrap gap-2">
                    {topics.map(t => (
                      <button key={t.topic} onClick={() => toggleTopic(t.topic)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                          form.selectedTopics.includes(t.topic)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card border-border text-muted-foreground hover:border-primary/40"
                        }`}>
                        {t.topic}
                        <span className={`text-[10px] ${form.selectedTopics.includes(t.topic) ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                          ({t.question_count})
                        </span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Summary + Generate */}
            <Card className="border border-primary/20 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-foreground">Ready to generate</p>
                  <p className="text-sm text-muted-foreground">
                    {form.questionCount} questions · {selectedMode?.label} mode
                    {form.selectedTopics.length > 0 ? ` · ${form.selectedTopics.length} topic${form.selectedTopics.length > 1 ? "s" : ""}` : ""}
                  </p>
                </div>
                <Button onClick={handleGenerate} disabled={!form.name.trim()}
                  className="gap-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-sm shrink-0">
                  <Wand2 className="h-4 w-4" />Generate Exam
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === "generating" && (
          <motion.div key="generating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-24 gap-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Wand2 className="h-10 w-10 text-white animate-pulse" />
              </div>
              <div className="absolute -inset-2 rounded-2xl border-2 border-violet-300 animate-ping opacity-30" />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">Generating your exam...</p>
              <p className="text-sm text-muted-foreground mt-1">Selecting questions from your bank</p>
            </div>
          </motion.div>
        )}

        {step === "result" && result && (
          <motion.div key="result" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            className="space-y-5">
            {/* Success banner */}
            <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center shadow-sm flex-shrink-0">
                  <CheckCircle2 className="h-7 w-7 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-emerald-900 dark:text-emerald-300 text-lg">Exam Generated!</p>
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">{result.exam.name}</p>
                </div>
              </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="border border-border/50 text-center">
                <CardContent className="p-4">
                  <p className="text-3xl font-bold text-primary">{result.questionCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">Questions</p>
                </CardContent>
              </Card>
              <Card className="border border-border/50 text-center">
                <CardContent className="p-4">
                  <p className="text-3xl font-bold text-amber-600">{result.totalMarks}</p>
                  <p className="text-xs text-muted-foreground mt-1">Total Marks</p>
                </CardContent>
              </Card>
              <Card className="border border-border/50 text-center">
                <CardContent className="p-4">
                  <p className="text-3xl font-bold text-emerald-600">{result.topics.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Topics</p>
                </CardContent>
              </Card>
            </div>

            {/* Difficulty breakdown */}
            <Card className="border border-border/50">
              <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Difficulty Breakdown</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Easy", value: result.difficultyBreakdown.easy, color: "bg-emerald-500", text: "text-emerald-600" },
                  { label: "Medium", value: result.difficultyBreakdown.medium, color: "bg-amber-500", text: "text-amber-600" },
                  { label: "Hard", value: result.difficultyBreakdown.hard, color: "bg-red-500", text: "text-red-600" },
                ].map(d => d.value > 0 && (
                  <div key={d.label} className="flex items-center gap-3">
                    <span className={`text-xs font-medium w-14 ${d.text}`}>{d.label}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div className={`h-full rounded-full ${d.color}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${(d.value / result.questionCount) * 100}%` }}
                        transition={{ delay: 0.2, duration: 0.6 }} />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right">{d.value}q</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Topics used */}
            {result.topics.length > 0 && (
              <Card className="border border-border/50">
                <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Topics Included</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {result.topics.map(t => (
                      <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button onClick={() => navigate("/exams")} className="flex-1 gap-2 bg-gradient-to-r from-violet-500 to-purple-600">
                <ClipboardList className="h-4 w-4" />View in Exams
              </Button>
              <Button variant="outline" onClick={() => { setStep("config"); setResult(null); }} className="gap-2">
                <RotateCcw className="h-4 w-4" />Generate Another
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
