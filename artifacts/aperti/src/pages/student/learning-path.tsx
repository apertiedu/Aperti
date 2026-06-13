import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen, CheckCircle2, Circle, Lock, ChevronRight, Brain,
  Zap, Target, RefreshCw, FlaskConical, Layers, ArrowRight,
  Sparkles, TrendingUp, Clock,
} from "lucide-react";
import { Link } from "wouter";


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

const STATE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  not_started: { label: "Not Started", color: "text-muted-foreground", bg: "bg-muted/40", icon: Circle },
  introduced: { label: "Introduced", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30", icon: Circle },
  practicing: { label: "Practicing", color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30", icon: Target },
  developing: { label: "Developing", color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/30", icon: TrendingUp },
  mastered: { label: "Mastered", color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30", icon: CheckCircle2 },
  expert: { label: "Expert", color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/30", icon: Zap },
};

export default function LearningPathPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<any>(null);
  const [generating, setGenerating] = useState(false);

  const { data: pathData, isLoading } = useQuery({
    queryKey: ["learning-path"],
    queryFn: () => fetchJSON("/api/learning-path"),
    staleTime: 60_000,
  });

  const { data: nextContent } = useQuery({
    queryKey: ["content-next"],
    queryFn: () => fetchJSON("/api/content/next"),
    staleTime: 30_000,
  });

  const generateMutation = useMutation({
    mutationFn: () => postJSON("/api/learning-path/generate", { pathType: "adaptive" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["learning-path"] }); setGenerating(false); },
  });

  const deliverMutation = useMutation({
    mutationFn: (data: any) => postJSON("/api/content/deliver", data),
  });

  const paths = pathData?.paths ?? [];
  const firstPath = paths[0];
  const nodes: any[] = firstPath?.nodes ?? [];
  const weakTopics: string[] = pathData?.weakTopics ?? [];

  const statesOrder = ["not_started", "introduced", "practicing", "developing", "mastered", "expert"];
  const completedNodes = nodes.filter(n => n.status === "completed" || statesOrder.indexOf(n.masteryState ?? "not_started") >= 4);
  const progress = nodes.length > 0 ? Math.round((completedNodes.length / nodes.length) * 100) : 0;

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
  const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="min-h-screen bg-[#F5F5F5] dark:bg-background p-4 md:p-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Learning Path</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Your personalised adaptive roadmap to mastery</p>
          </div>
          <Button
            variant="outline" size="sm"
            className="gap-2"
            disabled={generateMutation.isPending}
            onClick={() => { setGenerating(true); generateMutation.mutate(); }}
          >
            <RefreshCw className={`h-4 w-4 ${generateMutation.isPending ? "animate-spin" : ""}`} />
            {generateMutation.isPending ? "Generating…" : "Regenerate Path"}
          </Button>
        </div>
      </motion.div>

      {/* Next recommended content */}
      {nextContent?.next && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent shadow-sm">
            <CardContent className="p-4 flex items-center gap-4 flex-wrap">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-primary mb-0.5">Up Next</p>
                <p className="font-semibold truncate">{nextContent.next.title}</p>
                <p className="text-xs text-muted-foreground">{nextContent.next.reason}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />{nextContent.next.estimatedMinutes}m
                </span>
                <Link href={nextContent.next.actionUrl ?? "/revisit"}>
                  <Button size="sm" className="gap-1 text-xs"
                    onClick={() => deliverMutation.mutate({ contentType: nextContent.next.type, topicName: nextContent.next.title })}>
                    Start <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main path */}
        <div className="lg:col-span-2">
          {/* Progress overview */}
          {!isLoading && nodes.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
              <Card className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold">Overall Mastery Progress</span>
                    <span className="text-sm font-bold text-primary">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-3" />
                  <p className="text-xs text-muted-foreground mt-1.5">{completedNodes.length} of {nodes.length} topics mastered</p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
          ) : nodes.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="shadow-sm">
                <CardContent className="p-8 text-center">
                  <Brain className="h-12 w-12 text-primary/30 mx-auto mb-3" />
                  <p className="font-semibold text-lg mb-1">No learning path yet</p>
                  <p className="text-sm text-muted-foreground mb-4">Generate your personalised adaptive path based on your strengths and weaknesses.</p>
                  <Button onClick={() => { setGenerating(true); generateMutation.mutate(); }} disabled={generateMutation.isPending} className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    {generateMutation.isPending ? "Generating…" : "Generate My Path"}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
              {nodes.map((node, idx) => {
                const stateKey = node.masteryState ?? (node.status === "completed" ? "mastered" : node.status === "in_progress" ? "practicing" : "not_started");
                const cfg = STATE_CONFIG[stateKey] ?? STATE_CONFIG.not_started;
                const Icon = cfg.icon;
                const isWeak = weakTopics.includes(node.title);
                const isSelected = selected?.id === node.id;

                return (
                  <motion.div key={node.id} variants={item}>
                    <div
                      className={`rounded-xl border transition-all cursor-pointer ${cfg.bg} ${isSelected ? "border-primary shadow-md" : "border-border hover:border-primary/40"}`}
                      onClick={() => setSelected(isSelected ? null : node)}
                    >
                      <div className="p-4 flex items-center gap-4">
                        {/* Step number */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${cfg.color} bg-white/60 dark:bg-white/10`}>
                          {idx + 1}
                        </div>
                        {/* State icon */}
                        <Icon className={`h-5 w-5 shrink-0 ${cfg.color}`} />
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-sm">{node.title}</p>
                            {isWeak && <Badge variant="destructive" className="text-[10px] h-4">Weak Area</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                            <Badge variant="outline" className={`text-[10px] h-4 ${cfg.color}`}>{cfg.label}</Badge>
                            {node.estimatedMinutes && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{node.estimatedMinutes}m</span>}
                          </p>
                        </div>
                        {/* Confidence bar */}
                        <div className="w-20 hidden sm:block">
                          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                            <span>Confidence</span>
                            <span>{node.confidenceScore ?? 0}%</span>
                          </div>
                          <Progress value={node.confidenceScore ?? 0} className="h-1.5" />
                        </div>
                        <ChevronRight className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isSelected ? "rotate-90" : ""}`} />
                      </div>

                      {/* Expanded detail */}
                      <AnimatePresence>
                        {isSelected && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 border-t border-border/50 mt-0 pt-3 flex flex-wrap gap-2">
                              <Link href={`/revisit?topic=${encodeURIComponent(node.title)}`}>
                                <Button size="sm" variant="outline" className="gap-1 text-xs h-7">
                                  <Layers className="h-3 w-3" /> Revise
                                </Button>
                              </Link>
                              <Link href={`/micro-assessment?topic=${encodeURIComponent(node.title)}`}>
                                <Button size="sm" className="gap-1 text-xs h-7">
                                  <Target className="h-3 w-3" /> Practice
                                </Button>
                              </Link>
                              <Link href="/simverse">
                                <Button size="sm" variant="outline" className="gap-1 text-xs h-7">
                                  <FlaskConical className="h-3 w-3" /> Simulate
                                </Button>
                              </Link>
                              <Link href={`/mentor?topic=${encodeURIComponent(node.title)}`}>
                                <Button size="sm" variant="outline" className="gap-1 text-xs h-7">
                                  <Brain className="h-3 w-3" /> Ask Mentor
                                </Button>
                              </Link>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    {/* Arrow connector */}
                    {idx < nodes.length - 1 && (
                      <div className="flex justify-center my-1">
                        <ChevronRight className="h-4 w-4 text-muted-foreground rotate-90" />
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Mastery legend */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm">Mastery States</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {Object.entries(STATE_CONFIG).map(([key, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <Icon className={`h-4 w-4 ${cfg.color}`} />
                    <span className={cfg.color}>{cfg.label}</span>
                    <span className="text-muted-foreground ml-auto">{nodes.filter(n => (n.masteryState ?? "not_started") === key).length}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Weak topics */}
          {weakTopics.length > 0 && (
            <Card className="shadow-sm border-amber-200 dark:border-amber-800">
              <CardHeader className="pb-2 px-4 pt-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="h-4 w-4 text-amber-600" />
                  <span className="text-amber-700 dark:text-amber-400">Weak Areas</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-1.5">
                {weakTopics.slice(0, 5).map(t => (
                  <div key={t} className="flex items-center justify-between text-xs">
                    <span className="truncate">{t}</span>
                    <Link href={`/revisit?topic=${encodeURIComponent(t)}`}>
                      <Button size="sm" variant="ghost" className="h-5 text-[10px] px-2 text-amber-600">Revise</Button>
                    </Link>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Quick links */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm">Quick Access</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 grid grid-cols-2 gap-2">
              {[
                { href: "/micro-assessment", label: "Practice", icon: Target, color: "text-primary" },
                { href: "/revisit", label: "Revisit", icon: Layers, color: "text-blue-500" },
                { href: "/flashcards", label: "Flashcards", icon: BookOpen, color: "text-green-500" },
                { href: "/mentor", label: "Mentor", icon: Brain, color: "text-purple-500" },
              ].map(({ href, label, icon: Icon, color }) => (
                <Link key={href} href={href}>
                  <button className="w-full flex flex-col items-center gap-1 p-2.5 rounded-xl border hover:border-primary/40 hover:bg-primary/5 transition-colors text-xs">
                    <Icon className={`h-4 w-4 ${color}`} />
                    <span>{label}</span>
                  </button>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
