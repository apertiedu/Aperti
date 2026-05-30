import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, BookOpen, Zap, Target, ArrowRight } from "lucide-react";
import { Link } from "wouter";

const API = import.meta.env.VITE_API_URL || "";

async function fetchJSON(url: string) {
  const token = localStorage.getItem("aperti_token");
  const res = await fetch(`${API}${url}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

interface PlanItem {
  date: string;
  topic: string;
  durationMinutes: number;
  resources: { questionCount: number; flashcardDeck?: string };
}

export default function Revisit() {
  const { data, isLoading } = useQuery<{ plan: PlanItem[]; weakTopics: string[] }>({
    queryKey: ["revisit", "plan"],
    queryFn: () => fetchJSON("/revisit/plan"),
  });

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold">Revisit<span className="text-primary">™</span></h1>
        <p className="text-muted-foreground">Your daily revision path, crafted for you.</p>
      </motion.div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Today's focus */}
          {data?.plan
            ?.filter((item) => item.date === today)
            .map((item) => (
              <motion.div key={item.date} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="card-hover border-primary/50 bg-primary/5">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Calendar className="h-5 w-5 text-primary" /> Today’s Focus
                        </CardTitle>
                        <CardDescription>{item.topic}</CardDescription>
                      </div>
                      <Badge className="bg-primary text-primary-foreground">{item.durationMinutes} min</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-3">
                      <Link href={`/my-cardstack?deck=${encodeURIComponent(item.resources.flashcardDeck || "")}`}>
                        <Button variant="outline" size="sm">
                          <Zap className="h-4 w-4 mr-1" /> Flashcards
                        </Button>
                      </Link>
                      {item.resources.questionCount > 0 && (
                        <Link href="/mentor">
                          <Button variant="outline" size="sm">
                            <BookOpen className="h-4 w-4 mr-1" /> Practice ({item.resources.questionCount} Qs)
                          </Button>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}

          {/* Weekly Plan */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" /> Weekly Plan
                </CardTitle>
                <CardDescription>Next 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data?.plan?.map((day) => (
                    <div key={day.date} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium">{day.topic}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(day.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · {day.durationMinutes} min
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Link href="/my-cardstack">
                          <Button variant="ghost" size="sm">Cards</Button>
                        </Link>
                        <Link href="/mentor">
                          <Button variant="ghost" size="sm">Practice</Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Weak Topics Overview */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="card-hover">
              <CardHeader>
                <CardTitle>Your Weak Topics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {data?.weakTopics?.map((topic) => (
                    <Badge key={topic} variant="secondary">
                      {topic}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}
    </div>
  );
}
