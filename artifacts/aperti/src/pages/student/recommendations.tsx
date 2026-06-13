import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles, ThumbsUp, ThumbsDown, ArrowRight, Brain, Target,
  BookOpen, Clock, Zap, Layers, FlaskConical, AlertTriangle,
} from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";


async function fetchJSON(url: string) {
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

async function postJSON(url: string, body: unknown) {
  const r = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

const TYPE_CONFIG: Record<string, { icon: typeof Sparkles; color: string; bg: string; label: string }> = {
  sprint_revision: { icon: Zap, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30", label: "Sprint" },
  improve_mastery: { icon: Target, color: "text-primary", bg: "bg-primary/5", label: "Mastery" },
  weak_topic: { icon: Brain, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30", label: "Revision" },
  homework: { icon: BookOpen, color: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-950/30", label: "Assignment" },
  focus_session: { icon: Clock, color: "text-teal-600", bg: "bg-teal-50 dark:bg-teal-950/30", label: "Focus" },
  simulation: { icon: FlaskConical, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/30", label: "Simulation" },
  flashcard: { icon: Layers, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/30", label: "Flashcards" },
};

export default function RecommendationHub() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["recommendations"],
    queryFn: () => fetchJSON("/api/recommendations"),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const feedbackMutation = useMutation({
    mutationFn: (body: any) => postJSON("/api/recommendations/feedback", body),
    onSuccess: (_, vars) => {
      if (vars.rating === "not_helpful") setDismissed(prev => new Set([...prev, vars.resourceId]));
      toast({ title: vars.rating === "helpful" ? "Thanks for the feedback!" : "Got it — we'll improve suggestions", description: undefined });
      qc.invalidateQueries({ queryKey: ["recommendations"] });
    },
  });

  const recommendations = (data?.recommendations ?? []).filter((r: any) => !dismissed.has(r.id));

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } };
  const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 260, damping: 20 } } };

  return (
    <div className="min-h-screen bg-[#F5F5F5] dark:bg-background p-4 md:p-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Sparkles className="h-7 w-7 text-primary" /> Recommendations
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Personalised suggestions based on your performance and upcoming events
            </p>
          </div>
          <Badge variant="secondary" className="text-xs mt-1">{recommendations.length} suggestions</Badge>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="space-y-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : recommendations.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="shadow-sm">
            <CardContent className="p-10 text-center">
              <Sparkles className="h-12 w-12 text-primary/30 mx-auto mb-3" />
              <p className="font-semibold text-lg">All caught up!</p>
              <p className="text-sm text-muted-foreground mt-1">No urgent recommendations right now. Keep up the great work.</p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
          {recommendations.map((rec: any) => {
            const cfg = TYPE_CONFIG[rec.type] ?? TYPE_CONFIG.focus_session;
            const Icon = cfg.icon;
            return (
              <motion.div key={rec.id} variants={item}>
                <Card className={`shadow-sm border-l-4 ${rec.urgent ? "border-l-destructive" : "border-l-primary/30"} hover:shadow-md transition-shadow`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${cfg.bg}`}>
                        <Icon className={`h-5 w-5 ${cfg.color}`} />
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-sm">{rec.title}</p>
                            {rec.urgent && (
                              <Badge variant="destructive" className="text-[10px] h-4 gap-1">
                                <AlertTriangle className="h-3 w-3" /> Urgent
                              </Badge>
                            )}
                            <Badge variant="outline" className={`text-[10px] h-4 ${cfg.color}`}>{cfg.label}</Badge>
                          </div>
                          {rec.daysLeft !== undefined && rec.daysLeft !== null && (
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {rec.daysLeft === 0 ? "Today" : `${rec.daysLeft}d left`}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{rec.reason}</p>
                        {rec.masteryState && (
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] text-muted-foreground">Mastery:</span>
                            <Badge variant="secondary" className="text-[10px] h-4 capitalize">{rec.masteryState}</Badge>
                            <span className="text-[10px] text-muted-foreground">Confidence: {rec.confidenceScore}%</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 px-2 text-muted-foreground hover:text-emerald-600"
                          onClick={() => feedbackMutation.mutate({ recommendationType: rec.type, resourceId: rec.id, rating: "helpful" })}
                        >
                          <ThumbsUp className="h-3.5 w-3.5 mr-1" /> Helpful
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 px-2 text-muted-foreground hover:text-destructive"
                          onClick={() => feedbackMutation.mutate({ recommendationType: rec.type, resourceId: rec.id, rating: "not_helpful" })}
                        >
                          <ThumbsDown className="h-3.5 w-3.5 mr-1" /> Not helpful
                        </Button>
                      </div>
                      <Link href={rec.actionUrl ?? "/"}>
                        <Button size="sm" className="gap-1 text-xs h-7">
                          {rec.actionLabel ?? "Start"} <ArrowRight className="h-3 w-3" />
                        </Button>
                      </Link>
                    </div>
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
