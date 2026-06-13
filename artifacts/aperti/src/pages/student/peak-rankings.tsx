import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, Medal, Star, TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/auth";

async function fetchJSON(url: string) {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const TYPES = [
  { value: "xp", label: "XP" },
  { value: "streak", label: "Streak" },
  { value: "attendance", label: "Attendance" },
  { value: "mock_scores", label: "Mock Scores" },
  { value: "consistency", label: "Consistency" },
];
const SCOPES = [
  { value: "class", label: "Class" },
  { value: "school", label: "School" },
];

const rankMedal = (rank: number) => {
  if (rank === 1) return <Trophy className="h-4 w-4 text-yellow-500" />;
  if (rank === 2) return <Medal className="h-4 w-4 text-slate-400" />;
  if (rank === 3) return <Medal className="h-4 w-4 text-amber-600" />;
  return <span className="text-xs font-bold text-muted-foreground w-4 text-center">{rank}</span>;
};

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, x: -12 }, show: { opacity: 1, x: 0, transition: { type: "spring" as const, stiffness: 280, damping: 24 } } };

export default function PeakRankings() {
  const [type, setType] = useState("xp");
  const [scope, setScope] = useState("class");
  const { user } = useAuth();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["peak-rankings", type, scope],
    queryFn: () => fetchJSON(`/api/peak-rankings?type=${type}&scope=${scope}`),
    staleTime: 60_000,
  });

  const leaderboard = data?.leaderboard ?? [];
  const currentUser = data?.currentUser;

  return (
    <div className="min-h-screen bg-[#F5F5F5] dark:bg-background p-4 md:p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Trophy className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">PeakRankings</h1>
            <p className="text-muted-foreground text-sm">Class leaderboards — compete, improve, and celebrate wins.</p>
          </div>
        </div>
      </motion.div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-40 h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={scope} onValueChange={setScope}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCOPES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="h-9 gap-1.5 text-sm">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* My position */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="shadow-sm border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Star className="h-4 w-4 text-primary" />
                Your Position
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-32 rounded-xl" /> : currentUser ? (
                <div className="text-center py-2">
                  <div className="text-5xl font-extrabold text-primary mb-1">#{currentUser.rank}</div>
                  <p className="text-muted-foreground text-sm">of {leaderboard.length} students</p>
                  <div className="mt-4 p-3 rounded-xl bg-primary/10 inline-flex items-center gap-2">
                    <Star className="h-4 w-4 text-primary" />
                    <span className="font-bold text-primary">
                      {type === "xp" ? `${currentUser.xp?.toLocaleString()} XP` :
                       type === "streak" ? `${currentUser.streak} days` :
                       type === "attendance" ? `${currentUser.attendancePct}%` :
                       type === "mock_scores" ? `${currentUser.mockScore}%` :
                       `${currentUser.consistencyScore}%`}
                    </span>
                  </div>
                  {currentUser.level && (
                    <p className="text-xs text-muted-foreground mt-2">Level {currentUser.level} · {currentUser.archetype}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No ranking data yet</p>
              )}
            </CardContent>
          </Card>

          {/* Top 3 */}
          {leaderboard.length >= 3 && (
            <Card className="shadow-sm mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Top 3 Podium</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {leaderboard.slice(0, 3).map((r: any) => (
                  <div key={r.rank} className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-5">{rankMedal(r.rank)}</div>
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className={`text-[10px] ${r.isYou ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        {r.isYou ? "ME" : String(r.rank)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{r.isYou ? `You (${user?.displayName ?? "You"})` : r.displayName ?? `Rank ${r.rank}`}</p>
                    </div>
                    <span className="text-xs font-bold text-primary">
                      {type === "xp" ? `${r.xp?.toLocaleString()} XP` : r[type] ?? "—"}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* Full leaderboard */}
        <div className="lg:col-span-2">
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{scope === "class" ? "Class" : "School"} Leaderboard · {TYPES.find(t => t.value === type)?.label}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="space-y-2 p-4">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
              ) : leaderboard.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No rankings available yet.</p>
              ) : (
                <motion.div variants={container} initial="hidden" animate="show">
                  {leaderboard.map((entry: any, idx: number) => (
                    <motion.div
                      key={entry.rank}
                      variants={item}
                      className={`flex items-center gap-4 px-5 py-3 transition-colors ${
                        entry.isYou
                          ? "bg-primary/5 border-l-2 border-primary"
                          : "hover:bg-muted/40"
                      } ${idx !== 0 ? "border-t border-border/50" : ""}`}
                    >
                      <div className="flex items-center justify-center w-6 shrink-0">{rankMedal(entry.rank)}</div>
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className={`text-xs ${entry.isYou ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                          {entry.isYou ? "ME" : String(entry.rank)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${entry.isYou ? "text-primary" : ""}`}>
                          {entry.isYou ? `You (${user?.displayName ?? "You"})` : entry.displayRank ?? `Student #${entry.rank}`}
                        </p>
                        {entry.archetype && <p className="text-[10px] text-muted-foreground">{entry.archetype}</p>}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {entry.streak > 0 && (
                          <span className="text-[10px] text-orange-500 flex items-center gap-0.5">
                            🔥{entry.streak}
                          </span>
                        )}
                        <div className="text-right">
                          <p className="font-bold text-sm text-primary">
                            {type === "xp" ? `${entry.xp?.toLocaleString()} XP` :
                             type === "streak" ? `${entry.streak}d` :
                             type === "attendance" ? `${entry.attendancePct ?? 0}%` :
                             type === "mock_scores" ? `${entry.mockScore ?? 0}%` :
                             `${entry.consistencyScore ?? 0}%`}
                          </p>
                          <p className="text-[9px] text-muted-foreground">Lv {entry.level ?? 1}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
