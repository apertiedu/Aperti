import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Pause, RotateCcw, Coffee, Brain, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";


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

async function completeSessionAPI(sessionId: number, durationMinutes: number, mode: string): Promise<void> {
  try {
    await fetch(`/api/focus-sessions/${sessionId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durationMinutes, mode }),
    });
  } catch { /* silent */ }
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

export default function FocusZone() {
  const [preset, setPreset] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [running, setRunning] = useState(false);
  const [secsLeft, setSecsLeft] = useState(PRESETS[0].work * 60);
  const [sessions, setSessions] = useState(0);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const totalSecs = phase === "break" ? PRESETS[preset].brk * 60 : PRESETS[preset].work * 60;
  const progress = secsLeft / totalSecs;
  const circumference = 2 * Math.PI * 110;

  const startWork = useCallback(async () => {
    const dur = PRESETS[preset].work;
    setPhase("work");
    setSecsLeft(dur * 60);
    setRunning(true);
    const id = await startSessionAPI(PRESETS[preset].mode, dur);
    setSessionId(id);
  }, [preset]);

  const startBreak = useCallback(() => {
    setPhase("break");
    setSecsLeft(PRESETS[preset].brk * 60);
    setRunning(true);
  }, [preset]);

  const reset = useCallback(() => {
    setRunning(false);
    setPhase("idle");
    setSecsLeft(PRESETS[preset].work * 60);
    setSessionId(null);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [preset]);

  const handleWorkComplete = useCallback(async () => {
    setSessions(s => s + 1);
    if (sessionId) {
      await completeSessionAPI(sessionId, PRESETS[preset].work, PRESETS[preset].mode);
      setSessionId(null);
      queryClient.invalidateQueries({ queryKey: ["focus-coach", "goals"] });
      queryClient.invalidateQueries({ queryKey: ["student", "home-summary"] });
      toast({ title: "Session complete! 🎉", description: `+${PRESETS[preset].work * 2} XP earned.` });
    }
  }, [sessionId, preset, queryClient, toast]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            setRunning(false);
            if (phase === "work") {
              handleWorkComplete();
            }
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

  return (
    <div className={`min-h-screen transition-colors duration-500 ${phaseBg} p-4 md:p-6 flex flex-col`}>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 text-center">
        <h1 className="text-2xl md:text-3xl font-bold">FocusZone</h1>
        <p className="text-muted-foreground text-sm mt-1">Distraction-free deep work sessions. Sessions are automatically logged.</p>
      </motion.div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-8">
        {/* Circular timer */}
        <div className="relative">
          <svg width="260" height="260" className="rotate-[-90deg]">
            <circle cx="130" cy="130" r="110" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
            <motion.circle
              cx="130" cy="130" r="110" fill="none"
              stroke={phaseColor}
              strokeWidth="8" strokeLinecap="round"
              strokeDasharray={circumference}
              animate={{ strokeDashoffset: circumference * (1 - progress) }}
              transition={{ duration: 0.5 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.span
                key={secsLeft}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.15 }}
                className="text-5xl font-bold font-mono tabular-nums"
                style={{ color: phaseColor }}
              >
                {formatTime(secsLeft)}
              </motion.span>
            </AnimatePresence>
            <Badge variant="outline" className="mt-2 text-xs capitalize" style={{ borderColor: phaseColor, color: phaseColor }}>
              {phase === "idle" ? "Ready" : phase === "work" ? "Focus" : "Break"}
            </Badge>
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
            <Button
              size="lg"
              variant={running ? "outline" : "default"}
              className="gap-2 px-8"
              onClick={() => setRunning(!running)}
            >
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
                <Button
                  key={i}
                  size="sm"
                  variant={preset === i ? "default" : "outline"}
                  className="text-xs h-7"
                  onClick={() => setPreset(i)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Session counter dots */}
        <div className="flex items-center gap-3 mt-2">
          {Array.from({ length: Math.max(sessions, 4) }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={`w-3 h-3 rounded-full transition-colors ${i < sessions ? "bg-primary" : "bg-border"}`}
            />
          ))}
          {sessions > 0 && (
            <span className="text-xs text-muted-foreground ml-1">{sessions} session{sessions !== 1 ? "s" : ""} complete</span>
          )}
        </div>

        {/* Stats */}
        {sessions > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-4 mt-2 flex-wrap justify-center"
          >
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-primary">{sessions}</p>
                <p className="text-xs text-muted-foreground">Sessions</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-primary">{sessions * PRESETS[preset].work}m</p>
                <p className="text-xs text-muted-foreground">Focus time</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-primary">{sessions * PRESETS[preset].work * 2}</p>
                <p className="text-xs text-muted-foreground">XP earned</p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
