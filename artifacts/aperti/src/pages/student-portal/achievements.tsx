import { apiFetch } from "@/lib/api";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Star, Zap, Crown, Lock, Medal, TrendingUp, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Achievement = {
  key: string; name: string; desc: string; xp: number; icon: string;
  earned: boolean; earnedAt: string | null;
};

type AchievementData = {
  totalXp: number; level: number; levelTitle: string; nextLevelXp: number;
  levelProgress: number; achievements: Achievement[];
};

type LeaderboardEntry = {
  student_id: number; student_name: string; student_code: string;
  total_xp: number; level: number; rank: number;
};

const LEVEL_COLORS = [
  "", "from-slate-400 to-gray-500",
  "from-emerald-400 to-teal-500",
  "from-sky-400 to-blue-500",
  "from-violet-400 to-purple-500",
  "from-amber-400 to-orange-500",
  "from-rose-400 to-pink-500",
];

const RANK_BADGES = ["🥇", "🥈", "🥉"];

export default function AchievementsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<AchievementData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myId, setMyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [tab, setTab] = useState<"achievements" | "leaderboard">("achievements");

  const load = async () => {
    setLoading(true);
    const [achRes, lbRes] = await Promise.all([
      apiFetch("/api/portal/achievements", { credentials: "include" }),
      apiFetch("/api/portal/leaderboard", { credentials: "include" }),
    ]);
    if (achRes.ok) setData(await achRes.json());
    if (lbRes.ok) {
      const lb = await lbRes.json();
      setLeaderboard(lb.leaderboard ?? []);
      setMyId(lb.myStudentId);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const checkAchievements = async () => {
    setChecking(true);
    const res = await apiFetch("/api/portal/achievements/check", { method: "POST" });
    if (res.ok) {
      const { newlyEarned } = await res.json();
      if (newlyEarned.length > 0) {
        toast({ title: `🎉 New achievements unlocked!`, description: newlyEarned.join(", ") });
        load();
      } else {
        toast({ title: "All up to date!", description: "Keep studying to unlock more achievements" });
      }
    }
    setChecking(false);
  };

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="h-32 rounded-2xl skeleton" />
        <div className="grid grid-cols-2 gap-3">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-24 rounded-xl skeleton" />)}
        </div>
      </div>
    );
  }

  const earned = data.achievements.filter(a => a.earned);
  const locked = data.achievements.filter(a => !a.earned);
  const levelGrad = LEVEL_COLORS[Math.min(data.level, LEVEL_COLORS.length - 1)];
  const prevLevelXp = [0, 0, 100, 300, 600, 1000, 2000][Math.min(data.level, 6)];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
            <Trophy className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Achievements</h1>
            <p className="text-xs text-muted-foreground">{earned.length} of {data.achievements.length} unlocked</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={checkAchievements} disabled={checking} className="gap-1.5 text-xs">
          <Zap className="h-3.5 w-3.5" />{checking ? "Checking..." : "Check Progress"}
        </Button>
      </div>

      {/* XP Card */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className={`border-0 bg-gradient-to-br ${levelGrad} text-white shadow-lg overflow-hidden`}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-white/80 text-xs font-medium uppercase tracking-wide">Level {data.level}</p>
                <p className="text-2xl font-bold text-white">{data.levelTitle}</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shadow-inner">
                <Crown className="h-7 w-7 text-white" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-white/80">
                <span>{data.totalXp - prevLevelXp} / {data.nextLevelXp - prevLevelXp} XP to next level</span>
                <span className="font-bold text-white">{data.totalXp} total XP</span>
              </div>
              <div className="h-2.5 rounded-full bg-white/20 overflow-hidden">
                <motion.div className="h-full rounded-full bg-white"
                  initial={{ width: 0 }} animate={{ width: `${data.levelProgress}%` }}
                  transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs */}
      <div className="flex rounded-xl border border-border/50 p-1 bg-muted/30">
        {(["achievements", "leaderboard"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all capitalize ${
              tab === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}>
            {t === "achievements" ? `Badges (${earned.length})` : `Leaderboard`}
          </button>
        ))}
      </div>

      {tab === "achievements" && (
        <div className="space-y-5">
          {/* Earned */}
          {earned.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Star className="h-3.5 w-3.5" />Earned ({earned.length})
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {earned.map((ach, i) => (
                  <motion.div key={ach.key} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}>
                    <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 overflow-hidden">
                      <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
                      <CardContent className="p-3 text-center space-y-1.5">
                        <div className="text-3xl">{ach.icon}</div>
                        <p className="text-xs font-bold text-foreground">{ach.name}</p>
                        <p className="text-[10px] text-muted-foreground leading-tight">{ach.desc}</p>
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] gap-0.5">
                          <Zap className="h-2.5 w-2.5" />+{ach.xp} XP
                        </Badge>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Locked */}
          {locked.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Lock className="h-3.5 w-3.5" />Locked ({locked.length})
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {locked.map(ach => (
                  <Card key={ach.key} className="border-border/40 bg-muted/20 opacity-60">
                    <CardContent className="p-3 text-center space-y-1.5">
                      <div className="text-3xl grayscale">{ach.icon}</div>
                      <p className="text-xs font-bold text-muted-foreground">{ach.name}</p>
                      <p className="text-[10px] text-muted-foreground/70 leading-tight">{ach.desc}</p>
                      <Badge variant="outline" className="text-[10px] gap-0.5">
                        <Lock className="h-2.5 w-2.5" />+{ach.xp} XP
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "leaderboard" && (
        <div className="space-y-2">
          {leaderboard.length === 0 ? (
            <div className="text-center py-16">
              <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">No leaderboard data yet</p>
              <p className="text-xs text-muted-foreground mt-1">Start earning XP to appear here</p>
            </div>
          ) : (
            leaderboard.map((entry, idx) => {
              const isMe = entry.student_id === myId;
              const entryGrad = LEVEL_COLORS[Math.min(entry.level, LEVEL_COLORS.length - 1)];
              return (
                <motion.div key={entry.student_id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04 }}>
                  <Card className={`border overflow-hidden ${isMe ? "border-primary bg-primary/5" : "border-border/50"}`}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="w-8 text-center font-bold text-lg shrink-0">
                        {idx < 3 ? RANK_BADGES[idx] : <span className="text-sm text-muted-foreground">#{entry.rank}</span>}
                      </div>
                      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${entryGrad} flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0`}>
                        {entry.level}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${isMe ? "text-primary" : "text-foreground"}`}>
                          {entry.student_name}{isMe && " (you)"}
                        </p>
                        <p className="text-xs text-muted-foreground">{entry.student_code}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-amber-600">{entry.total_xp} XP</p>
                        <p className="text-[10px] text-muted-foreground">Level {entry.level}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
