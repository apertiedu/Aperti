import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wrench, AlertTriangle, CheckCircle2, XCircle, RefreshCw,
  Database, Shield, Zap, Activity, ChevronRight, Hammer,
  FileWarning, Info, Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Orphan {
  type: string;
  count: number;
  error: string | null;
  fixable: boolean;
}

interface LaunchScore {
  score: number;
  certified: boolean;
  label: string;
  checkedAt: string;
  breakdown: Record<string, { score: number; max: number; label: string; status: string; details: string }>;
}

interface RepairLogEntry {
  id: number;
  run_at: string;
  type: string;
  severity: string;
  file: string | null;
  line_number: number | null;
  content: string;
  suggestion: string | null;
  auto_fixed: boolean;
}

const TEAL = "#0D9488";

const ORPHAN_LABELS: Record<string, { label: string; description: string }> = {
  enrollments_no_student:    { label: "Enrollments without student", description: "Enrollment records pointing to deleted students" },
  attendance_no_student:     { label: "Attendance without student",  description: "Attendance records with no matching student" },
  attendance_no_session:     { label: "Attendance with no session",  description: "Attendance linked to deleted lesson sessions" },
  marks_no_exam:             { label: "Marks without exam",          description: "Grade records pointing to deleted exams" },
  submissions_no_homework:   { label: "Submissions without homework", description: "Submission records for deleted homework" },
  expired_sessions:          { label: "Expired sessions",            description: "Old database sessions past their expiry" },
  student_accounts_no_profile: { label: "Students without profile",  description: "Student accounts with no students row" },
};

function ScoreGauge({ score, size = 80 }: { score: number; size?: number }) {
  const r = size * 0.38;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 95 ? "#16a34a" : score >= 80 ? "#0D9488" : score >= 60 ? "#d97706" : "#dc2626";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={size * 0.08} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={size * 0.08}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fontSize={size * 0.22} fontWeight="800" fill={color}>{score}</text>
    </svg>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors = { pass: "bg-green-500", warn: "bg-amber-400", fail: "bg-red-500" };
  return <span className={`w-2 h-2 rounded-full inline-block ${colors[status as keyof typeof colors] ?? "bg-gray-300"}`} />;
}

export default function RepairPanelPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [fixingType, setFixingType] = useState<string | null>(null);

  const { data: orphanData, isLoading: orphanLoading, refetch: refetchOrphans } = useQuery<{ orphans: Orphan[]; totalOrphans: number; checkedAt: string }>({
    queryKey: ["repair-orphans"],
    queryFn: () => fetch("/api/admin/repair/orphans", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 60_000,
  });

  const { data: scoreData, isLoading: scoreLoading, refetch: refetchScore } = useQuery<LaunchScore>({
    queryKey: ["repair-launch-score"],
    queryFn: () => fetch("/api/admin/repair/launch-score", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 120_000,
  });

  const { data: logData, isLoading: logLoading } = useQuery<{ entries: RepairLogEntry[]; count: number }>({
    queryKey: ["repair-log"],
    queryFn: () => fetch("/api/admin/repair/log", { credentials: "include" }).then(r => r.json()),
  });

  const fixMutation = useMutation({
    mutationFn: async (type: string) => {
      const res = await fetch("/api/admin/repair/fix-orphans", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) throw new Error("Fix failed");
      return res.json();
    },
    onSuccess: (data, type) => {
      setFixingType(null);
      toast({ title: "Fixed", description: `${data.affected} ${type} record(s) repaired` });
      qc.invalidateQueries({ queryKey: ["repair-orphans"] });
      qc.invalidateQueries({ queryKey: ["repair-log"] });
      qc.invalidateQueries({ queryKey: ["repair-launch-score"] });
    },
    onError: (_, type) => {
      setFixingType(null);
      toast({ title: `Failed to fix ${type}`, variant: "destructive" });
    },
  });

  const handleFix = (type: string) => {
    setFixingType(type);
    fixMutation.mutate(type);
  };

  const handleFixAll = () => {
    const fixable = orphanData?.orphans.filter(o => o.fixable && o.count > 0) ?? [];
    if (fixable.length === 0) return;
    for (const o of fixable) fixMutation.mutate(o.type);
    toast({ title: "Repair all started", description: `Fixing ${fixable.length} issue type(s)…` });
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#E6F4F1" }}>
              <Wrench className="w-4 h-4" style={{ color: TEAL }} />
            </div>
            <h1 className="text-xl font-bold text-slate-900">System Repair Panel</h1>
          </div>
          <p className="text-sm text-slate-500 ml-10">
            Detect and fix data integrity issues. Runs automatically before every build.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { refetchOrphans(); refetchScore(); }}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-teal-600 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh All
          </button>
          {(orphanData?.orphans ?? []).some(o => o.fixable && o.count > 0) && (
            <button
              onClick={handleFixAll}
              disabled={fixMutation.isPending}
              className="flex items-center gap-1.5 text-xs text-white rounded-lg px-3 py-1.5 font-semibold transition-colors"
              style={{ background: TEAL }}
            >
              <Hammer className="w-3.5 h-3.5" /> Fix All Fixable
            </button>
          )}
        </div>
      </div>

      {/* Launch Readiness Score */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Launch Readiness Score</h2>
          <button onClick={() => refetchScore()} className="text-xs text-slate-400 hover:text-teal-600">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        {scoreLoading ? (
          <div className="h-24 animate-pulse bg-gray-50 rounded-lg" />
        ) : scoreData ? (
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex flex-col items-center gap-1">
              <ScoreGauge score={scoreData.score} size={88} />
              <p className="text-xs font-semibold text-slate-600">{scoreData.label}</p>
              {scoreData.certified && (
                <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                  CERTIFIED
                </span>
              )}
            </div>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(scoreData.breakdown).map(([key, item]) => (
                <div key={key} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-gray-50">
                  <StatusDot status={item.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-700">{item.label}</span>
                      <span className={`text-xs font-bold tabular-nums ${
                        item.score === item.max ? "text-green-600" :
                        item.score >= item.max * 0.7 ? "text-amber-600" : "text-red-600"
                      }`}>{item.score}/{item.max}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">{item.details}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">Score unavailable</p>
        )}
      </div>

      {/* Orphan Record Detection */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700">Orphan Record Detection</h2>
            {orphanData && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                orphanData.totalOrphans === 0
                  ? "bg-green-50 text-green-600 border border-green-200"
                  : "bg-amber-50 text-amber-600 border border-amber-200"
              }`}>
                {orphanData.totalOrphans === 0 ? "Clean" : `${orphanData.totalOrphans} issues`}
              </span>
            )}
          </div>
          <button onClick={() => refetchOrphans()} className="text-xs text-slate-400 hover:text-teal-600">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {orphanLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse bg-gray-50 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {(orphanData?.orphans ?? []).map((orphan) => {
              const meta = ORPHAN_LABELS[orphan.type] ?? { label: orphan.type, description: "" };
              const isFixing = fixingType === orphan.type && fixMutation.isPending;
              const hasIssue = orphan.count > 0;
              return (
                <motion.div
                  key={orphan.type}
                  layout
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    orphan.error ? "border-red-100 bg-red-50/40" :
                    hasIssue ? "border-amber-100 bg-amber-50/40" :
                    "border-gray-100 bg-gray-50/40"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    orphan.error ? "bg-red-100 text-red-600" :
                    hasIssue ? "bg-amber-100 text-amber-600" :
                    "bg-green-100 text-green-600"
                  }`}>
                    {orphan.error ? <XCircle className="w-4 h-4" /> :
                     hasIssue ? <AlertTriangle className="w-4 h-4" /> :
                     <CheckCircle2 className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{meta.label}</p>
                    <p className="text-xs text-slate-400">{orphan.error ? orphan.error : meta.description}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-lg font-black tabular-nums ${
                      orphan.count === 0 ? "text-green-600" : orphan.count > 0 ? "text-amber-600" : "text-gray-300"
                    }`}>
                      {orphan.count >= 0 ? orphan.count : "—"}
                    </span>
                    {orphan.fixable && hasIssue && (
                      <button
                        onClick={() => handleFix(orphan.type)}
                        disabled={fixMutation.isPending}
                        className="flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        style={{ background: isFixing ? "#9CA3AF" : "#0D9488" }}
                      >
                        {isFixing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Hammer className="w-3 h-3" />}
                        {isFixing ? "Fixing…" : "Fix"}
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Repair Log */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <FileWarning className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-700">Repair Log</h2>
          <span className="text-[10px] text-slate-400">last 100 entries</span>
        </div>
        {logLoading ? (
          <div className="h-24 animate-pulse bg-gray-50 rounded-lg" />
        ) : (logData?.entries?.length ?? 0) === 0 ? (
          <div className="flex items-center gap-2 py-4 text-slate-400">
            <Info className="w-4 h-4" />
            <p className="text-sm">No repair log entries yet. Run scripts/repair.ts to populate.</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {(logData?.entries ?? []).map((entry) => (
              <div key={entry.id} className="flex items-start gap-2 text-xs py-1.5 px-2 rounded bg-gray-50 border border-gray-100">
                <span className={`font-bold shrink-0 mt-0.5 ${
                  entry.severity === "critical" ? "text-red-600" :
                  entry.severity === "warning" ? "text-amber-600" : "text-slate-400"
                }`}>{entry.severity.toUpperCase()}</span>
                <span className="text-slate-600 flex-1 break-words">{entry.content}</span>
                {entry.auto_fixed && (
                  <span className="text-green-600 font-semibold shrink-0">FIXED</span>
                )}
                <span className="text-slate-300 shrink-0">
                  {new Date(entry.run_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Route Consistency Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
        <div className="text-sm text-blue-700">
          <p className="font-semibold mb-1">Auto-Repair Script</p>
          <p className="text-xs text-blue-600">
            Run <code className="bg-blue-100 px-1 rounded font-mono">npx ts-node scripts/repair.ts</code> to scan all TypeScript files for unsafe role accesses, JWT fallback secrets, hardcoded API keys, and TODO/placeholder comments. Use <code className="bg-blue-100 px-1 rounded font-mono">--fix</code> flag to auto-apply safe patches. Results are saved to <code className="bg-blue-100 px-1 rounded font-mono">repair_report.json</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
