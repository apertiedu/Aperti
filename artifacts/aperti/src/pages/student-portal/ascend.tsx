import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Flame, Star, Trophy, Target, ArrowUp, Zap } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";
const token = () => localStorage.getItem("aperti_token");

async function fetchJSON(url: string, options?: RequestInit) {
  const res = await fetch(`${API}${url}`, {
    headers: { Authorization: `Bearer ${token()}`, ...(options?.headers || {}) },
    ...options,
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

export default function Ascend() {
  const queryClient = useQueryClient();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["ascend", "profile"],
    queryFn: () => fetchJSON("/ascend/profile"),
  });

  const { data: quests } = useQuery({
    queryKey: ["ascend", "quests"],
    queryFn: () => fetchJSON("/ascend/quests"),
  });

  const { data: leaderboard } = useQuery({
    queryKey: ["ascend", "leaderboard"],
    queryFn: () => fetchJSON("/ascend/leaderboard"),
  });

  const xpForNextLevel = (Math.floor((profile?.xp || 0) / 500) + 1) * 500;
  const xpProgress = profile ? ((profile.xp % 500) / 500) * 100 : 0;

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold">Ascend<span className="text-primary">™</span></h1>
        <p className="text-muted-foreground">Your journey to mastery.</p>
      </motion.div>

      {profileLoading ? (
        <div className="grid gap-4"><Skeleton className="h-48 rounded-xl" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <Card className="card-hover lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Flame className="h-5 w-5 text-primary" /> Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary">
                  {profile?.level || 1}
                </div>
                <div>
                  <p className="text-lg font-semibold">Level {profile?.level || 1}</p>
                  <Badge variant="secondary">{profile?.rank || "Bronze"}</Badge>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>XP</span><span>{profile?.xp || 0} / {xpForNextLevel}</span>
                </div>
                <Progress value={xpProgress} className="h-2" />
              </div>
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1"><Flame className="h-4 w-4 text-orange-500" /> Streak</span>
                <span className="font-medium">{profile?.streak || 0} days</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1"><Trophy className="h-4 w-4 text-yellow-500" /> Archetype</span>
                <span className="font-medium">{profile?.archetype || "Explorer"}</span>
              </div>
            </CardContent>
          </Card>

          {/* Quests & Leaderboard */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" /> Today's Quests</CardTitle>
                <CardDescription>Complete these to earn XP</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {quests?.length > 0 ? quests.map((q: any) => (
                    <div key={q.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{q.title}</p>
                        <p className="text-xs text-muted-foreground">{q.description}</p>
                      </div>
                      <Badge className="bg-primary text-primary-foreground">+{q.xpReward} XP</Badge>
                    </div>
                  )) : (
                    <p className="text-muted-foreground text-sm">No quests yet. Check back later!</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Star className="h-5 w-5 text-primary" /> Leaderboard</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {leaderboard?.map((p: any, idx: number) => (
                      <div key={p.id} className="flex items-center justify-between p-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{idx + 1}.</span>
                          <span>{p.studentAccountId}</span>
                        </div>
                        <Badge variant="secondary">{p.xp} XP</Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
