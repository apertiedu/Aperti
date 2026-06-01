import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, Medal, Star, Eye, EyeOff, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useAuth } from "@/context/auth";

const MOCK_RANKINGS = [
  { rank: 1, name: "Nour El-Din A.", xp: 4820, subject: "Physics 0625", trend: "up", delta: "+120 XP" },
  { rank: 2, name: "Sara M.", xp: 4650, subject: "Math 0580", trend: "up", delta: "+80 XP" },
  { rank: 3, name: "Adam K.", xp: 4410, subject: "Chemistry 0620", trend: "down", delta: "-30 XP" },
  { rank: 4, name: "You", xp: 4200, subject: "Physics 0625", trend: "up", delta: "+95 XP", isCurrentUser: true },
  { rank: 5, name: "Layla H.", xp: 3980, subject: "Biology 0610", trend: "same", delta: "0 XP" },
  { rank: 6, name: "Omar S.", xp: 3760, subject: "Math 0580", trend: "up", delta: "+45 XP" },
  { rank: 7, name: "Aya R.", xp: 3540, subject: "Chemistry 0620", trend: "down", delta: "-20 XP" },
  { rank: 8, name: "Kareem F.", xp: 3320, subject: "Physics 0625", trend: "up", delta: "+60 XP" },
  { rank: 9, name: "Mona T.", xp: 3100, subject: "Biology 0610", trend: "same", delta: "0 XP" },
  { rank: 10, name: "Hassan B.", xp: 2950, subject: "Math 0580", trend: "down", delta: "-15 XP" },
];

const SUBJECTS = ["All Subjects", "Physics 0625", "Math 0580", "Chemistry 0620", "Biology 0610"];

const rankMedal = (rank: number) => {
  if (rank === 1) return <Trophy className="h-4 w-4 text-yellow-500" />;
  if (rank === 2) return <Medal className="h-4 w-4 text-slate-400" />;
  if (rank === 3) return <Medal className="h-4 w-4 text-amber-600" />;
  return <span className="text-xs font-bold text-muted-foreground w-4 text-center">{rank}</span>;
};

const trendIcon = (trend: string) => {
  if (trend === "up") return <TrendingUp className="h-3 w-3 text-emerald-500" />;
  if (trend === "down") return <TrendingDown className="h-3 w-3 text-destructive" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
};

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, x: -12 }, show: { opacity: 1, x: 0, transition: { type: "spring" as const, stiffness: 280, damping: 24 } } };

export default function PeakRankings() {
  const [subject, setSubject] = useState("All Subjects");
  const [privateMode, setPrivateMode] = useState(false);
  const { user } = useAuth();

  const filtered = subject === "All Subjects"
    ? MOCK_RANKINGS
    : MOCK_RANKINGS.filter((r) => r.subject === subject || r.isCurrentUser);

  const currentUserRank = MOCK_RANKINGS.find((r) => r.isCurrentUser);

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Trophy className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">PeakRankings<span className="text-primary"></span></h1>
        </div>
        <p className="text-muted-foreground">Class leaderboards — compete, improve, and celebrate wins.</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Your position card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="card-hover border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Star className="h-4 w-4 text-primary" />
                Your Position
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-4">
                <div className="text-6xl font-extrabold text-primary mb-1">#{currentUserRank?.rank}</div>
                <p className="text-muted-foreground text-sm">of {MOCK_RANKINGS.length} students</p>
                <div className="mt-4 p-3 rounded-xl bg-primary/10 inline-flex items-center gap-2">
                  <Star className="h-4 w-4 text-primary" />
                  <span className="font-bold text-primary">{currentUserRank?.xp.toLocaleString()} XP</span>
                </div>
                <div className="mt-3 flex items-center justify-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="h-3 w-3" />
                  {currentUserRank?.delta} this week
                </div>
              </div>

              <div className="border-t border-border/50 pt-4 mt-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground text-xs">Hide my name from others</span>
                  <Switch checked={privateMode} onCheckedChange={setPrivateMode} />
                </div>
                {privateMode && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <EyeOff className="h-3 w-3" />
                    You appear as "Anonymous"
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Top 3 podium */}
          <Card className="card-hover mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">This Week's Podium</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {MOCK_RANKINGS.slice(0, 3).map((r) => (
                <div key={r.rank} className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-5">{rankMedal(r.rank)}</div>
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                      {r.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{r.isCurrentUser ? "You" : r.name}</p>
                  </div>
                  <span className="text-xs font-bold text-primary">{r.xp.toLocaleString()}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Full leaderboard */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Class Leaderboard</h2>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUBJECTS.map((s) => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <motion.div variants={container} initial="hidden" animate="show">
                {filtered.map((entry, idx) => (
                  <motion.div
                    key={entry.rank}
                    variants={item}
                    className={`flex items-center gap-4 px-5 py-3 transition-colors ${
                      entry.isCurrentUser
                        ? "bg-primary/5 border-l-2 border-primary"
                        : "hover:bg-muted/40"
                    } ${idx !== 0 ? "border-t border-border/50" : ""}`}
                  >
                    <div className="flex items-center justify-center w-6">{rankMedal(entry.rank)}</div>
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className={`text-xs ${entry.isCurrentUser ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        {entry.isCurrentUser ? "ME" : entry.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${entry.isCurrentUser ? "text-primary" : ""}`}>
                        {entry.isCurrentUser ? `You (${user?.displayName || "You"})` : (privateMode && !entry.isCurrentUser ? entry.name : entry.name)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{entry.subject}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        {trendIcon(entry.trend)}
                        <span>{entry.delta}</span>
                      </div>
                      <span className="font-bold text-sm text-primary">{entry.xp.toLocaleString()}</span>
                      <span className="text-[10px] text-muted-foreground">XP</span>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
