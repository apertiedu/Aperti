import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Trophy, Zap, Target, Crown, Medal, Users, Calendar,
  CheckCircle2, ArrowRight, Star,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const token = () => localStorage.getItem("aperti_token");

async function fetchJSON(url: string) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } });
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

async function postJSON(url: string, body?: unknown) {
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

const TYPE_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  daily: { color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30", label: "Daily" },
  weekly: { color: "text-primary", bg: "bg-primary/5", label: "Weekly" },
  subject: { color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/30", label: "Subject" },
  exam: { color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30", label: "Exam" },
  school: { color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30", label: "School" },
};

const RANK_ICONS = [
  <Crown key={1} className="h-5 w-5 text-yellow-500" />,
  <Medal key={2} className="h-5 w-5 text-slate-400" />,
  <Medal key={3} className="h-5 w-5 text-amber-600" />,
];

export default function ChallengesPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedChallenge, setSelectedChallenge] = useState<number | null>(null);

  const { data: challengesData, isLoading } = useQuery({
    queryKey: ["challenges"],
    queryFn: () => fetchJSON("/api/challenges"),
    staleTime: 60_000,
  });

  const { data: leaderboard } = useQuery({
    queryKey: ["challenge-leaderboard", selectedChallenge],
    queryFn: () => selectedChallenge ? fetchJSON(`/api/challenges/leaderboard/${selectedChallenge}`) : null,
    enabled: !!selectedChallenge,
    staleTime: 30_000,
  });

  const joinMutation = useMutation({
    mutationFn: (id: number) => postJSON(`/api/challenges/${id}/join`),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["challenges"] });
      if (data.alreadyJoined) {
        toast({ title: "Already joined this challenge" });
      } else {
        toast({ title: "Challenge joined! 🚀", description: "Good luck!" });
      }
    },
  });

  const submitMutation = useMutation({
    mutationFn: ({ id, score }: { id: number; score: number }) => postJSON(`/api/challenges/${id}/submit`, { score }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["challenges"] });
      toast({ title: `Challenge completed! +${data.xpAwarded} XP 🎉` });
    },
  });

  const challenges = challengesData?.challenges ?? [];
  const active = challenges.filter((c: any) => !c.endDate || new Date(c.endDate) >= new Date());

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } };
  const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="min-h-screen bg-[#F5F5F5] dark:bg-background p-4 md:p-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Trophy className="h-7 w-7 text-primary" /> Challenges
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Compete, earn XP, and push your limits
        </p>
      </motion.div>

      <Tabs defaultValue="active">
        <TabsList className="mb-5">
          <TabsTrigger value="active">Active Challenges</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {isLoading ? (
            <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)}</div>
          ) : active.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="shadow-sm">
                <CardContent className="p-10 text-center">
                  <Trophy className="h-12 w-12 text-primary/30 mx-auto mb-3" />
                  <p className="font-semibold text-lg">No active challenges</p>
                  <p className="text-sm text-muted-foreground mt-1">Your teacher will post challenges here. Check back soon!</p>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div variants={container} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2">
              {active.map((challenge: any) => {
                const cfg = TYPE_CONFIG[challenge.type] ?? TYPE_CONFIG.weekly;
                const isSelected = selectedChallenge === challenge.id;
                const now = new Date();
                const endDate = challenge.endDate ? new Date(challenge.endDate) : null;
                const daysLeft = endDate ? Math.ceil((endDate.getTime() - now.getTime()) / 86400000) : null;

                return (
                  <motion.div key={challenge.id} variants={item}>
                    <Card className={`shadow-sm hover:shadow-md transition-shadow ${isSelected ? "border-primary" : ""}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <Badge variant="outline" className={`text-[10px] h-4 ${cfg.color}`}>{cfg.label}</Badge>
                              {daysLeft !== null && daysLeft <= 3 && (
                                <Badge variant="destructive" className="text-[10px] h-4">{daysLeft}d left</Badge>
                              )}
                            </div>
                            <p className="font-semibold text-sm">{challenge.title}</p>
                            {challenge.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{challenge.description}</p>
                            )}
                          </div>
                          <div className={`ml-3 px-3 py-1.5 rounded-xl text-center shrink-0 ${cfg.bg}`}>
                            <div className="flex items-center gap-1">
                              <Zap className={`h-3.5 w-3.5 ${cfg.color}`} />
                              <span className={`text-sm font-bold ${cfg.color}`}>{challenge.xpReward}</span>
                            </div>
                            <p className={`text-[10px] ${cfg.color}`}>XP</p>
                          </div>
                        </div>

                        {endDate && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                            <Calendar className="h-3 w-3" />
                            <span>Ends {endDate.toLocaleDateString()}</span>
                            {daysLeft !== null && <span className="ml-auto font-medium">{daysLeft > 0 ? `${daysLeft} days left` : "Ending today"}</span>}
                          </div>
                        )}

                        <div className="flex gap-2 flex-wrap">
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs flex-1"
                            onClick={() => { joinMutation.mutate(challenge.id); setSelectedChallenge(challenge.id); }}>
                            <Target className="h-3 w-3" /> Join
                          </Button>
                          <Button size="sm" className="h-7 gap-1 text-xs flex-1"
                            onClick={() => submitMutation.mutate({ id: challenge.id, score: 100 })}>
                            <CheckCircle2 className="h-3 w-3" /> Submit
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"
                            onClick={() => setSelectedChallenge(isSelected ? null : challenge.id)}>
                            <Users className="h-3 w-3" /> Board
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </TabsContent>

        <TabsContent value="leaderboard">
          {!selectedChallenge ? (
            <Card className="shadow-sm">
              <CardContent className="p-8 text-center">
                <Crown className="h-10 w-10 text-yellow-500/50 mx-auto mb-3" />
                <p className="font-semibold">Select a challenge first</p>
                <p className="text-sm text-muted-foreground mt-1">Go to Active Challenges and click "Board" on any challenge</p>
              </CardContent>
            </Card>
          ) : !leaderboard ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="shadow-sm">
                <CardHeader className="pb-2 px-4 pt-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Crown className="h-5 w-5 text-yellow-500" /> Leaderboard
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {(leaderboard.leaderboard ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No submissions yet — be the first!</p>
                  ) : (
                    <div className="space-y-2">
                      {(leaderboard.leaderboard as any[]).map((entry, idx) => (
                        <motion.div key={entry.id}
                          initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className={`flex items-center gap-3 p-3 rounded-xl ${idx === 0 ? "bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800" : "bg-muted/40"}`}
                        >
                          <div className="w-7 h-7 flex items-center justify-center shrink-0">
                            {idx < 3 ? RANK_ICONS[idx] : <span className="text-sm font-bold text-muted-foreground">#{idx + 1}</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{entry.studentName}</p>
                            <p className="text-[10px] text-muted-foreground capitalize">{entry.status}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 text-yellow-500" />
                            <span className="font-bold text-sm">{parseFloat(String(entry.score ?? 0)).toFixed(0)}</span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
