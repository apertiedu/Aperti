import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Eye, AlertTriangle, CheckCircle2, Clock, Users, RefreshCw,
  ArrowLeft, Shield, XCircle, Plus, BarChart3,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface StudentStatus {
  student_id: number;
  student_name: string;
  status: string | null;
  submitted_at: string | null;
  security_flags: any[];
  score: number | null;
  max_score: number | null;
  exam_started: string | null;
  tab_switches: number;
  focus_losses: number;
  last_heartbeat: string | null;
  session_active: boolean;
}

export default function AssessmentMonitor({ params }: { params: { id: string } }) {
  const assessmentId = params?.id;
  const { toast } = useToast();
  const [extendMinutes, setExtendMinutes] = useState<Record<number, string>>({});

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["monitor", assessmentId],
    queryFn: async () => {
      const [monitorRes, assessRes] = await Promise.all([
        apiFetch(`/api/assessments/${assessmentId}/monitor`),
        apiFetch(`/api/assessments/${assessmentId}`),
      ]);
      const [monitorData, assessData] = await Promise.all([monitorRes.json(), assessRes.json()]);
      return { students: monitorData.students as StudentStatus[], stats: monitorData.stats, assessment: assessData.assessment };
    },
    refetchInterval: 15_000,
  });

  const extendMut = useMutation({
    mutationFn: async ({ studentId, minutes }: { studentId: number; minutes: number }) => {
      const res = await apiFetch(`/api/assessments/${assessmentId}/extend-time`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId, extra_minutes: minutes }),
      });
      return res.json();
    },
    onSuccess: () => toast({ title: "Time extended" }),
  });

  const endExamMut = useMutation({
    mutationFn: async (studentId: number) => {
      const res = await apiFetch(`/api/assessments/${assessmentId}/end-student-exam`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId }),
      });
      return res.json();
    },
    onSuccess: () => { toast({ title: "Exam ended for student" }); refetch(); },
  });

  const students = data?.students ?? [];
  const stats = data?.stats ?? {};
  const assessment = data?.assessment;

  const getStatus = (s: StudentStatus) => {
    if (!s.status && !s.exam_started) return "not_started";
    if (s.status === "submitted" || s.status === "graded") return "submitted";
    if (s.session_active) return "in_progress";
    return s.status ?? "not_started";
  };

  const STATUS_META = {
    not_started: { label: "Not Started", color: "bg-muted text-muted-foreground", icon: Clock },
    in_progress:  { label: "In Progress",  color: "bg-primary/10 text-primary", icon: RefreshCw },
    submitted:    { label: "Submitted",    color: "bg-emerald-500/10 text-emerald-600", icon: CheckCircle2 },
  };

  const isFlagged = (s: StudentStatus) => (s.tab_switches ?? 0) > 3 || (s.focus_losses ?? 0) > 5;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/teacher/assessments">
            <Button variant="ghost" size="sm" className="h-8 text-muted-foreground">
              <ArrowLeft className="w-3.5 h-3.5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" /> Live Monitor
            </h1>
            <p className="text-sm text-muted-foreground">{assessment?.title}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          {isFetching ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total",       value: stats.total ?? 0,        color: "text-foreground" },
          { label: "Not Started", value: stats.not_started ?? 0,  color: "text-muted-foreground" },
          { label: "In Progress", value: stats.in_progress ?? 0,  color: "text-primary" },
          { label: "Submitted",   value: stats.submitted ?? 0,    color: "text-emerald-500" },
          { label: "Flagged",     value: stats.flagged ?? 0,      color: "text-red-500" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-3 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Live view: refreshes every 15s */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        Live — auto-refreshes every 15 seconds
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-16 bg-muted/40 rounded-xl animate-pulse" />)}</div>
      ) : students.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-2xl">
          <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">No students have started this exam yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {students.map(s => {
            const status = getStatus(s);
            const meta = STATUS_META[status as keyof typeof STATUS_META] ?? STATUS_META.not_started;
            const flagged = isFlagged(s);
            const pct = s.score && s.max_score ? Math.round((s.score / s.max_score) * 100) : null;

            return (
              <motion.div key={s.student_id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className={`bg-card border rounded-xl p-4 flex items-center gap-4 ${flagged ? "border-red-300" : "border-border"}`}
              >
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-bold text-primary">{(s.student_name ?? "?").charAt(0)}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{s.student_name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${meta.color}`}>{meta.label}</span>
                    {flagged && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-red-500/10 text-red-600 flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5" />Flagged
                      </span>
                    )}
                    {pct !== null && <span className="text-[10px] text-muted-foreground">{pct}%</span>}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-[11px] text-muted-foreground">
                    {s.exam_started && <span>Started {new Date(s.exam_started).toLocaleTimeString()}</span>}
                    {s.submitted_at && <span>Submitted {new Date(s.submitted_at).toLocaleTimeString()}</span>}
                    {(s.tab_switches > 0 || s.focus_losses > 0) && (
                      <span className={s.tab_switches > 3 ? "text-red-500" : ""}>
                        {s.tab_switches} tab switch{s.tab_switches !== 1 ? "es" : ""} · {s.focus_losses} focus losses
                      </span>
                    )}
                    {s.last_heartbeat && (
                      <span className={new Date().getTime() - new Date(s.last_heartbeat).getTime() > 30_000 ? "text-amber-500" : ""}>
                        Last seen {Math.round((new Date().getTime() - new Date(s.last_heartbeat).getTime()) / 1000)}s ago
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {status === "in_progress" && (
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1} max={60}
                        className="w-14 h-7 rounded border border-border text-xs px-2 bg-background"
                        placeholder="min"
                        value={extendMinutes[s.student_id] ?? ""}
                        onChange={e => setExtendMinutes(m => ({ ...m, [s.student_id]: e.target.value }))}
                      />
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                        onClick={() => extendMut.mutate({ studentId: s.student_id, minutes: parseInt(extendMinutes[s.student_id] ?? "5") || 5 })}>
                        <Plus className="w-3 h-3" />Extend
                      </Button>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      onClick={() => { if (confirm("End exam for this student?")) endExamMut.mutate(s.student_id); }}>
                      <XCircle className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
