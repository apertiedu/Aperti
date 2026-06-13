import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle, CheckCircle, Database, RefreshCw, Wrench, Users,
  BookOpen, CalendarCheck, ClipboardList, XCircle, TrendingUp, ShieldAlert
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type QualityIssue = {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  title: string;
  description: string;
  count: number;
  fixable: boolean;
};

type QualityReport = {
  score: number;
  issues: QualityIssue[];
  stats: {
    totalStudents: number;
    studentsWithoutSessions: number;
    studentsWithoutCode: number;
    duplicateAttendance: number;
    orphanedEnrollments: number;
    subjectsWithoutTeacher: number;
    homeworkWithoutDueDate: number;
    attendanceWithoutSession: number;
    lessonsWithoutTeacher: number;
  };
  generatedAt: string;
};

const SEVERITY_CONFIG = {
  critical: { color: "text-red-600", bg: "bg-red-50 dark:bg-red-900/20", badge: "bg-red-100 text-red-700", icon: <XCircle className="h-4 w-4 text-red-500" /> },
  high: { color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-900/20", badge: "bg-orange-100 text-orange-700", icon: <AlertTriangle className="h-4 w-4 text-orange-500" /> },
  medium: { color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20", badge: "bg-amber-100 text-amber-700", icon: <AlertTriangle className="h-4 w-4 text-amber-500" /> },
  low: { color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20", badge: "bg-blue-100 text-blue-700", icon: <CheckCircle className="h-4 w-4 text-blue-400" /> },
};

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 90 ? "text-emerald-600" : score >= 70 ? "text-amber-600" : "text-red-600";
  const label = score >= 90 ? "Excellent" : score >= 70 ? "Needs Attention" : "Critical Issues";
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`text-5xl font-black ${color}`}>{score}</div>
      <div className="text-sm font-semibold text-muted-foreground">/100</div>
      <Badge className={score >= 90 ? "bg-emerald-100 text-emerald-700" : score >= 70 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}>{label}</Badge>
      <Progress value={score} className="w-32 h-2" />
    </div>
  );
}

async function fetchDataQuality(): Promise<QualityReport> {
  const res = await apiFetch("/api/admin/data-quality");
  return res.json();
}

async function runFix(issueId: string): Promise<{ fixed: number }> {
  const res = await apiFetch("/api/admin/data-quality/fix", { method: "POST", body: JSON.stringify({ issueId }) });
  return res.json();
}

export default function DataQualityPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, refetch, isFetching } = useQuery<QualityReport>({
    queryKey: ["admin", "data-quality"],
    queryFn: fetchDataQuality,
    staleTime: 60_000,
  });

  const fix = useMutation({
    mutationFn: (issueId: string) => runFix(issueId),
    onSuccess: (res, issueId) => {
      toast({ title: "Fix applied", description: `Fixed ${res.fixed} record(s) for issue: ${issueId}` });
      qc.invalidateQueries({ queryKey: ["admin", "data-quality"] });
    },
    onError: () => toast({ title: "Fix failed", description: "Could not apply the fix. Check logs.", variant: "destructive" }),
  });

  const issues = data?.issues ?? [];
  const critical = issues.filter(i => i.severity === "critical");
  const high = issues.filter(i => i.severity === "high");
  const medium = issues.filter(i => i.severity === "medium");
  const low = issues.filter(i => i.severity === "low");

  const stats = data?.stats;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Data Quality Center</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Scan for data integrity issues, orphaned records, and fixable problems</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(data?.issues.filter(i => i.fixable).length ?? 0) > 1 && (
            <Button
              variant="outline"
              className="gap-2 text-amber-700 border-amber-300 hover:bg-amber-50"
              disabled={fix.isPending}
              onClick={async () => {
                const fixable = data?.issues.filter(i => i.fixable) ?? [];
                for (const issue of fixable) {
                  await runFix(issue.id).catch(() => {});
                }
                qc.invalidateQueries({ queryKey: ["admin", "data-quality"] });
                toast({ title: "Repair complete", description: `Attempted auto-fix on ${fixable.length} issue(s).` });
              }}
            >
              <ShieldAlert className="h-4 w-4" />
              Repair All Fixable
            </Button>
          )}
          <Button onClick={() => refetch()} disabled={isFetching} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            {isFetching ? "Scanning…" : "Run Quality Scan"}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : data ? (
        <>
          {/* Score + quick stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="shadow-sm md:col-span-1">
              <CardContent className="p-6 flex items-center justify-center">
                <ScoreGauge score={data.score} />
              </CardContent>
            </Card>
            <Card className="shadow-sm md:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Database className="h-4 w-4 text-primary" />Data Overview</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {stats && [
                    { label: "Total Students", value: stats.totalStudents, icon: <Users className="h-4 w-4 text-blue-500" /> },
                    { label: "No Session Assigned", value: stats.studentsWithoutSessions, icon: <CalendarCheck className="h-4 w-4 text-amber-500" />, warn: stats.studentsWithoutSessions > 0 },
                    { label: "Missing Student Code", value: stats.studentsWithoutCode, icon: <ClipboardList className="h-4 w-4 text-orange-500" />, warn: stats.studentsWithoutCode > 0 },
                    { label: "Duplicate Attendance", value: stats.duplicateAttendance, icon: <CalendarCheck className="h-4 w-4 text-red-500" />, warn: stats.duplicateAttendance > 0 },
                    { label: "Orphaned Enrolments", value: stats.orphanedEnrollments, icon: <BookOpen className="h-4 w-4 text-purple-500" />, warn: stats.orphanedEnrollments > 0 },
                    { label: "Subjects w/o Teacher", value: stats.subjectsWithoutTeacher, icon: <Users className="h-4 w-4 text-teal-500" />, warn: stats.subjectsWithoutTeacher > 0 },
                  ].map(({ label, value, icon, warn }) => (
                    <div key={label} className={`p-3 rounded-xl ${warn ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800" : "bg-muted/40"}`}>
                      <div className="flex items-center gap-1.5 mb-1">{icon}<span className="text-xs text-muted-foreground">{label}</span></div>
                      <p className={`text-xl font-bold ${warn ? "text-amber-700 dark:text-amber-400" : "text-foreground"}`}>{value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Issues by severity */}
          {[
            { label: "Critical Issues", items: critical, severity: "critical" as const },
            { label: "High Priority", items: high, severity: "high" as const },
            { label: "Medium Priority", items: medium, severity: "medium" as const },
            { label: "Low Priority", items: low, severity: "low" as const },
          ].filter(g => g.items.length > 0).map(({ label, items, severity }) => (
            <motion.div
              key={severity}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <Card className={`shadow-sm border ${SEVERITY_CONFIG[severity].bg}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {SEVERITY_CONFIG[severity].icon}
                    {label} ({items.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {items.map((issue, idx) => (
                    <motion.div
                      key={issue.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05, duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                      className="flex items-start justify-between gap-3 p-3 rounded-xl bg-background border border-border"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${SEVERITY_CONFIG[severity].badge}`}>{severity}</span>
                          <Badge variant="outline" className="text-[10px]">{issue.category}</Badge>
                          <span className="text-xs font-semibold text-foreground">{issue.title}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{issue.description}</p>
                        <p className="text-xs font-medium mt-1"><span className={SEVERITY_CONFIG[severity].color}>{issue.count}</span> record(s) affected</p>
                      </div>
                      {issue.fixable && (
                        <Button size="sm" variant="outline" className="shrink-0 gap-1.5 h-7 text-xs" onClick={() => fix.mutate(issue.id)} disabled={fix.isPending}>
                          <Wrench className="h-3 w-3" />Auto-fix
                        </Button>
                      )}
                    </motion.div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {issues.length === 0 && (
            <Card className="shadow-sm">
              <CardContent className="p-8 text-center">
                <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
                <p className="font-semibold text-foreground">All clear!</p>
                <p className="text-sm text-muted-foreground mt-1">No data quality issues detected.</p>
              </CardContent>
            </Card>
          )}

          <p className="text-xs text-muted-foreground text-right">
            Last scan: {new Date(data.generatedAt).toLocaleString()}
          </p>
        </>
      ) : (
        <Card className="shadow-sm">
          <CardContent className="p-8 text-center text-muted-foreground">
            <TrendingUp className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Click "Run Quality Scan" to analyse your data</p>
            <p className="text-sm mt-1">Detects orphaned records, missing fields, duplicates, and fixable data issues.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
