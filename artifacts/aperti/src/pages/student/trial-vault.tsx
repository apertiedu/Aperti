import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { FileText, Zap, Clock, Target, ChevronRight, Sparkles, BarChart3 } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL || "";
const token = () => localStorage.getItem("aperti_token");

const MOCK_TRIALS = [
  { id: "t1", subject: "Physics 0625", topic: "Waves & Optics", difficulty: "Hard", questions: 30, duration: 45, score: 72, date: "2026-05-28", status: "completed" },
  { id: "t2", subject: "Math 0580", topic: "Algebra & Functions", difficulty: "Medium", questions: 25, duration: 40, score: 85, date: "2026-05-25", status: "completed" },
  { id: "t3", subject: "Chemistry 0620", topic: "Organic Chemistry", difficulty: "Hard", questions: 30, duration: 45, score: null, date: null, status: "ready" },
];

const SUBJECTS = ["Physics 0625", "Math 0580", "Chemistry 0620", "Biology 0610", "English Language"];
const DIFFICULTIES = ["Easy", "Medium", "Hard", "Mixed"];

const diffColor = {
  Easy: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400",
  Medium: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400",
  Hard: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400",
  Mixed: "bg-primary/10 text-primary border-primary/20",
};

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 220, damping: 22 } } };

export default function TrialVault() {
  const [subject, setSubject] = useState("Physics 0625");
  const [difficulty, setDifficulty] = useState("Medium");
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 1800));
    setGenerating(false);
    toast({ title: "Trial exam generated!", description: `${subject} · ${difficulty} · 30 questions` });
  };

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">TrialVault<span className="text-primary">™</span></h1>
        </div>
        <p className="text-muted-foreground">Intelligently generated mock exams with predicted difficulty curves.</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Generator */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="card-hover">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                Generate New Trial
              </CardTitle>
              <CardDescription>Calibrated to your Echo™ memory profile</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Subject</label>
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Difficulty</label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIFFICULTIES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Questions</span>
                  <span className="font-medium">30</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-medium">45 min</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Predicted score</span>
                  <span className="font-medium text-primary">~68%</span>
                </div>
              </div>
              <Button className="w-full gap-2" onClick={handleGenerate} disabled={generating}>
                {generating ? (
                  <>
                    <div className="w-3 h-3 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Generate Exam
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Past trials */}
        <motion.div variants={container} initial="hidden" animate="show" className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Trial History
          </h2>
          {MOCK_TRIALS.map((trial) => (
            <motion.div key={trial.id} variants={item}>
              <Card className="card-hover">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="font-semibold text-sm">{trial.subject}</p>
                      <p className="text-xs text-muted-foreground">{trial.topic}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${diffColor[trial.difficulty as keyof typeof diffColor]}`}
                      >
                        {trial.difficulty}
                      </Badge>
                      <Badge variant={trial.status === "completed" ? "secondary" : "default"} className="text-[10px]">
                        {trial.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                    <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{trial.questions} Qs</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{trial.duration} min</span>
                    {trial.date && <span>{new Date(trial.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
                  </div>
                  {trial.score !== null && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Score</span>
                        <span className={`font-semibold ${trial.score >= 70 ? "text-primary" : "text-destructive"}`}>{trial.score}%</span>
                      </div>
                      <Progress value={trial.score} className="h-1.5" />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" variant={trial.status === "ready" ? "default" : "outline"} className="h-7 text-xs gap-1">
                      {trial.status === "ready" ? (
                        <><Zap className="h-3 w-3" /> Start Now</>
                      ) : (
                        <><Target className="h-3 w-3" /> Review</>
                      )}
                    </Button>
                    {trial.status === "completed" && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
                        Retake <ChevronRight className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
