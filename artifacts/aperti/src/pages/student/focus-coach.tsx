import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, Zap, Brain, ArrowRight, BookOpen, CheckCircle2, AlertCircle } from "lucide-react";
import { Link } from "wouter";

const API = import.meta.env.VITE_API_URL || "";

async function fetchJSON(url: string) {
  const token = localStorage.getItem("aperti_token");
  const res = await fetch(`${API}${url}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const MOCK_WEAK_TOPICS = [
  { id: 1, topic: "Electromagnetic Induction", subject: "Physics 0625", mastery: 32, priority: "high" },
  { id: 2, topic: "Integration by Parts", subject: "Math 0580", mastery: 45, priority: "high" },
  { id: 3, topic: "Cell Division (Meiosis)", subject: "Biology 0610", mastery: 58, priority: "medium" },
  { id: 4, topic: "Organic Chemistry — Esters", subject: "Chemistry 0620", mastery: 61, priority: "medium" },
  { id: 5, topic: "Probability Trees", subject: "Math 0580", mastery: 72, priority: "low" },
];

const DAILY_GOALS = [
  { id: "g1", label: "Complete 20 flashcards", points: 50 },
  { id: "g2", label: "Practice 3 past paper questions", points: 80 },
  { id: "g3", label: "Review 1 weak topic with The Mentor™", points: 100 },
  { id: "g4", label: "Score ≥ 70% on a mini quiz", points: 120 },
];

const priorityColor = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
  low: "bg-primary/10 text-primary border-primary/20",
};

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 220, damping: 22 } } };

export default function FocusCoach() {
  const [checkedGoals, setCheckedGoals] = useState<Set<string>>(new Set());

  const toggleGoal = (id: string) => {
    setCheckedGoals((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalPoints = DAILY_GOALS.filter((g) => checkedGoals.has(g.id)).reduce((s, g) => s + g.points, 0);
  const maxPoints = DAILY_GOALS.reduce((s, g) => s + g.points, 0);

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Target className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">FocusCoach<span className="text-primary">™</span></h1>
        </div>
        <p className="text-muted-foreground">Your personalised weak-topic tracker and daily goal setter.</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weak topics */}
        <motion.div variants={container} initial="hidden" animate="show" className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Weak Topics
            <Badge variant="secondary" className="ml-auto text-xs">from Echo™ memory</Badge>
          </h2>
          {MOCK_WEAK_TOPICS.map((topic) => (
            <motion.div key={topic.id} variants={item}>
              <Card className="card-hover">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="font-semibold text-sm">{topic.topic}</p>
                      <p className="text-xs text-muted-foreground">{topic.subject}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] shrink-0 ${priorityColor[topic.priority as keyof typeof priorityColor]}`}
                    >
                      {topic.priority} priority
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress value={topic.mastery} className="flex-1 h-1.5" />
                    <span className="text-xs font-medium text-muted-foreground w-10 text-right">{topic.mastery}%</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Link href="/mentor">
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                        <Brain className="h-3 w-3" /> Ask Mentor
                      </Button>
                    </Link>
                    <Link href="/flashcards">
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                        <BookOpen className="h-3 w-3" /> Flashcards
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Daily goals */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="space-y-4">
          <Card className="card-hover">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="h-4 w-4 text-primary" />
                Daily Goals
              </CardTitle>
              <CardDescription>
                {checkedGoals.size} of {DAILY_GOALS.length} complete
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="mb-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>XP earned today</span>
                  <span className="font-semibold text-primary">{totalPoints} / {maxPoints}</span>
                </div>
                <Progress value={(totalPoints / maxPoints) * 100} className="h-2" />
              </div>
              {DAILY_GOALS.map((goal) => (
                <div
                  key={goal.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                    checkedGoals.has(goal.id)
                      ? "bg-primary/5 border-primary/20"
                      : "border-border hover:border-primary/20"
                  }`}
                  onClick={() => toggleGoal(goal.id)}
                >
                  <Checkbox
                    checked={checkedGoals.has(goal.id)}
                    onCheckedChange={() => toggleGoal(goal.id)}
                    className="shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium ${checkedGoals.has(goal.id) ? "line-through text-muted-foreground" : ""}`}>
                      {goal.label}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-[9px] shrink-0">+{goal.points} XP</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {checkedGoals.size === DAILY_GOALS.length && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 rounded-xl bg-primary/10 border border-primary/20 text-center"
            >
              <CheckCircle2 className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="font-bold text-sm text-primary">All goals complete!</p>
              <p className="text-xs text-muted-foreground">+{maxPoints} XP earned today 🎉</p>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
