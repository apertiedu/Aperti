import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Play, Pause, RotateCcw, Coffee, Brain, CheckCircle2,
  TrendingUp, Zap, Flame, BarChart3, Clock, Target,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";


async function fetchJSON(url: string) {
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

async function startSessionAPI(mode: string, durationMinutes: number): Promise<number | null> {
  try {
    const res = await fetch("/api/focus-sessions", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, durationMinutes }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.session?.id ?? null;
  } catch { return null; }
}

async function completeSessionAPI(sessionId: number, durationMinutes: number, mode: string, distractionsCount: number): Promise<any> {
  try {
    const res = await fetch(`/api/focus-sessions/${sessionId}/complete`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durationMinutes, mode, distractionsCount }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

type Phase = "work" | "break" | "idle";

const PRESETS = [
  { label: "Classic (25/5)", work: 25, brk: 5, mode: "classic" },
  { label: "Deep (50/10)", work: 50, brk: 10, mode: "deep" },
  { label: "Sprint (15/3)", work: 15, brk: 3, mode: "sprint" },
  { label: "Power (90/20)", work: 90, brk: 20, mode: "power" },
];

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function ProductivityRing({ score, size = 100 }: { score: number; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const color = score >= 80 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth={6} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color}
        strokeWidth={6} strokeLinecap="round" strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ * (1 - score / 100) }}
        transition={{ duration: 1, ease: "easeOut" }}
      />
    </svg>
  );
}

export default function FocusZoneV2() {
  const [preset, setPreset] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [running, setRunning] = useState(false);
  const [secsLeft, setSecsLeft] = useState(PRESETS[0].work * 60);
  const [sessions, setSessions] = useState(0);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [distractions, setDistractions] = useState(0);
  const [lastSessionResult, setLastSessionResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"timer" | "analytics">("timer");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: analyticsData } = useQuery({
    queryKey: ["focus-analytics"],
    queryFn: () => fetchJSON("/api/focus-analytics"),
    staleTime: 60_000,
    enabled: activeTab === "analytics",
  });

  const { data: nextItem } = useQuery({
    queryKey: ["content-next"],
    queryFn: () => fetchJSON("/api/content/next"),
    staleTime: 60_000,
  });

  // Track tab visibility to count distractions
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && phase === "work" && running) {
        setDistractions(d => d + 1);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [phase, running]);

  const totalSecs = phase === "break" ? PRESETS[preset].brk * 60 : PRESETS[preset].work * 60;
  const progress = secsLeft / totalSecs;
  const circumference = 2 * Math.PI * 110;

  const startWork = useCallback(async () => {
    const dur = PRESETS[preset].work;
    setPhase("work"); setSecsLeft(dur * 60); setRunning(true); setDistractions(0);
    const id = await startSessionAPI(PRESETS[preset].mode, dur);
    setSessionId(id);
  }, [preset]);

  const startBreak = useCallback(() => {
    setPhase("break"); setSecsLeft(PRESETS[preset].brk * 60); setRunning(true);
  }, [preset]);

  const reset = useCallback(() => {
    setRunning(false); setPhase("idle");
    setSecsLeft(PRESETS[preset].work * 60); setSessionId(null); setDistractions(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [preset]);

  const handleWorkComplete = useCallback(async () => {
    setSessions(s => s + 1);
    if (sessionId) {
      const result = await completeSessionAPI(sessionId, PRESETS[preset].work, PRESETS[preset].mode, distractions);
      setSessionId(null);
      setLastSessionResult(result);
      qc.invalidateQueries({ queryKey: ["focus-analytics"] });
      qc.invalidateQueries({ queryKey: ["focus-coach", "goals"] });
      qc.invalidateQueries({ queryKey: ["student", "home-summary"] });
      const productivity = result?.productivityScore ?? 0;
      toast({
        title: "Session complete! 🎉",
        description: `Productivity: ${productivity}% · +${result?.xpEarned ?? 0} XP${distractions > 0 ? ` · ${distractions} distraction${distractions !== 1 ? "s" : ""} detected` : ""}`,
      });
    }
  }, [sessionId, preset, distractions, qc, toast]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            setRunning(false);
            if (phase === "work") handleWorkComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, phase, handleWorkComplete]);

  useEffect(() => {
    if (phase === "idle") setSecsLeft(PRESETS[preset].work * 60);
  }, [preset, phase]);

  const phaseColor = phase === "work" ? "hsl(var(--primary))" : phase === "break" ? "hsl(199 89% 48%)" : "hsl(var(--muted-foreground))";
  const phaseBg = phase === "work" ? "bg-primary/5" : phase === "break" ? "bg-sky-50 dark:bg-sky-950/30" : "bg-background";

  // Build analytics charts
  const byDayEntries = Object.entries(analyticsData?.byDay ?? {}).sort(([a], [b]) => a.localeCompare(b)).slice(-14);
  const studyChartData = byDayEntries.map(([date, stats]: [string, any]) => ({
    date: date.slice(5), minutes: stats.minutes, productivity: stats.productivity,
  }));

  const byHourEntries = Object.entries(analyticsData?.byHour ?? {});
  const hourData = Array.from({ length: 24 }, (_, h) => ({
    hour: `${h}:00`, sessions: (analyticsData?.byHour?.[h] ?? 0),
  })).filter(d => d.sessions > 0);

  return (
    <div className={`min-h-screen transition-colors duration-500 ${activeTab === "timer" ? phaseBg : "bg-[#F5F5F5] dark:bg-background"} p-4 md:p-6`}>
      {/* Tab switcher */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">FocusZone</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Distraction-free deep work with productivity tracking</p>
        </div>
        <div className="flex gap-1.5 rounded-xl border p-1 bg-muted/30">
          <Button size="sm" variant={activeTab === "timer" ? "default" : "ghost"} className="h-7 text-xs gap-1" onClick={() => setActiveTab("timer")}>
            <Clock className="h-3 w-3" /> Timer
          </Button>
          <Button size="sm" variant={activeTab === "analytics" ? "default" : "ghost"} className="h-7 text-xs gap-1" onClick={() => setActiveTab("analytics")}>
            <BarChart3 className="h-3 w-3" /> Analytics
          </Button>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {activeTab === "timer" ? (
          <motion.div key="timer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-6">
            {/* Next task hint */}
            {nextItem?.next && phase === "idle" && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
                  <Target className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-primary">Recommended task</p>
                    <p className="text-xs truncate">{nextItem.next.title}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Circular timer */}
            <div className="relative">
              <svg width="260" height="260" className="rotate-[-90deg]">
                <circle cx="130" cy="130" r="110" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
                <motion.circle
                  cx="130" cy="130" r="110" fill="none" stroke={phaseColor}
                  strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference}
                  animate={{ strokeDashoffset: circumference * (1 - progress) }}
                  transition={{ duration: 0.5 }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <AnimatePresence mode="wait">
                  <motion.span key={secsLeft}
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }} transition={{ duration: 0.15 }}
                    className="text-5xl font-bold font-mono tabular-nums" style={{ color: phaseColor }}>
                    {formatTime(secsLeft)}
                  </motion.span>
                </AnimatePresence>
                <Badge variant="outline" className="mt-2 text-xs capitalize" style={{ borderColor: phaseColor, color: phaseColor }}>
                  {phase === "idle" ? "Ready" : phase === "work" ? "Focus" : "Break"}
                </Badge>
                {phase === "work" && distractions > 0 && (
                  <span className="text-[10px] text-destructive mt-1">{distractions} distraction{distractions !== 1 ? "s" : ""}</span>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              {phase === "idle" && (
                <Button size="lg" className="gap-2 px-8" onClick={startWork}>
                  <Play className="h-5 w-5" /> Start Focus
                </Button>
              )}
              {phase !== "idle" && secsLeft === 0 && phase === "work" && (
                <Button size="lg" variant="outline" className="gap-2 px-8 border-sky-400 text-sky-600" onClick={startBreak}>
                  <Coffee className="h-5 w-5" /> Take Break
                </Button>
              )}
              {phase !== "idle" && secsLeft === 0 && phase === "break" && (
                <Button size="lg" className="gap-2 px-8" onClick={startWork}>
                  <Brain className="h-5 w-5" /> Next Session
                </Button>
              )}
              {phase !== "idle" && secsLeft > 0 && (
                <Button size="lg" variant={running ? "outline" : "default"} className="gap-2 px-8" onClick={() => setRunning(!running)}>
                  {running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  {running ? "Pause" : "Resume"}
                </Button>
              )}
              <Button size="lg" variant="ghost" onClick={reset}>
                <RotateCcw className="h-5 w-5" />
              </Button>
            </div>

            {/* Preset selector */}
            {phase === "idle" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-2">
                <p className="text-xs text-muted-foreground">Session preset</p>
                <div className="flex gap-2 flex-wrap justify-center">
                  {PRESETS.map((p, i) => (
                    <Button key={i} size="sm" variant={preset === i ? "default" : "outline"} className="text-xs h-7" onClick={() => setPreset(i)}>
                      {p.label}
                    </Button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Session dots */}
            <div className="flex items-center gap-3">
              {Array.from({ length: Math.max(sessions, 4) }).map((_, i) => (
                <motion.div key={i} initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className={`w-3 h-3 rounded-full transition-colors ${i < sessions ? "bg-primary" : "bg-border"}`} />
              ))}
              {sessions > 0 && <span className="text-xs text-muted-foreground ml-1">{sessions} session{sessions !== 1 ? "s" : ""}</span>}
            </div>

            {/* Last session result */}
            {lastSessionResult && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex gap-4 flex-wrap justify-center w-full max-w-sm">
                <Card className="flex-1">
                  <CardContent className="p-4 text-center">
                    <div className="relative inline-block mb-1">
                      <ProductivityRing score={lastSessionResult.productivityScore ?? 0} size={56} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-bold">{lastSessionResult.productivityScore ?? 0}%</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Productivity</p>
                  </CardContent>
                </Card>
                <Card className="flex-1">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-primary">{sessions * PRESETS[preset].work}m</p>
                    <p className="text-xs text-muted-foreground">Focus time</p>
                  </CardContent>
                </Card>
                <Card className="flex-1">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-yellow-500">{lastSessionResult.xpEarned ?? 0}</p>
                    <p className="text-xs text-muted-foreground">XP earned</p>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </motion.div>
        ) : (
          /* ANALYTICS TAB */
          <motion.div key="analytics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Total Hours", value: analyticsData?.totalHours ?? "—", icon: <Clock className="h-4 w-4 text-primary" />, bg: "bg-primary/5" },
                { label: "Sessions", value: analyticsData?.totalSessions ?? "—", icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />, bg: "bg-emerald-50 dark:bg-emerald-950/20" },
                { label: "Avg Productivity", value: `${analyticsData?.avgProductivity ?? 0}%`, icon: <Zap className="h-4 w-4 text-yellow-500" />, bg: "bg-yellow-50 dark:bg-yellow-950/20" },
                { label: "Streak", value: `${analyticsData?.streak ?? 0} days`, icon: <Flame className="h-4 w-4 text-orange-500" />, bg: "bg-orange-50 dark:bg-orange-950/20" },
              ].map(({ label, value, icon, bg }) => (
                <Card key={label} className="shadow-sm">
                  <CardContent className={`p-3 flex items-center gap-3 rounded-xl ${bg}`}>
                    <div className="w-8 h-8 rounded-lg bg-white/60 dark:bg-white/10 flex items-center justify-center shrink-0">{icon}</div>
                    <div><p className="text-lg font-bold leading-none">{value}</p><p className="text-[11px] text-muted-foreground mt-0.5">{label}</p></div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Study by day */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2 px-4 pt-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" /> Study Minutes / Day
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {studyChartData.length === 0 ? (
                  <div className="h-48 flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
                    <BarChart3 className="h-8 w-8 opacity-30" />
                    <p>Complete sessions to see your trends</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={studyChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      <Area type="monotone" dataKey="minutes" stroke="#0D9488" fill="#0D948820" strokeWidth={2} name="Minutes" />
                      <Area type="monotone" dataKey="productivity" stroke="#f59e0b" fill="#f59e0b10" strokeWidth={2} name="Productivity %" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Peak hours */}
            {analyticsData?.peakHour && (
              <Card className="shadow-sm">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Clock className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Peak Study Time</p>
                    <p className="text-xs text-muted-foreground">
                      You focus best at <strong>{analyticsData.peakHour.hour}:00</strong> — that's when you're most productive.
                      Schedule your hardest work then!
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
