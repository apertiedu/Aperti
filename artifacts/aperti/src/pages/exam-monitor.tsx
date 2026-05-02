import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Monitor, Clock, CheckCircle, AlertCircle, Users,
  RefreshCw, ChevronLeft, Plus, Loader2, Activity
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ExamSession = {
  id: number; student_name: string; student_code: string;
  status: string; started_at: string; submitted_at: string | null;
  answered_count: number; total_questions: number;
  auto_score: number | null; max_score: number | null;
  seconds_remaining: number | null;
};

type MonitorData = {
  exam: { id: number; name: string; subject_name: string | null };
  sessions: ExamSession[];
  summary: { inProgress: number; submitted: number; expired: number; total: number };
};

const STATUS_CONFIG = {
  in_progress: { label: "In Progress", color: "bg-blue-500", badge: "bg-blue-100 text-blue-700 border-blue-200", icon: Activity },
  submitted:   { label: "Submitted",   color: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle },
  expired:     { label: "Time Up",     color: "bg-red-500", badge: "bg-red-100 text-red-700 border-red-200", icon: AlertCircle },
};

function formatTime(s: number) {
  if (s <= 0) return "0:00";
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

export default function ExamMonitor() {
  const params = useParams<{ examId: string }>();
  const examId = parseInt(params.examId, 10);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [data, setData] = useState<MonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [extending, setExtending] = useState<number | null>(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    const r = await fetch(`/api/online-exams/${examId}/monitor`, { credentials: "include" });
    if (r.ok) setData(await r.json());
    setLoading(false);
  };

  useEffect(() => { load(); const t = setInterval(() => load(true), 20000); return () => clearInterval(t); }, [examId]);

  const extendTime = async (sessionId: number, minutes: number) => {
    setExtending(sessionId);
    const r = await fetch(`/api/online-exams/${examId}/sessions/${sessionId}/extend`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minutes }),
    });
    if (r.ok) { toast({ title: `+${minutes} min added` }); load(true); }
    setExtending(null);
  };

  if (loading && !data) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
    </div>
  );

  const sessions = data?.sessions ?? [];
  const inProgress = sessions.filter(s => s.status === "in_progress");
  const submitted = sessions.filter(s => s.status === "submitted");
  const expired = sessions.filter(s => s.status === "expired");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button onClick={() => navigate("/exams")} className="mt-0.5 text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
                <Monitor className="h-4.5 w-4.5 text-white" style={{ width: 18, height: 18 }} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">{data?.exam.name ?? "Exam Monitor"}</h1>
                {data?.exam.subject_name && <p className="text-xs text-muted-foreground">{data.exam.subject_name}</p>}
              </div>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => load()} className="gap-2 flex-shrink-0">
          <RefreshCw className="h-3.5 w-3.5" />Refresh
        </Button>
      </div>

      {/* Live pulse banner */}
      {inProgress.length > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 border border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
          </span>
          <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
            {inProgress.length} student{inProgress.length !== 1 ? "s" : ""} currently taking this exam
          </p>
          <p className="text-xs text-blue-500 dark:text-blue-400 ml-auto hidden sm:block">Auto-refreshes every 20s</p>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total", value: data?.summary.total ?? 0, icon: Users, color: "text-foreground", bg: "bg-muted" },
          { label: "Active", value: data?.summary.inProgress ?? 0, icon: Activity, color: "text-blue-600", bg: "bg-blue-100" },
          { label: "Done", value: data?.summary.submitted ?? 0, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-100" },
          { label: "Expired", value: data?.summary.expired ?? 0, icon: AlertCircle, color: "text-red-600", bg: "bg-red-100" },
        ].map(s => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="p-3 text-center">
              <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center mx-auto mb-2`}>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-20">
          <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground/20" />
          <p className="font-semibold text-foreground mb-1">No students have started yet</p>
          <p className="text-sm text-muted-foreground">Share the exam with students to begin monitoring</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* In Progress */}
          {inProgress.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5" />In Progress ({inProgress.length})
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {inProgress.map(s => (
                  <motion.div key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <Card className="border-blue-200 dark:border-blue-800 overflow-hidden">
                      <div className="h-1 bg-gradient-to-r from-blue-400 to-indigo-500" />
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div>
                            <p className="font-semibold text-sm text-foreground">{s.student_name}</p>
                            <p className="text-xs text-muted-foreground">{s.student_code}</p>
                          </div>
                          {s.seconds_remaining !== null && (
                            <div className={`flex items-center gap-1 text-xs font-mono font-bold ${s.seconds_remaining < 300 ? "text-red-600" : "text-muted-foreground"}`}>
                              <Clock className="h-3 w-3" />{formatTime(s.seconds_remaining)}
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Progress</span>
                            <span className="font-semibold text-foreground">{s.answered_count}/{s.total_questions} answered</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full transition-all"
                              style={{ width: `${s.total_questions > 0 ? (s.answered_count / s.total_questions) * 100 : 0}%` }} />
                          </div>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => extendTime(s.id, 5)}
                            disabled={extending === s.id}
                            className="text-xs h-7 px-2 gap-1 flex-1">
                            {extending === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                            +5 min
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => extendTime(s.id, 15)}
                            disabled={extending === s.id}
                            className="text-xs h-7 px-2 gap-1 flex-1">
                            +15 min
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Submitted */}
          {submitted.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5" />Submitted ({submitted.length})
              </h2>
              <div className="space-y-2">
                {submitted.map(s => (
                  <Card key={s.id} className="border-emerald-200 dark:border-emerald-800">
                    <CardContent className="p-3 flex items-center gap-3">
                      <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{s.student_name}</p>
                        <p className="text-xs text-muted-foreground">{s.student_code}</p>
                      </div>
                      {s.auto_score !== null && s.max_score !== null && (
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-emerald-600">{s.auto_score}/{s.max_score}</p>
                          <p className="text-[10px] text-muted-foreground">Auto-score</p>
                        </div>
                      )}
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">Done</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Expired */}
          {expired.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-red-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />Time Expired ({expired.length})
              </h2>
              <div className="space-y-2">
                {expired.map(s => (
                  <Card key={s.id} className="border-red-200 dark:border-red-900 opacity-70">
                    <CardContent className="p-3 flex items-center gap-3">
                      <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{s.student_name}</p>
                        <p className="text-xs text-muted-foreground">{s.student_code}</p>
                      </div>
                      <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">Expired</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
