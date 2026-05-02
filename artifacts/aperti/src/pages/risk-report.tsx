import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle, AlertCircle, CheckCircle, Info,
  Search, RefreshCw, ChevronDown, ChevronUp,
  TrendingDown, Calendar, BookOpen, UserX, Siren
} from "lucide-react";

type RiskStudent = {
  studentId: number; studentName: string; studentCode: string;
  recentAttRate: number; overallAttRate: number;
  recentExamAvg: number; prevExamAvg: number;
  daysSinceAttendance: number; riskScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  reasons: string[]; recommendations: string[];
};

type RiskSummary = { critical: number; high: number; medium: number; low: number };

const RISK_CONFIG = {
  critical: { label: "Critical", icon: Siren,          color: "text-red-600",    bg: "bg-red-100",    border: "border-red-200",    badge: "bg-red-100 text-red-700 border-red-200",    bar: "bg-red-500" },
  high:     { label: "High",     icon: AlertTriangle,   color: "text-orange-600", bg: "bg-orange-100", border: "border-orange-200", badge: "bg-orange-100 text-orange-700 border-orange-200", bar: "bg-orange-500" },
  medium:   { label: "Medium",   icon: AlertCircle,     color: "text-amber-600",  bg: "bg-amber-100",  border: "border-amber-200",  badge: "bg-amber-100 text-amber-700 border-amber-200",  bar: "bg-amber-500" },
  low:      { label: "Low Risk", icon: CheckCircle,     color: "text-emerald-600", bg: "bg-emerald-100", border: "border-emerald-200", badge: "bg-emerald-100 text-emerald-700 border-emerald-200", bar: "bg-emerald-500" },
};

function RiskRow({ student }: { student: RiskStudent }) {
  const [expanded, setExpanded] = useState(false);
  const config = RISK_CONFIG[student.riskLevel];
  const RIcon = config.icon;

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <Card className={`border ${config.border} overflow-hidden`}>
        <div className={`h-1 ${config.bar}`} />
        <CardContent className="p-0">
          <button onClick={() => setExpanded(e => !e)}
            className="w-full p-4 flex items-center gap-3 text-left hover:bg-muted/20 transition-colors">
            <div className={`w-9 h-9 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0`}>
              <RIcon className={`h-4.5 w-4.5 ${config.color}`} style={{ width: 18, height: 18 }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm text-foreground">{student.studentName}</p>
                <Badge className={`text-[10px] px-1.5 py-0 h-4 border ${config.badge}`}>{config.label}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{student.studentCode} · Att: {student.recentAttRate}% · {student.reasons.length} risk factor{student.reasons.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-foreground">Score: {student.riskScore}</p>
                <p className="text-[10px] text-muted-foreground">{student.daysSinceAttendance < 999 ? `${student.daysSinceAttendance}d ago` : "Never"}</p>
              </div>
              {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </button>

          {expanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
              className="border-t border-border/50 p-4 space-y-4 bg-muted/10">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Recent Att.", value: `${student.recentAttRate}%`, bad: student.recentAttRate < 70 },
                  { label: "Overall Att.", value: `${student.overallAttRate}%`, bad: student.overallAttRate < 75 },
                  { label: "Recent Exam", value: student.recentExamAvg > 0 ? `${student.recentExamAvg}%` : "N/A", bad: student.recentExamAvg < 50 && student.recentExamAvg > 0 },
                  { label: "Last Seen", value: student.daysSinceAttendance < 999 ? `${student.daysSinceAttendance}d ago` : "Never", bad: student.daysSinceAttendance >= 7 },
                ].map(m => (
                  <div key={m.label} className="text-center p-2 rounded-lg bg-background border border-border/30">
                    <p className={`text-lg font-bold ${m.bad ? "text-red-600" : "text-foreground"}`}>{m.value}</p>
                    <p className="text-[10px] text-muted-foreground">{m.label}</p>
                  </div>
                ))}
              </div>

              {student.reasons.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <AlertCircle className="h-3 w-3" />Risk Factors
                  </p>
                  <ul className="space-y-1">
                    {student.reasons.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                        <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.bar}`} />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {student.recommendations.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Info className="h-3 w-3" />Recommended Actions
                  </p>
                  <ul className="space-y-1">
                    {student.recommendations.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                        <span className="mt-0.5 text-emerald-500">→</span>{r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function RiskReportPage() {
  const [students, setStudents] = useState<RiskStudent[]>([]);
  const [summary, setSummary] = useState<RiskSummary>({ critical: 0, high: 0, medium: 0, low: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterLevel, setFilterLevel] = useState<string>("");

  const load = async () => {
    setLoading(true);
    const r = await fetch("/api/analytics/risk-report", { credentials: "include" });
    if (r.ok) { const d = await r.json(); setStudents(d.students); setSummary(d.summary); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = students.filter(s => {
    if (filterLevel && s.riskLevel !== filterLevel) return false;
    if (search && !s.studentName.toLowerCase().includes(search.toLowerCase()) && !s.studentCode.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const LEVELS = ["critical", "high", "medium", "low"] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shadow-sm">
            <AlertTriangle className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">AI Risk Detection</h1>
            <p className="text-xs text-muted-foreground">Automatically identifies students who need intervention</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        {LEVELS.map(level => {
          const config = RISK_CONFIG[level];
          const RIcon = config.icon;
          const count = summary[level];
          return (
            <button key={level} onClick={() => setFilterLevel(filterLevel === level ? "" : level)}
              className={`p-3 rounded-xl border text-center transition-all ${
                filterLevel === level ? `${config.border} ${config.bg}` : "border-border/50 bg-card hover:bg-muted/30"
              }`}>
              <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center mx-auto mb-2`}>
                <RIcon className={`h-4 w-4 ${config.color}`} />
              </div>
              <p className={`text-2xl font-bold ${count > 0 && (level === "critical" || level === "high") ? config.color : "text-foreground"}`}>{count}</p>
              <p className="text-[10px] text-muted-foreground">{config.label}</p>
            </button>
          );
        })}
      </div>

      {/* Critical alert banner */}
      {summary.critical > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="border-red-200 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30">
            <CardContent className="p-4 flex items-center gap-3">
              <Siren className="h-5 w-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-700 dark:text-red-400">
                  {summary.critical} student{summary.critical > 1 ? "s" : ""} at critical risk
                </p>
                <p className="text-xs text-red-600/80 dark:text-red-400/80">Immediate intervention recommended. Expand each student below for details.</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or code..." className="pl-9" />
      </div>

      {/* Student list */}
      {loading ? (
        <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-16 rounded-xl skeleton" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle className="h-10 w-10 mx-auto mb-3 text-emerald-400" />
          <p className="font-semibold text-foreground mb-1">
            {filterLevel ? `No ${RISK_CONFIG[filterLevel as keyof typeof RISK_CONFIG]?.label} risk students` : "No students match your search"}
          </p>
          <p className="text-sm text-muted-foreground">
            {!filterLevel && !search ? "All students are performing well!" : "Try adjusting your filters"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {LEVELS.map(level => {
            const group = filtered.filter(s => s.riskLevel === level);
            if (!group.length) return null;
            return (
              <div key={level}>
                {!filterLevel && (
                  <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${RISK_CONFIG[level].color}`}>
                    {level.toUpperCase()} ({group.length})
                  </h3>
                )}
                <div className="space-y-2">
                  {group.map(s => <RiskRow key={s.studentId} student={s} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
