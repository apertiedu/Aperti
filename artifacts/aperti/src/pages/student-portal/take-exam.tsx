import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Timer, AlertTriangle, Flag, ArrowLeft, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { MathRenderer } from "@/components/math-renderer";

const API = "/api";
const token = () => localStorage.getItem("aperti_token");

export default function TakeExam() {
  const [location, setLocation] = useLocation();
  const examId = parseInt(location.split("/").pop() || "0");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [violations, setViolations] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["exam", "take", examId],
    queryFn: async () => {
      const res = await fetch(`${API}/exams/student/${examId}/take`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      return res.json();
    },
  });

  useEffect(() => {
    if (data?.exam?.timeLimitMinutes) {
      setTimeLeft(data.exam.timeLimitMinutes * 60);
    }
  }, [data?.exam?.timeLimitMinutes]);

  const submitMutation = useMutation({
    mutationFn: (answersArray: any[]) =>
      fetch(`${API}/exams/student/${examId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ answers: answersArray }),
      }),
    onSuccess: () => setSubmitted(true),
  });

  // Anti‑cheat: detect tab switch
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && !submitted) {
        setViolations((v) => v + 1);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [submitted]);

  // Anti‑cheat: prevent copy/paste
  useEffect(() => {
    const blockCopy = (e: ClipboardEvent) => e.preventDefault();
    document.addEventListener("copy", blockCopy);
    document.addEventListener("paste", blockCopy);
    return () => {
      document.removeEventListener("copy", blockCopy);
      document.removeEventListener("paste", blockCopy);
    };
  }, []);

  // Timer
  useEffect(() => {
    if (timeLeft <= 0) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          // Auto‑submit when time runs out
          handleSubmit();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleAnswerChange = (questionId: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = () => {
    if (submitted) return;
    const answersArray = Object.entries(answers).map(([qId, text]) => ({
      questionId: parseInt(qId),
      answerText: text,
    }));
    submitMutation.mutate(answersArray);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="card-hover max-w-md text-center">
          <CardContent className="p-8">
            <Flag className="h-10 w-10 mx-auto text-primary mb-3" />
            <h2 className="text-xl font-bold mb-2">Exam Submitted!</h2>
            <p className="text-muted-foreground">Your answers have been recorded. Your teacher will review them soon.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return <div className="min-h-screen bg-background p-6"><Skeleton className="h-96 w-full rounded-xl" /></div>;
  }

  const questions = data?.questions || [];
  const current = questions[currentQuestion];

  return (
    <div className="min-h-screen bg-background page-transition">
      {/* Header — sticky on mobile */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/50 px-4 py-3 flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="text-base lg:text-xl font-bold truncate">{data?.exam?.name}</h1>
          <p className="text-xs text-muted-foreground">{currentQuestion + 1} of {questions.length}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {violations > 0 && (
            <Alert variant="destructive" className="py-1 px-2 hidden sm:flex">
              <AlertTriangle className="h-3.5 w-3.5" />
              <AlertDescription className="text-xs">{violations}w</AlertDescription>
            </Alert>
          )}
          <Badge className={`text-sm font-bold ${timeLeft < 60 ? "bg-destructive" : "bg-primary"}`}>
            <Timer className="h-3.5 w-3.5 mr-1" /> {formatTime(timeLeft)}
          </Badge>
        </div>
      </div>

      {/* Question progress bar */}
      <Progress value={((currentQuestion + 1) / questions.length) * 100} className="h-1 rounded-none" />

      {/* Question dots (mobile) */}
      <div className="lg:hidden flex gap-1.5 px-4 py-3 overflow-x-auto no-scrollbar">
        {questions.map((_: any, i: number) => (
          <button
            key={i}
            onClick={() => setCurrentQuestion(i)}
            className={`shrink-0 w-7 h-7 rounded-full text-[10px] font-bold transition-all min-h-[28px] ${
              i === currentQuestion
                ? "bg-primary text-primary-foreground scale-110"
                : answers[questions[i]?.id]
                ? "bg-primary/20 text-primary"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="max-w-3xl mx-auto px-4 pb-28 lg:pb-8 pt-4 lg:pt-6 space-y-5">
        <Card className="card-hover">
          <CardHeader className="pb-3">
            <CardTitle className="text-base lg:text-lg">
              Question {currentQuestion + 1} of {questions.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-base leading-relaxed"><MathRenderer content={current?.questionText ?? ""} /></div>
            <Textarea
              rows={6}
              placeholder="Type your answer here..."
              value={answers[current?.id] || ""}
              onChange={(e) => handleAnswerChange(current.id, e.target.value)}
              className="text-base resize-none"
            />
          </CardContent>
        </Card>

        {/* Desktop nav */}
        <div className="hidden lg:flex justify-between">
          <Button variant="outline" disabled={currentQuestion === 0} onClick={() => setCurrentQuestion(currentQuestion - 1)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Previous
          </Button>
          {currentQuestion < questions.length - 1 ? (
            <Button onClick={() => setCurrentQuestion(currentQuestion + 1)}>
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit}>
              <Flag className="h-4 w-4 mr-1" /> Submit Exam
            </Button>
          )}
        </div>
      </div>

      {/* Mobile fixed bottom nav */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur-md border-t border-border/60 p-3 safe-area-inset-bottom">
        <div className="flex gap-3 max-w-lg mx-auto">
          <Button
            variant="outline"
            disabled={currentQuestion === 0}
            onClick={() => setCurrentQuestion(currentQuestion - 1)}
            className="flex-1 h-12 text-sm font-semibold rounded-xl"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Prev
          </Button>
          {currentQuestion < questions.length - 1 ? (
            <Button
              onClick={() => setCurrentQuestion(currentQuestion + 1)}
              className="flex-1 h-12 text-sm font-semibold rounded-xl"
            >
              Next <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              className="flex-1 h-12 text-sm font-semibold rounded-xl bg-destructive hover:bg-destructive/90"
            >
              <Flag className="h-4 w-4 mr-1.5" /> Submit
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
