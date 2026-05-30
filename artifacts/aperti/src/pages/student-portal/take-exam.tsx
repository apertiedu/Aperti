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

const API = import.meta.env.VITE_API_URL || "";
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
    onSuccess: (data) => setTimeLeft((data.exam?.timeLimitMinutes || 60) * 60),
  });

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
    <div className="min-h-screen bg-background p-6 page-transition">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 max-w-3xl mx-auto">
        <h1 className="text-xl font-bold">{data?.exam?.name}</h1>
        <div className="flex items-center gap-3">
          {violations > 0 && (
            <Alert variant="destructive" className="py-1 px-3">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{violations} warning(s)</AlertDescription>
            </Alert>
          )}
          <Badge className={`text-lg ${timeLeft < 60 ? "bg-destructive" : "bg-primary"}`}>
            <Timer className="h-4 w-4 mr-1" /> {formatTime(timeLeft)}
          </Badge>
        </div>
      </div>

      <div className="max-w-3xl mx-auto space-y-6">
        <Progress value={((currentQuestion + 1) / questions.length) * 100} className="h-1" />

        <Card className="card-hover">
          <CardHeader>
            <CardTitle className="text-lg">
              Question {currentQuestion + 1} of {questions.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-base">{current?.questionText}</p>
            <Textarea
              rows={6}
              placeholder="Type your answer..."
              value={answers[current?.id] || ""}
              onChange={(e) => handleAnswerChange(current.id, e.target.value)}
            />
          </CardContent>
        </Card>

        <div className="flex justify-between">
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
    </div>
  );
}
