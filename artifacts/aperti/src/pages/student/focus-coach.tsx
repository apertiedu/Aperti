import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Target, Zap, Brain, ArrowRight, BookOpen, CheckCircle2, AlertCircle, Plus, BarChart3, Clock } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar,
} from "recharts";


async function fetchJSON(url: string) {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function postJSON(url: string, body: object) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const priorityColor: Record<string, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
  low: "bg-primary/10 text-primary border-primary/20",
};

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 220, damping: 22 } } };

export default function FocusCoach() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: goalsData, isLoading: goalsLoading } = useQuery({
    queryKey: ["focus-coach", "goals"],
    queryFn: () => fetchJSON("/api/focus-coach/goals"),
  });

  const { data: echoData } = useQuery({
    queryKey: ["echo", "profile"],
    queryFn: () => fetchJSON("/api/echo/profile"),
  });

  const { data: analytics } = useQuery({
    queryKey: ["focus-coach", "analytics"],
    queryFn: () => fetchJSON("/api/focus-coach/analytics"),
  });

  const completeMutation = useMutation({
    mutationFn: (goalId: number) => postJSON("/api/focus-coach/complete-goal", { goalId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["focus-coach", "goals"] });
      queryClient.invalidateQueries({ queryKey: ["ascend"] });
      toast({ title: "Goal completed! 🎉", description: "XP has been awarded to your Ascend profile." });
    },
    onError: () => toast({ title: "Failed to complete goal", variant: "destructive" }),
  });

  const todayGoals = goalsData?.today ?? [];
  const weeklyGoals = goalsData?.weekly ?? [];
  const completedToday = todayGoals.filter((g: any) => g.completedAt).length;
  const goalProgress = todayGoals.length > 0 ? Math.round((completedToday / todayGoals.length) * 100) : 0;

  const weakTopics: string[] = echoData?.weakTopics ?? [];

  const studyByDay = analytics?.studyByDay ?? {};
  const focusData = Object.entries(studyByDay)
    .map(([date, minutes]) => ({
      day: new Date(date).toLocaleDateString("en-US", { weekday: "short" }),
      minutes: minutes as number,
    }))
    .slice(-14);

  return (
    <div className="min-h-screen bg-[#F5F5F5] dark:bg-background p-4 md:p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Target className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">FocusCoach</h1>
            <p className="text-muted-foreground text-sm">Your personalised weak-topic tracker and daily goal setter.</p>
          </div>
        </div>
      </motion.div>

      <Tabs defaultValue="goals">
        <TabsList className="mb-5">
          <TabsTrigger value="goals">Goals</TabsTrigger>
          <TabsTrigger value="topics">Weak Topics</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Goals Tab */}
        <TabsContent value="goals">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  Today's Goals
                </h2>
                <Badge variant="secondary">{completedToday}/{todayGoals.length} complete</Badge>
              </div>

              {goalsLoading ? (
                <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
              ) : todayGoals.length === 0 ? (
                <Card className="shadow-sm">
                  <CardContent className="p-6 text-center text-muted-foreground text-sm">
                    No goals yet. Add one below!
                  </CardContent>
                </Card>
              ) : (
                <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
                  {todayGoals.map((goal: any) => {
                    const done = !!goal.completedAt;
                    return (
                      <motion.div key={goal.id} variants={item}>
                        <Card className={`shadow-sm transition-colors ${done ? "opacity-70" : ""}`}>
                          <CardContent className="p-4 flex items-center gap-3">
                            <Checkbox
                              checked={done}
                              onCheckedChange={() => !done && completeMutation.mutate(goal.id)}
                              disabled={done || completeMutation.isPending}
                              className="shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium ${done ? "line-through text-muted-foreground" : ""}`}>
                                {goal.title}
                              </p>
                              <p className="text-[11px] text-muted-foreground capitalize">{goal.type} goal</p>
                            </div>
                            <Badge variant="secondary" className="text-[10px] shrink-0">+{goal.xpReward} XP</Badge>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}

              {/* Weekly Goals */}
              {weeklyGoals.length > 0 && (
                <>
                  <h2 className="font-semibold text-base flex items-center gap-2 mt-6">
                    <Target className="h-4 w-4 text-primary" />
                    Weekly Goals
                  </h2>
                  <div className="space-y-3">
                    {weeklyGoals.map((goal: any) => {
                      const done = !!goal.completedAt;
                      return (
                        <Card key={goal.id} className={`shadow-sm ${done ? "opacity-70" : ""}`}>
                          <CardContent className="p-4 flex items-center gap-3">
                            <Checkbox checked={done} onCheckedChange={() => !done && completeMutation.mutate(goal.id)} disabled={done} className="shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium ${done ? "line-through text-muted-foreground" : ""}`}>{goal.title}</p>
                              {goal.targetDate && <p className="text-[11px] text-muted-foreground">Due: {goal.targetDate}</p>}
                            </div>
                            <Badge variant="secondary" className="text-[10px] shrink-0">+{goal.xpReward} XP</Badge>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Progress sidebar */}
            <div className="space-y-4">
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Today's Progress
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Goals completed</span>
                    <span className="font-semibold text-primary">{goalProgress}%</span>
                  </div>
                  <Progress value={goalProgress} className="h-2.5" />
                  {goalProgress === 100 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-center"
                    >
                      <CheckCircle2 className="h-6 w-6 text-primary mx-auto mb-1" />
                      <p className="font-bold text-xs text-primary">All done! 🎉</p>
                    </motion.div>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Link href="/focus-zone">
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs">
                      <Clock className="h-3.5 w-3.5 text-primary" />
                      Start Focus Session
                    </Button>
                  </Link>
                  <Link href="/mentor">
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs">
                      <Brain className="h-3.5 w-3.5 text-primary" />
                      Ask The Mentor
                    </Button>
                  </Link>
                  <Link href="/flashcards">
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs">
                      <BookOpen className="h-3.5 w-3.5 text-primary" />
                      Review Flashcards
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Weak Topics Tab */}
        <TabsContent value="topics">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <motion.div variants={container} initial="hidden" animate="show" className="lg:col-span-2 space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <h2 className="font-semibold text-base">Weak Topics</h2>
                <Badge variant="secondary" className="ml-auto text-xs">from Echo memory</Badge>
              </div>
              {weakTopics.length === 0 ? (
                <Card className="shadow-sm">
                  <CardContent className="p-6 text-center text-muted-foreground text-sm">
                    No weak topics identified yet. Keep studying!
                  </CardContent>
                </Card>
              ) : (
                weakTopics.map((topic, idx) => (
                  <motion.div key={topic} variants={item}>
                    <Card className="shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <p className="font-semibold text-sm">{topic}</p>
                            <p className="text-xs text-muted-foreground">Identified by Echo AI</p>
                          </div>
                          <Badge variant="outline" className={`text-[10px] shrink-0 ${idx < 2 ? priorityColor.high : idx < 4 ? priorityColor.medium : priorityColor.low}`}>
                            {idx < 2 ? "high" : idx < 4 ? "medium" : "low"} priority
                          </Badge>
                        </div>
                        <div className="flex gap-2">
                          <Link href={`/mentor`}>
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                              <Brain className="h-3 w-3" /> Ask Mentor
                            </Button>
                          </Link>
                          <Link href="/flashcards">
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                              <BookOpen className="h-3 w-3" /> Flashcards
                            </Button>
                          </Link>
                          <Link href="/revisit">
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                              <Target className="h-3 w-3" /> Revisit
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              )}
            </motion.div>

            <Card className="shadow-sm h-fit">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Echo Summary</CardTitle>
                <CardDescription className="text-xs">Your learning profile</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-xs">Learning Pace</span>
                  <span className="font-medium capitalize text-xs">{echoData?.learningPace ?? "medium"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-xs">Preferred Style</span>
                  <span className="font-medium capitalize text-xs">{echoData?.preferredStyle ?? "visual"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-xs">Confidence</span>
                  <div className="flex items-center gap-2">
                    <Progress value={(echoData?.confidenceScore ?? 0) * 100} className="w-16 h-1.5" />
                    <span className="font-medium text-xs">{Math.round((echoData?.confidenceScore ?? 0) * 100)}%</span>
                  </div>
                </div>
                <Link href="/echo">
                  <Button variant="outline" size="sm" className="w-full text-xs mt-2">
                    Full Echo Profile <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Focus Time (Last 14 Days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {focusData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No focus sessions recorded yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={focusData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} unit="m" />
                      <Tooltip formatter={(v) => [`${v} min`, "Focus time"]} />
                      <Bar dataKey="minutes" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <div className="space-y-4">
              {[
                { label: "30-day Streak", value: `${analytics?.streak ?? 0} days`, icon: "🔥" },
                { label: "Total Study Hours", value: `${analytics?.totalHours ?? 0}h`, icon: "⏱️" },
                { label: "Avg Session", value: `${analytics?.avgSessionMinutes ?? 0} min`, icon: "📊" },
                { label: "Goals Completed", value: `${analytics?.completedGoals ?? 0}`, icon: "✅" },
              ].map(({ label, value, icon }) => (
                <Card key={label} className="shadow-sm">
                  <CardContent className="p-4 flex items-center gap-4">
                    <span className="text-2xl">{icon}</span>
                    <div>
                      <p className="text-xl font-bold text-primary">{value}</p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
