import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link } from "wouter";
import {
  Flame, Star, Trophy, Target, Zap, Lock, Crown, Shield,
  ArrowRight, TrendingUp, Users, Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";


async function api(url: string, opts?: RequestInit) {
  const res = await fetch(`/api${url}`, {
    headers: { "Content-Type": "application/json", ...(opts?.headers || {}) },
    ...opts,
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const RANK_CONFIG: Record<string, { color: string; bg: string; icon: any }> = {
  Bronze:   { color: "#92400E", bg: "#FEF3C7", icon: Shield },
  Silver:   { color: "#374151", bg: "#F3F4F6", icon: Shield },
  Gold:     { color: "#B45309", bg: "#FEF3C7", icon: Star },
  Platinum: { color: "#4B5563", bg: "#E5E7EB", icon: Crown },
  Diamond:  { color: "#1D4ED8", bg: "#EFF6FF", icon: Sparkles },
  Apex:     { color: "#7C3AED", bg: "#EDE9FE", icon: Crown },
};

const UNLOCKABLES = [
  { id: 1, name: "Dark Scholar", type: "theme", xpRequired: 500, icon: "🌙" },
  { id: 2, name: "Ocean Flow", type: "theme", xpRequired: 1000, icon: "🌊" },
  { id: 3, name: "Gold Frame", type: "frame", xpRequired: 800, icon: "🏅" },
  { id: 4, name: "Diamond Frame", type: "frame", xpRequired: 2000, icon: "💎" },
  { id: 5, name: "Streak Master", type: "badge", xpRequired: 1500, icon: "🔥" },
  { id: 6, name: "Top Scholar", type: "badge", xpRequired: 5000, icon: "🎓" },
];

const SUBJECT_COLORS = ["#0D9488", "#2563EB", "#7C3AED", "#DB2777", "#D97706", "#059669"];

function XpBar({ xp, level }: { xp: number; level: number }) {
  const prevLevelXp = Math.pow(level - 1 > 0 ? level - 1 : 0, 2) * 100;
  const nextLevelXp = Math.pow(level, 2) * 100;
  const progress = nextLevelXp > prevLevelXp
    ? ((xp - prevLevelXp) / (nextLevelXp - prevLevelXp)) * 100
    : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1.5">
        <span>{xp.toLocaleString()} XP</span>
        <span>Level {level + 1} at {nextLevelXp.toLocaleString()} XP</span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(progress, 100)}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: "linear-gradient(90deg, #0D9488, #14B8A6)" }}
        />
      </div>
    </div>
  );
}

export default function Ascend() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["ascend", "profile"],
    queryFn: () => api("/ascend/profile"),
  });
  const { data: quests } = useQuery({
    queryKey: ["ascend", "quests"],
    queryFn: () => api("/ascend/quests"),
  });
  const { data: leaderboard } = useQuery({
    queryKey: ["ascend", "leaderboard"],
    queryFn: () => api("/ascend/leaderboard"),
  });

  const earnXpMutation = useMutation({
    mutationFn: (source: string) => api("/ascend/earn-xp", {
      method: "POST",
      body: JSON.stringify({ source }),
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ascend", "profile"] });
      toast({ title: `+${data.xpAwarded} XP earned!`, description: `Source: ${data.source}` });
    },
    onError: () => toast({ title: "Failed to earn XP", variant: "destructive" }),
  });

  const rank = profile?.rank || "Bronze";
  const rankCfg = RANK_CONFIG[rank] || RANK_CONFIG.Bronze;
  const RankIcon = rankCfg.icon;
  const level = profile?.level || 1;
  const xp = profile?.xp || 0;
  const subjectXp: Record<string, number> = (profile?.subjectXp as any) ?? {};
  const maxSubjectXp = Math.max(...Object.values(subjectXp), 1);

  return (
    <div className="min-h-screen bg-[#F8FAFB] px-4 py-6 max-w-5xl mx-auto" style={{ fontFamily: "Inter, sans-serif" }}>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-orange-50 flex items-center justify-center">
            <Flame className="h-4.5 w-4.5 text-orange-600" style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900">Ascend</h1>
            <p className="text-xs text-gray-500">Your academic journey to mastery</p>
          </div>
        </div>
      </motion.div>

      {profileLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl lg:col-span-2" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Profile Card */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <div className="bg-card rounded-2xl border border-border shadow-sm p-5 h-full">
              {/* Avatar + rank */}
              <div className="flex items-center gap-4 mb-5">
                <div className="relative">
                  <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-md"
                    style={{ background: "linear-gradient(135deg, #0D9488, #0F766E)" }}>
                    {level}
                  </div>
                  <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full flex items-center justify-center border-2 border-white shadow-sm"
                    style={{ background: rankCfg.bg }}>
                    <RankIcon className="h-3 w-3" style={{ color: rankCfg.color }} />
                  </div>
                </div>
                <div>
                  <p className="text-lg font-black text-gray-900">Level {level}</p>
                  <Badge className="text-xs border-0 font-bold mt-0.5"
                    style={{ background: rankCfg.bg, color: rankCfg.color }}>
                    {rank}
                  </Badge>
                </div>
              </div>

              {/* XP bar */}
              <XpBar xp={xp} level={level} />

              {/* Stats */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="bg-orange-50 rounded-xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Flame className="h-3.5 w-3.5 text-orange-500" />
                    <span className="text-lg font-black text-orange-700">{profile?.streak || 0}</span>
                  </div>
                  <p className="text-[10px] text-orange-600 font-medium">Day streak</p>
                </div>
                <div className="bg-teal-50 rounded-xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Zap className="h-3.5 w-3.5 text-teal-600" />
                    <span className="text-lg font-black text-teal-700">{xp.toLocaleString()}</span>
                  </div>
                  <p className="text-[10px] text-teal-600 font-medium">Total XP</p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <p className="text-xs font-bold text-gray-500 uppercase">Archetype</p>
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-xl">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-semibold text-gray-800">{profile?.archetype || "Explorer"}</span>
                </div>
              </div>

              <Link href="/peak-rankings">
                <Button className="w-full mt-4 gap-2 rounded-xl text-xs h-9" variant="outline">
                  <Users className="h-3.5 w-3.5" /> View Leaderboard <ArrowRight className="h-3 w-3 ml-auto" />
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Right column: tabs */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="quests">
              <TabsList className="grid grid-cols-4 mb-4 rounded-xl h-auto p-1">
                <TabsTrigger value="quests" className="text-xs py-2">Quests</TabsTrigger>
                <TabsTrigger value="subjects" className="text-xs py-2">Subjects</TabsTrigger>
                <TabsTrigger value="leaderboard" className="text-xs py-2">Rankings</TabsTrigger>
                <TabsTrigger value="unlockables" className="text-xs py-2">Unlocks</TabsTrigger>
              </TabsList>

              <TabsContent value="quests">
                <AnimatePresence mode="wait">
                  <motion.div key="quests" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-card rounded-2xl border border-border shadow-sm p-5">
                    <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Target className="h-4 w-4 text-teal-600" /> Today's Quests
                    </h3>
                    {!quests || quests.length === 0 ? (
                      <div className="text-center py-10">
                        <Target className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                        <p className="text-sm text-gray-500">No quests yet — check back later!</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {quests.map((q: any, i: number) => (
                          <motion.div key={q.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.06 }}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm text-gray-900">{q.title}</p>
                              {q.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{q.description}</p>}
                            </div>
                            <div className="flex items-center gap-2 ml-3">
                              <Badge className="text-xs bg-teal-50 text-teal-700 border-teal-100 border-0">+{q.xpReward} XP</Badge>
                              <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg"
                                onClick={() => earnXpMutation.mutate("manual")}>
                                Claim
                              </Button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                    <div className="mt-4 pt-4 border-t border-gray-50">
                      <p className="text-xs font-bold text-gray-500 uppercase mb-3">Quick Earn XP</p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { source: "flashcard_review", label: "Review Flashcards", xp: 15 },
                          { source: "focus_session", label: "Start Focus Session", xp: 30 },
                          { source: "revision_task", label: "Revision Task", xp: 50 },
                        ].map(({ source, label, xp: xpAmt }) => (
                          <Button key={source} variant="outline" size="sm" className="text-xs h-8 gap-1.5 rounded-xl"
                            onClick={() => earnXpMutation.mutate(source)}
                            disabled={earnXpMutation.isPending}>
                            <Zap className="h-3 w-3 text-teal-600" /> {label} (+{xpAmt})
                          </Button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </TabsContent>

              <TabsContent value="subjects">
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-card rounded-2xl border border-border shadow-sm p-5">
                  <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-teal-600" /> Subject XP Progress
                  </h3>
                  {Object.keys(subjectXp).length === 0 ? (
                    <div className="text-center py-10">
                      <TrendingUp className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                      <p className="text-sm text-gray-500">Earn XP in subjects to see your progress here.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(subjectXp).map(([subjectId, subXp], idx) => (
                        <div key={subjectId}>
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className="font-semibold text-gray-800">Subject {subjectId}</span>
                            <span className="text-gray-500">{(subXp as number).toLocaleString()} XP</span>
                          </div>
                          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${((subXp as number) / maxSubjectXp) * 100}%` }}
                              transition={{ duration: 0.8, delay: idx * 0.1, ease: "easeOut" }}
                              className="h-full rounded-full"
                              style={{ background: SUBJECT_COLORS[idx % SUBJECT_COLORS.length] }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              </TabsContent>

              <TabsContent value="leaderboard">
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-card rounded-2xl border border-border shadow-sm p-5">
                  <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-yellow-500" /> Class Rankings
                  </h3>
                  <ScrollArea className="h-72">
                    <div className="space-y-2">
                      {!leaderboard?.leaderboard || leaderboard.leaderboard.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-8">No rankings yet.</p>
                      ) : (
                        leaderboard.leaderboard.map((p: any, idx: number) => (
                          <motion.div key={idx} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.04 }}
                            className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${p.isYou ? "bg-teal-50 border border-teal-100" : "hover:bg-gray-50"}`}>
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                              idx === 0 ? "bg-yellow-400 text-yellow-900" :
                              idx === 1 ? "bg-gray-300 text-gray-700" :
                              idx === 2 ? "bg-orange-300 text-orange-800" :
                              "bg-gray-100 text-gray-500"
                            }`}>
                              {p.rank}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-semibold truncate ${p.isYou ? "text-teal-700" : "text-gray-800"}`}>
                                {p.isYou ? "You" : `Student`} {p.isYou && <span className="text-xs ml-1 text-teal-500">(You)</span>}
                              </p>
                              <p className="text-xs text-gray-400">Level {p.level} · {p.displayRank}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-bold text-gray-900">{p.xp?.toLocaleString()}</p>
                              <p className="text-[10px] text-gray-400">XP</p>
                            </div>
                          </motion.div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </motion.div>
              </TabsContent>

              <TabsContent value="unlockables">
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-card rounded-2xl border border-border shadow-sm p-5">
                  <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Star className="h-4 w-4 text-purple-500" /> Unlockables
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {UNLOCKABLES.map((item) => {
                      const unlocked = xp >= item.xpRequired;
                      return (
                        <motion.div key={item.id} whileHover={unlocked ? { y: -2 } : {}}
                          className={`p-3 rounded-xl border text-center transition-all ${
                            unlocked ? "bg-teal-50 border-teal-100" : "bg-gray-50 border-gray-100 opacity-60"
                          }`}>
                          <div className="text-2xl mb-2">{item.icon}</div>
                          <p className={`text-xs font-bold ${unlocked ? "text-teal-800" : "text-gray-500"}`}>{item.name}</p>
                          <p className="text-[10px] text-gray-400 capitalize mt-0.5">{item.type}</p>
                          {unlocked ? (
                            <span className="text-[10px] text-teal-600 font-semibold mt-1 block">✓ Unlocked</span>
                          ) : (
                            <div className="flex items-center justify-center gap-1 mt-1.5">
                              <Lock className="h-2.5 w-2.5 text-gray-400" />
                              <span className="text-[10px] text-gray-400">{item.xpRequired.toLocaleString()} XP</span>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
    </div>
  );
}
