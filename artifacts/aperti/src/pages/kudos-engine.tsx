import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Award, Plus, Medal } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";
const token = () => localStorage.getItem("aperti_token");

async function fetchJSON(url: string, opts?: RequestInit) {
  const res = await fetch(`${API}${url}`, {
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) },
    ...opts,
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const RANK_ICONS = [
  <Trophy className="h-5 w-5 text-yellow-500" />,
  <Medal className="h-5 w-5 text-slate-400" />,
  <Award className="h-5 w-5 text-amber-700" />,
];

const BADGE_VARIANTS: ("default" | "secondary" | "outline")[] = ["default", "secondary", "outline"];

export default function KudosEngine() {
  const [awardForm, setAwardForm] = useState({ studentId: "", points: "10", reason: "" });
  const [awardOpen, setAwardOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ["kudos-leaderboard"],
    queryFn: () => fetchJSON("/portal/leaderboard"),
  });

  const awardMutation = useMutation({
    mutationFn: (data: { studentId: string; points: number; reason: string }) =>
      fetchJSON("/achievements/award", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kudos-leaderboard"] });
      setAwardForm({ studentId: "", points: "10", reason: "" });
      setAwardOpen(false);
    },
  });

  const rows: any[] = Array.isArray(leaderboard?.leaderboard) ? leaderboard.leaderboard : [];

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Kudos Engine<span className="text-primary">™</span></h1>
          <p className="text-muted-foreground">Recognise and reward student excellence.</p>
        </div>
        <Button onClick={() => setAwardOpen(v => !v)}>
          <Plus className="h-4 w-4 mr-2" /> Award Kudos
        </Button>
      </motion.div>

      {awardOpen && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Award Kudos Points</CardTitle>
              <CardDescription>Manually award XP to a student for outstanding contribution.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Student ID</Label>
                  <Input
                    placeholder="Student ID"
                    value={awardForm.studentId}
                    onChange={e => setAwardForm(f => ({ ...f, studentId: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Points</Label>
                  <Input
                    type="number"
                    min={1}
                    max={500}
                    value={awardForm.points}
                    onChange={e => setAwardForm(f => ({ ...f, points: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Reason</Label>
                  <Input
                    placeholder="Outstanding presentation…"
                    value={awardForm.reason}
                    onChange={e => setAwardForm(f => ({ ...f, reason: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button
                  onClick={() => awardMutation.mutate({ studentId: awardForm.studentId, points: parseInt(awardForm.points), reason: awardForm.reason })}
                  disabled={!awardForm.studentId || awardMutation.isPending}
                >
                  {awardMutation.isPending ? "Awarding…" : "Confirm Award"}
                </Button>
                <Button variant="outline" onClick={() => setAwardOpen(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Tabs defaultValue="leaderboard">
        <TabsList className="mb-6">
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="badges">Achievement Badges</TabsTrigger>
        </TabsList>

        <TabsContent value="leaderboard">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" /> Class Rankings
              </CardTitle>
              <CardDescription>Based on XP earned through homework, exams, and participation.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
                </div>
              ) : rows.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">
                  No ranking data yet. Students earn XP by completing homework and exams.
                </p>
              ) : (
                <div className="space-y-3">
                  {rows.map((r: any, i: number) => {
                    const initials = ((r.displayName || r.name || "?") as string)
                      .split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
                    return (
                      <motion.div
                        key={r.studentId ?? i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className={`flex items-center gap-4 p-3 rounded-xl ${i < 3 ? "bg-primary/5 border border-primary/20" : "bg-muted/40"}`}
                      >
                        <span className="w-6 flex justify-center">
                          {i < 3 ? RANK_ICONS[i] : <span className="text-sm text-muted-foreground font-mono">{i + 1}</span>}
                        </span>
                        <Avatar className="h-10 w-10 bg-primary/20 text-primary">
                          <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{r.displayName || r.name}</p>
                          <p className="text-xs text-muted-foreground">{r.level ?? "Learner"} · Level {r.levelNumber ?? 1}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary">{(r.totalXp ?? r.points ?? 0).toLocaleString()} XP</p>
                          <p className="text-xs text-muted-foreground">{r.achievementCount ?? 0} badges</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="badges">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { name: "First Submission", desc: "Submitted their first homework.", xp: 50, icon: "📝" },
              { name: "Perfect Score", desc: "Achieved 100% on any exam.", xp: 200, icon: "💯" },
              { name: "Attendance Star", desc: "100% attendance for a full month.", xp: 150, icon: "⭐" },
              { name: "Quick Learner", desc: "Completed 5 lessons in one week.", xp: 100, icon: "⚡" },
              { name: "Helping Hand", desc: "Assisted a classmate via peer review.", xp: 75, icon: "🤝" },
              { name: "Top of Class", desc: "Ranked #1 on the weekly leaderboard.", xp: 300, icon: "🏆" },
              { name: "Streak Master", desc: "7-day login streak.", xp: 120, icon: "🔥" },
              { name: "Deep Diver", desc: "Spent 10+ hours in SimVerse.", xp: 180, icon: "🔬" },
              { name: "Flashcard Champ", desc: "Reviewed 100 flashcards in a week.", xp: 90, icon: "🃏" },
            ].map((badge, i) => (
              <motion.div
                key={badge.name}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="card-hover">
                  <CardContent className="p-4 flex items-start gap-3">
                    <span className="text-3xl">{badge.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-semibold text-sm">{badge.name}</p>
                        <Badge variant={BADGE_VARIANTS[i % 3]} className="text-xs">+{badge.xp} XP</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{badge.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
