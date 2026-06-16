import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Sparkles, ChevronRight, Lightbulb, MessageSquare,
  BookOpen, Zap, RefreshCw, CheckCircle2, XCircle, Loader2,
  ArrowRight, Target, Star, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";

type DifficultyLevel = "easy" | "medium" | "hard";
type TeachingStyle = "visual" | "step-by-step" | "analogy" | "auto";

interface TutorResponse {
  student_id: number;
  concept: string;
  explanation: string;
  difficulty_level: DifficultyLevel;
  examples: string[];
  follow_up_questions: string[];
  reinforcement_needed: boolean;
  teaching_style_used: string;
  key_insight: string;
  ai_generated: boolean;
}

interface WeaknessData {
  weakTopics: { topic: string; pct: number }[];
  echoMemory: any;
}

interface AdaptiveResult {
  correct: boolean;
  feedback: string;
  next_difficulty: DifficultyLevel;
  next_style: string;
  next_question: string;
  hint?: string;
}

const DIFF_COLORS: Record<DifficultyLevel, string> = {
  easy: "bg-emerald-100 text-emerald-700 border-emerald-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  hard: "bg-rose-100 text-rose-700 border-rose-200",
};

const STYLE_LABELS: Record<string, string> = {
  "step-by-step": "Step-by-Step",
  visual: "Visual",
  analogy: "Analogy",
  auto: "Adaptive",
};

const SUBJECT_TOPICS: Record<string, string[]> = {
  "Physics": ["Forces & Newton's Laws", "Electricity & Circuits", "Waves & Sound", "Thermal Physics", "Motion & Kinematics", "Magnetism", "Quantum Physics", "Optics"],
  "Chemistry": ["Atomic Structure", "Chemical Bonding", "Acids & Bases", "Electrolysis", "Organic Chemistry", "Stoichiometry", "Rates of Reaction", "Thermochemistry"],
  "Mathematics": ["Algebra", "Calculus", "Trigonometry", "Statistics", "Geometry", "Vectors", "Complex Numbers", "Probability"],
  "Biology": ["Cell Biology", "Genetics", "Evolution", "Ecology", "Human Physiology", "Photosynthesis", "Respiration", "Reproduction"],
  "English": ["Comprehension", "Essay Writing", "Grammar", "Literary Analysis", "Vocabulary", "Summarising", "Critical Thinking"],
};

export default function AiPersonalTutorPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const studentId = user?.id;

  const [subject, setSubject] = useState("Physics");
  const [concept, setConcept] = useState("");
  const [customConcept, setCustomConcept] = useState("");
  const [style, setStyle] = useState<TeachingStyle>("auto");
  const [tutorResponse, setTutorResponse] = useState<TutorResponse | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const [studentAnswer, setStudentAnswer] = useState("");
  const [adaptiveResult, setAdaptiveResult] = useState<AdaptiveResult | null>(null);
  const [sessionHistory, setSessionHistory] = useState<{ concept: string; level: DifficultyLevel }[]>([]);

  const { data: weaknessData } = useQuery<WeaknessData>({
    queryKey: ["ai-tutor-weakness", studentId],
    queryFn: () => apiFetch(`/api/ai-tutor/student/${studentId}/weakness`).then(r => r.json()),
    enabled: !!studentId,
  });

  const explainMutation = useMutation({
    mutationFn: (payload: { student_id: number; concept: string; subject: string; preferred_style: TeachingStyle }) =>
      apiFetch("/api/ai-tutor/explain", { method: "POST", body: JSON.stringify(payload) }).then(r => r.json()),
    onSuccess: (data: TutorResponse) => {
      setTutorResponse(data);
      setActiveQuestion(null);
      setAdaptiveResult(null);
      setStudentAnswer("");
      setSessionHistory(prev => [...prev.slice(-4), { concept: data.concept, level: data.difficulty_level }]);
    },
    onError: () => toast({ title: "Tutor error", description: "Could not generate explanation. Please retry.", variant: "destructive" }),
  });

  const adaptiveMutation = useMutation({
    mutationFn: (payload: any) =>
      apiFetch("/api/ai-tutor/adaptive-followup", { method: "POST", body: JSON.stringify(payload) }).then(r => r.json()),
    onSuccess: (data: AdaptiveResult) => {
      setAdaptiveResult(data);
      setStudentAnswer("");
    },
    onError: () => toast({ title: "Error", description: "Could not evaluate answer. Please retry.", variant: "destructive" }),
  });

  const selectedConcept = concept === "__custom__" ? customConcept : concept;

  function handleExplain() {
    if (!studentId || !selectedConcept.trim()) return;
    explainMutation.mutate({ student_id: studentId, concept: selectedConcept.trim(), subject, preferred_style: style });
  }

  function handleSubmitAnswer() {
    if (!tutorResponse || !activeQuestion || !studentAnswer.trim()) return;
    adaptiveMutation.mutate({
      student_id: studentId,
      concept: tutorResponse.concept,
      student_answer: studentAnswer.trim(),
      original_question: activeQuestion,
      current_difficulty: tutorResponse.difficulty_level,
    });
  }

  function handleNextQuestion() {
    if (!adaptiveResult || !tutorResponse) return;
    setActiveQuestion(adaptiveResult.next_question);
    setAdaptiveResult(null);
    setStudentAnswer("");
  }

  const topicList = SUBJECT_TOPICS[subject] ?? [];
  const weakTopics = weaknessData?.weakTopics?.slice(0, 5) ?? [];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">AI Personal Tutor</h1>
            <p className="text-sm text-muted-foreground">Adaptive teaching engine — explanations tailored to you</p>
          </div>
          <Badge className="ml-auto bg-primary/10 text-primary border-primary/20">Adaptive Engine</Badge>
        </div>
      </motion.div>

      {weakTopics.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="rounded-xl bg-amber-50 border border-amber-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-800">Suggested focus areas</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {weakTopics.map(t => (
              <button key={t.topic}
                onClick={() => { setConcept("__custom__"); setCustomConcept(t.topic); }}
                className="text-xs px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-200 transition-colors font-medium">
                {t.topic} — {t.pct}%
              </button>
            ))}
          </div>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="rounded-xl bg-card border border-border p-5 space-y-4">
        <h2 className="font-semibold text-foreground">Configure your session</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Subject</label>
            <select value={subject} onChange={e => { setSubject(e.target.value); setConcept(""); }}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              {Object.keys(SUBJECT_TOPICS).map(s => <option key={s}>{s}</option>)}
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Teaching style</label>
            <div className="flex gap-2">
              {(["auto", "step-by-step", "visual", "analogy"] as TeachingStyle[]).map(s => (
                <button key={s} onClick={() => setStyle(s)}
                  className={`flex-1 text-xs py-2 rounded-lg border font-medium transition-colors ${style === s ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:border-primary/50"}`}>
                  {STYLE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Concept to learn</label>
          <select value={concept} onChange={e => setConcept(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 mb-2">
            <option value="">Select a topic…</option>
            {topicList.map(t => <option key={t} value={t}>{t}</option>)}
            <option value="__custom__">Enter custom concept…</option>
          </select>
          {concept === "__custom__" && (
            <input value={customConcept} onChange={e => setCustomConcept(e.target.value)}
              placeholder="Type your concept or question…"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          )}
        </div>

        <Button onClick={handleExplain}
          disabled={explainMutation.isPending || !selectedConcept.trim()}
          className="w-full gap-2">
          {explainMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating personalized explanation…</> : <><Sparkles className="h-4 w-4" /> Teach me this</>}
        </Button>
      </motion.div>

      <AnimatePresence>
        {tutorResponse && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="space-y-4">
            <div className="rounded-xl bg-card border border-border p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-lg text-foreground">{tutorResponse.concept}</h2>
                <div className="flex items-center gap-2">
                  <Badge className={`text-xs border ${DIFF_COLORS[tutorResponse.difficulty_level]}`}>
                    {tutorResponse.difficulty_level}
                  </Badge>
                  <Badge variant="outline" className="text-xs">{tutorResponse.teaching_style_used}</Badge>
                  {tutorResponse.ai_generated && <Badge className="text-xs bg-violet-100 text-violet-700 border-violet-200">AI</Badge>}
                </div>
              </div>

              <div className="rounded-lg bg-muted/40 p-4 text-sm text-foreground leading-relaxed border border-border/50">
                {tutorResponse.explanation}
              </div>

              {tutorResponse.key_insight && (
                <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/20 p-3">
                  <Star className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm text-primary font-medium">{tutorResponse.key_insight}</p>
                </div>
              )}

              {tutorResponse.examples.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                    <Lightbulb className="h-4 w-4 text-amber-500" /> Examples
                  </h3>
                  <div className="space-y-2">
                    {tutorResponse.examples.map((ex, i) => (
                      <div key={i} className="text-sm bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-amber-900">
                        {i + 1}. {ex}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tutorResponse.reinforcement_needed && (
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  This topic needs reinforcement — answering the questions below will help consolidate your understanding.
                </div>
              )}
            </div>

            {tutorResponse.follow_up_questions.length > 0 && (
              <div className="rounded-xl bg-card border border-border p-5 space-y-3">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" /> Test your understanding
                </h3>
                <div className="space-y-2">
                  {tutorResponse.follow_up_questions.map((q, i) => (
                    <button key={i} onClick={() => { setActiveQuestion(q); setAdaptiveResult(null); setStudentAnswer(""); }}
                      className={`w-full text-left text-sm rounded-lg border px-4 py-3 transition-all ${activeQuestion === q ? "bg-primary/5 border-primary/40 text-foreground" : "bg-muted/30 border-border hover:border-primary/30 text-muted-foreground hover:text-foreground"}`}>
                      <span className="font-medium text-primary mr-2">Q{i + 1}.</span> {q}
                    </button>
                  ))}
                </div>

                <AnimatePresence>
                  {activeQuestion && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden">
                      <div className="pt-3 space-y-3">
                        <div className="text-sm font-medium text-foreground bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                          {activeQuestion}
                        </div>
                        <textarea value={studentAnswer} onChange={e => setStudentAnswer(e.target.value)}
                          placeholder="Type your answer here…"
                          rows={3}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                        <Button onClick={handleSubmitAnswer} disabled={adaptiveMutation.isPending || !studentAnswer.trim()} size="sm" className="gap-2">
                          {adaptiveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                          Submit answer
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {adaptiveResult && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className={`rounded-xl border p-4 space-y-3 ${adaptiveResult.correct ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"}`}>
                      <div className="flex items-center gap-2">
                        {adaptiveResult.correct
                          ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                          : <XCircle className="h-5 w-5 text-rose-500" />}
                        <span className={`font-semibold text-sm ${adaptiveResult.correct ? "text-emerald-700" : "text-rose-700"}`}>
                          {adaptiveResult.correct ? "Correct!" : "Not quite right"}
                        </span>
                        <Badge className={`ml-auto text-xs border ${DIFF_COLORS[adaptiveResult.next_difficulty]}`}>
                          Next: {adaptiveResult.next_difficulty}
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground">{adaptiveResult.feedback}</p>
                      {adaptiveResult.hint && !adaptiveResult.correct && (
                        <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          <Lightbulb className="h-4 w-4 shrink-0 mt-0.5" /> {adaptiveResult.hint}
                        </div>
                      )}
                      <Button onClick={handleNextQuestion} size="sm" variant="outline" className="gap-2">
                        <ChevronRight className="h-4 w-4" /> Next question ({adaptiveResult.next_style})
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" size="sm" onClick={handleExplain} disabled={explainMutation.isPending} className="gap-2">
                <RefreshCw className="h-4 w-4" /> Different explanation
              </Button>
              <Button variant="outline" size="sm"
                onClick={() => { setConcept(""); setCustomConcept(""); setTutorResponse(null); setAdaptiveResult(null); }}
                className="gap-2">
                <BookOpen className="h-4 w-4" /> New concept
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {sessionHistory.length > 1 && (
        <div className="rounded-xl bg-muted/30 border border-border p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Session history</h3>
          <div className="flex flex-wrap gap-2">
            {sessionHistory.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs bg-card border border-border rounded-full px-3 py-1">
                <Zap className="h-3 w-3 text-primary" />
                <span className="font-medium">{s.concept}</span>
                <Badge className={`text-[10px] border ${DIFF_COLORS[s.level]}`}>{s.level}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
