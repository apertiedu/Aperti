import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Target, Plus, CheckCircle2, Trash2, TrendingUp, Trophy,
  BookOpen, Calendar, Flame, ChevronUp, ChevronDown, Zap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";


async function fetchJSON(url: string) {
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

async function postJSON(url: string, body: unknown, method = "POST") {
  const r = await fetch(url, {
    method, headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

const TYPE_ICONS: Record<string, { icon: typeof Target; color: string }> = {
  grade: { icon: TrendingUp, color: "text-emerald-600" },
  exam: { icon: BookOpen, color: "text-blue-600" },
  course: { icon: CheckCircle2, color: "text-primary" },
  attendance: { icon: Calendar, color: "text-amber-600" },
  revision: { icon: Flame, color: "text-orange-600" },
  custom: { icon: Target, color: "text-purple-600" },
};

function GoalRing({ progress, size = 80 }: { progress: number; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth={6} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="hsl(var(--primary))" strokeWidth={6} strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ * (1 - progress / 100) }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </svg>
  );
}

export default function GoalsDashboard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("custom");
  const [newTarget, setNewTarget] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["learning-goals"],
    queryFn: () => fetchJSON("/api/learning-goals"),
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => postJSON("/api/learning-goals", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["learning-goals"] });
      setShowNew(false); setNewTitle(""); setNewTarget(""); setNewDeadline("");
      toast({ title: "Goal created!" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: any) => postJSON(`/api/learning-goals/${id}`, body, "PUT"),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["learning-goals"] });
      setUpdatingId(null);
      if (data.status === "achieved") toast({ title: "🎉 Goal Achieved!", description: `+${data.xpReward} XP earned!` });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/learning-goals/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["learning-goals"] }),
  });

  const goals = data?.goals ?? [];
  const active = data?.active ?? [];
  const achieved = data?.achieved ?? [];
  const attainmentRate = data?.attainmentRate ?? 0;

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
  const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="min-h-screen bg-[#F5F5F5] dark:bg-background p-4 md:p-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Target className="h-7 w-7 text-primary" /> Goals
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">Set and track your learning ambitions</p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => setShowNew(!showNew)}>
            <Plus className="h-4 w-4" /> New Goal
          </Button>
        </div>
      </motion.div>

      {/* Stats row */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "Active", value: active.length, icon: <Flame className="h-4 w-4 text-orange-500" />, bg: "bg-orange-50 dark:bg-orange-950/20" },
          { label: "Achieved", value: achieved.length, icon: <Trophy className="h-4 w-4 text-emerald-500" />, bg: "bg-emerald-50 dark:bg-emerald-950/20" },
          { label: "Attainment", value: `${attainmentRate}%`, icon: <Zap className="h-4 w-4 text-primary" />, bg: "bg-primary/5" },
        ].map(({ label, value, icon, bg }) => (
          <motion.div key={label} variants={item}>
            <Card className="shadow-sm">
              <CardContent className={`p-3 flex items-center gap-3 rounded-xl ${bg}`}>
                <div className="w-8 h-8 rounded-lg bg-white/60 dark:bg-white/10 flex items-center justify-center shrink-0">{icon}</div>
                <div>
                  <p className="text-lg font-bold leading-none">{value}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* New goal form */}
      <AnimatePresence>
        {showNew && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-5 overflow-hidden">
            <Card className="shadow-sm border-primary/20">
              <CardHeader className="pb-2 px-4 pt-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Plus className="h-4 w-4 text-primary" /> New Goal
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                <Input
                  placeholder="Goal title (e.g. Get 90% in Physics)"
                  value={newTitle} onChange={e => setNewTitle(e.target.value)}
                  className="h-9 text-sm"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Select value={newType} onValueChange={setNewType}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grade">Grade Target</SelectItem>
                      <SelectItem value="exam">Exam Goal</SelectItem>
                      <SelectItem value="course">Course Completion</SelectItem>
                      <SelectItem value="attendance">Attendance</SelectItem>
                      <SelectItem value="revision">Revision Hours</SelectItem>
                      <SelectItem value="custom">Custom Goal</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder="Target (e.g. 90%)" value={newTarget} onChange={e => setNewTarget(e.target.value)} className="h-9 text-sm" />
                </div>
                <Input type="date" value={newDeadline} onChange={e => setNewDeadline(e.target.value)} className="h-9 text-sm" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => createMutation.mutate({ title: newTitle, type: newType, target: newTarget, deadline: newDeadline })} disabled={!newTitle || createMutation.isPending}>
                    {createMutation.isPending ? "Saving…" : "Create Goal"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
      ) : goals.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="shadow-sm">
            <CardContent className="p-10 text-center">
              <Target className="h-12 w-12 text-primary/30 mx-auto mb-3" />
              <p className="font-semibold text-lg">No goals yet</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">Set your first goal to stay motivated and earn XP.</p>
              <Button size="sm" onClick={() => setShowNew(true)} className="gap-1.5">
                <Plus className="h-4 w-4" /> Create First Goal
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
          {goals.map((goal: any) => {
            const tcfg = TYPE_ICONS[goal.type] ?? TYPE_ICONS.custom;
            const Icon = tcfg.icon;
            const isAchieved = goal.status === "achieved";
            const isUpdating = updatingId === goal.id;

            return (
              <motion.div key={goal.id} variants={item}>
                <Card className={`shadow-sm ${isAchieved ? "border-emerald-200 dark:border-emerald-800 opacity-80" : ""}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {/* Ring */}
                      <div className="relative shrink-0">
                        <GoalRing progress={goal.progress} size={72} />
                        <div className="absolute inset-0 flex items-center justify-center">
                          {isAchieved ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                          ) : (
                            <span className="text-xs font-bold text-primary">{goal.progress}%</span>
                          )}
                        </div>
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Icon className={`h-4 w-4 shrink-0 ${tcfg.color}`} />
                          <p className="font-semibold text-sm">{goal.icon} {goal.title}</p>
                          <Badge variant={isAchieved ? "default" : "secondary"} className={`text-[10px] h-4 ${isAchieved ? "bg-emerald-500" : ""}`}>
                            {isAchieved ? "Achieved ✓" : goal.status}
                          </Badge>
                        </div>
                        {goal.target && <p className="text-xs text-muted-foreground mt-0.5">Target: {goal.target}</p>}
                        {goal.deadline && <p className="text-xs text-muted-foreground">Deadline: {goal.deadline}</p>}
                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex-1">
                            <Progress value={goal.progress} className="h-2" />
                          </div>
                          <Badge variant="outline" className="text-[10px] shrink-0">+{goal.xpReward} XP</Badge>
                        </div>
                      </div>
                    </div>

                    {/* Controls */}
                    {!isAchieved && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs"
                          onClick={() => updateMutation.mutate({ id: goal.id, progress: Math.max(0, goal.progress - 10) })}>
                          <ChevronDown className="h-3 w-3" /> -10%
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs"
                          onClick={() => updateMutation.mutate({ id: goal.id, progress: Math.min(100, goal.progress + 10) })}>
                          <ChevronUp className="h-3 w-3" /> +10%
                        </Button>
                        <Button size="sm" className="h-7 gap-1 text-xs ml-auto"
                          onClick={() => updateMutation.mutate({ id: goal.id, progress: 100, status: "achieved" })}>
                          <CheckCircle2 className="h-3 w-3" /> Mark Done
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteMutation.mutate(goal.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
