import { apiFetch } from "@/lib/api";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Star, Zap, Crown, Lock, Users, X, PartyPopper } from "lucide-react";
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

/* ── Canvas confetti ─────────────────────────────────────────────────── */
function useConfetti() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number>(0);

  const fire = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const COLORS = ["#0D9488","#14B8A6","#F59E0B","#8B5CF6","#EF4444","#3B82F6","#10B981"];
    const particles: {
      x: number; y: number; vx: number; vy: number;
      color: string; r: number; alpha: number; rot: number; rSpeed: number;
    }[] = Array.from({ length: 120 }, () => ({
      x: canvas.width / 2 + (Math.random() - 0.5) * 400,
      y: canvas.height * 0.35,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 16 - 4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      r: Math.random() * 5 + 3,
      alpha: 1,
      rot: Math.random() * Math.PI * 2,
      rSpeed: (Math.random() - 0.5) * 0.2,
    }));

    let frame = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.4;
        p.rot += p.rSpeed;
        p.alpha = Math.max(0, p.alpha - 0.012);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
        ctx.restore();
      });
      frame++;
      if (frame < 120) animRef.current = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    cancelAnimationFrame(animRef.current);
    draw();
  }, []);

  return { canvasRef, fire };
}

/* ── Achievement Unlock Modal ────────────────────────────────────────── */
function UnlockModal({ badges, onClose }: { badges: Achievement[]; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const badge = badges[idx];
  if (!badge) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.7, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        onClick={e => e.stopPropagation()}
        className="relative bg-card rounded-3xl shadow-2xl p-8 max-w-xs w-full text-center overflow-hidden"
      >
        {/* Glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-50 to-orange-50 opacity-60" />
        <div className="relative">
          <motion.div
            animate={{ scale: [1, 1.12, 1], rotate: [0, -8, 8, 0] }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-7xl mb-4 inline-block"
          >
            {badge.icon}
          </motion.div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold mb-3">
            <PartyPopper size={12} /> Achievement Unlocked!
          </div>
          <h2 className="text-xl font-extrabold text-gray-900 mb-1">{badge.name}</h2>
          <p className="text-sm text-gray-500 mb-4">{badge.desc}</p>
          <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white text-sm font-bold shadow-md">
            <Zap size={14} />+{badge.xp} XP earned!
          </div>
          <div className="flex gap-2 mt-6">
            {idx < badges.length - 1 ? (
              <Button onClick={() => setIdx(i => i + 1)} className="flex-1 bg-gray-900 hover:bg-gray-800 text-white rounded-xl">
                Next ({idx + 1}/{badges.length})
              </Button>
            ) : (
              <Button onClick={onClose} className="flex-1 bg-gray-900 hover:bg-gray-800 text-white rounded-xl">
                Awesome!
              </Button>
            )}
          </div>
          {badges.length > 1 && (
            <div className="flex justify-center gap-1.5 mt-3">
              {badges.map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full transition-all ${i === idx ? "bg-amber-500 w-4" : "bg-gray-200"}`} />
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Main Component ──────────────────────────────────────────────────── */
export default function AchievementsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<AchievementData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myId, setMyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [tab, setTab] = useState<"achievements" | "leaderboard">("achievements");
  const [newBadges, setNewBadges] = useState<Achievement[]>([]);
  const { canvasRef, fire: fireConfetti } = useConfetti();

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
      if (newlyEarned?.length > 0) {
        await load();
        const earned = data?.achievements.filter(a => newlyEarned.includes(a.name)) ?? [];
        if (earned.length > 0) {
          setNewBadges(earned);
          fireConfetti();
        } else {
          toast({ title: `🎉 ${newlyEarned.length} new achievement${newlyEarned.length > 1 ? "s" : ""} unlocked!`, description: newlyEarned.join(", ") });
          fireConfetti();
        }
      } else {
        toast({ title: "All up to date!", description: "Keep studying to unlock more achievements" });
      }
    }
    setChecking(false);
  };

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="h-32 rounded-2xl bg-gray-100 animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />)}
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
      {/* Confetti canvas — covers full viewport, pointer-events-none */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 z-[999] pointer-events-none"
        style={{ width: "100vw", height: "100vh" }}
      />

      {/* Achievement unlock modal */}
      <AnimatePresence>
        {newBadges.length > 0 && (
          <UnlockModal badges={newBadges} onClose={() => { setNewBadges([]); load(); }} />
        )}
      </AnimatePresence>

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
        <Card className={`border-0 bg-gradient-to-br ${levelGrad || "from-teal-400 to-teal-600"} text-white shadow-lg overflow-hidden`}>
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

      {/* Achievements tab */}
      {tab === "achievements" && (
        <div className="space-y-5">
          {earned.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Star className="h-3.5 w-3.5" />Earned ({earned.length})
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {earned.map((ach, i) => (
                  <motion.div key={ach.key}
                    initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.06, type: "spring", stiffness: 300 }}>
                    <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 overflow-hidden">
                      <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
                      <CardContent className="p-3 text-center space-y-1.5">
                        <motion.div
                          className="text-3xl"
                          whileHover={{ scale: 1.2, rotate: [0, -10, 10, 0] }}
                          transition={{ duration: 0.4 }}
                        >
                          {ach.icon}
                        </motion.div>
                        <p className="text-xs font-bold text-foreground">{ach.name}</p>
                        <p className="text-[10px] text-muted-foreground leading-tight">{ach.desc}</p>
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] gap-0.5">
                          <Zap className="h-2.5 w-2.5" />+{ach.xp} XP
                        </Badge>
                        {ach.earnedAt && (
                          <p className="text-[9px] text-muted-foreground/60">
                            {new Date(ach.earnedAt).toLocaleDateString()}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

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

          {earned.length === 0 && locked.length === 0 && (
            <div className="text-center py-16">
              <Trophy className="h-12 w-12 mx-auto mb-3 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">No achievements found</p>
              <p className="text-xs text-muted-foreground mt-1">Click "Check Progress" to discover yours</p>
            </div>
          )}
        </div>
      )}

      {/* Leaderboard tab */}
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
                <motion.div key={entry.student_id}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04 }}>
                  <Card className={`border overflow-hidden ${isMe ? "border-primary bg-primary/5" : "border-border/50"}`}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="w-8 text-center font-bold text-lg shrink-0">
                        {idx < 3 ? RANK_BADGES[idx] : <span className="text-sm text-muted-foreground">#{entry.rank}</span>}
                      </div>
                      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${entryGrad || "from-gray-300 to-gray-400"} flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0`}>
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
