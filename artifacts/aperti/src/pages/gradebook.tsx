import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { BookMarked, Download, Filter, Users, TrendingUp, Award, Search, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { format, parseISO } from "date-fns";

type ExamCol = { id: number; name: string; examDate: string | null; totalMarks: number; subjectName: string; subjectId: number | null };
type StudentRow = {
  id: number; studentName: string; studentCode: string;
  scores: Record<number, { scored: number; max: number; pct: number; grade: string } | null>;
  attendanceRate: number; average: number | null; igcse: string | null; examCount: number;
};
type GradebookData = { exams: ExamCol[]; students: StudentRow[] };
type Filters = { subjects: { id: number; name: string }[]; sessions: { id: number; lessonNumber: number; dayOfWeek: string; startTime: string; subjectName: string }[] };

const IGCSE_COLOR: Record<string, string> = {
  "A*": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  "A":  "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  "B":  "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  "C":  "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  "D":  "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  "E":  "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  "F":  "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  "G":  "bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300",
  "U":  "bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

function cellBg(pct: number): string {
  if (pct >= 80) return "bg-emerald-50 dark:bg-emerald-950/20";
  if (pct >= 60) return "bg-amber-50 dark:bg-amber-950/20";
  return "bg-red-50 dark:bg-red-950/20";
}

function GradeBadge({ grade }: { grade: string }) {
  return <span className={`inline-flex items-center justify-center rounded-md px-1.5 py-0.5 text-[11px] font-black tracking-wide ${IGCSE_COLOR[grade] ?? "bg-muted text-muted-foreground"}`}>{grade}</span>;
}

function exportCSV(exams: ExamCol[], students: StudentRow[]) {
  const headers = ["Student Code", "Student Name", "Attendance %", ...exams.map(e => e.name), "Average %", "IGCSE Grade"];
  const rows = students.map(s => [
    s.studentCode, s.studentName, s.attendanceRate,
    ...exams.map(e => {
      const sc = s.scores[e.id];
      return sc ? `${sc.scored}/${sc.max} (${sc.pct}%)` : "";
    }),
    s.average ?? "", s.igcse ?? "",
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `gradebook_${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

type SortKey = "name" | "average" | "attendance";

export default function GradebookPage() {
  const [data, setData] = useState<GradebookData | null>(null);
  const [filters, setFilters] = useState<Filters>({ subjects: [], sessions: [] });
  const [loading, setLoading] = useState(true);
  const [subjectId, setSubjectId] = useState("all");
  const [sessionId, setSessionId] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });

  useEffect(() => {
    fetch("/api/gradebook/filters", { credentials: "include" })
      .then(r => r.ok ? r.json() : { subjects: [], sessions: [] })
      .then(setFilters);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (subjectId !== "all") params.set("subjectId", subjectId);
    if (sessionId !== "all") params.set("sessionId", sessionId);
    fetch(`/api/gradebook?${params}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false); });
  }, [subjectId, sessionId]);

  useEffect(() => { load(); }, [load]);

  const exams = data?.exams ?? [];
  const students = (data?.students ?? [])
    .filter(s => !search || s.studentName.toLowerCase().includes(search.toLowerCase()) || s.studentCode.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let cmp = 0;
      if (sort.key === "name") cmp = a.studentName.localeCompare(b.studentName);
      else if (sort.key === "average") cmp = (a.average ?? -1) - (b.average ?? -1);
      else if (sort.key === "attendance") cmp = a.attendanceRate - b.attendanceRate;
      return sort.dir === "asc" ? cmp : -cmp;
    });

  const toggleSort = (key: SortKey) =>
    setSort(s => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" });

  const SortIcon = ({ k }: { k: SortKey }) => sort.key === k
    ? (sort.dir === "asc" ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />)
    : null;

  // Class-level stats
  const withScores = students.filter(s => s.average !== null);
  const classAvg = withScores.length ? Math.round(withScores.reduce((a, s) => a + (s.average ?? 0), 0) / withScores.length * 10) / 10 : null;
  const topCount = students.filter(s => (s.average ?? 0) >= 80).length;
  const riskCount = students.filter(s => s.attendanceRate < 75 || (s.average !== null && s.average < 50)).length;

  const kpis = [
    { label: "Students", value: students.length, icon: Users, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/40" },
    { label: "Exams", value: exams.length, icon: BookMarked, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950/40" },
    { label: "Class Average", value: classAvg !== null ? `${classAvg}%` : "—", icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
    { label: "At Risk", value: riskCount, icon: Award, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/40" },
  ];

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
            <BookMarked className="w-7 h-7 text-primary" /> Grade Book
          </h1>
          <p className="text-muted-foreground text-sm mt-1">All students × all exams in one view</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => data && exportCSV(exams, students)} disabled={!data}>
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map(k => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`${k.bg} p-2 rounded-lg`}><k.icon className={`w-4 h-4 ${k.color}`} /></div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{k.label}</p>
                  <p className={`text-xl font-black ${k.color}`}>{loading ? "—" : k.value}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <Card className="border-border/50">
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="relative flex-1 min-w-[160px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students…" className="pl-8 h-8 text-sm" />
          </div>
          <Select value={subjectId} onValueChange={setSubjectId}>
            <SelectTrigger className="h-8 text-sm w-44">
              <SelectValue placeholder="All subjects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All subjects</SelectItem>
              {filters.subjects.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sessionId} onValueChange={setSessionId}>
            <SelectTrigger className="h-8 text-sm w-44">
              <SelectValue placeholder="All sessions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sessions</SelectItem>
              {filters.sessions.map(s => (
                <SelectItem key={s.id} value={String(s.id)}>
                  L{s.lessonNumber} · {s.dayOfWeek} {s.startTime?.slice(0, 5)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground ml-auto">
            {students.length} student{students.length !== 1 ? "s" : ""} · {exams.length} exam{exams.length !== 1 ? "s" : ""}
          </span>
        </CardContent>
      </Card>

      {/* Grade Table */}
      {loading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}</div>
      ) : students.length === 0 || exams.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-16 text-center text-muted-foreground">
            <BookMarked className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="font-semibold">{exams.length === 0 ? "No exams yet" : "No students found"}</p>
            <p className="text-sm mt-1">{exams.length === 0 ? "Create exams and mark them to see the grade book." : "Try adjusting your filters."}</p>
          </CardContent>
        </Card>
      ) : (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="overflow-x-auto rounded-xl border border-border/60 shadow-sm">
          <table className="w-full text-sm border-collapse">
            <thead>
              {/* Subject row */}
              <tr className="border-b border-border bg-muted/40">
                <th className="sticky left-0 bg-muted/60 backdrop-blur-sm z-10 w-48 min-w-[12rem] px-4 py-2 text-left text-xs font-bold text-muted-foreground border-r border-border" rowSpan={2}>
                  Student
                </th>
                <th
                  className="px-3 py-2 text-center text-xs font-bold text-muted-foreground border-r border-border cursor-pointer hover:text-foreground transition-colors whitespace-nowrap"
                  onClick={() => toggleSort("attendance")}
                >
                  Att. % <SortIcon k="attendance" />
                </th>
                {exams.map(e => (
                  <th key={e.id} className="px-2 py-1.5 text-center text-[10px] font-semibold text-muted-foreground border-r border-border/60 whitespace-nowrap max-w-[90px]">
                    <div className="truncate text-[10px]">{e.subjectName}</div>
                  </th>
                ))}
                <th
                  className="px-3 py-2 text-center text-xs font-bold text-muted-foreground border-r border-border cursor-pointer hover:text-foreground transition-colors whitespace-nowrap"
                  onClick={() => toggleSort("average")}
                >
                  Avg % <SortIcon k="average" />
                </th>
                <th className="px-3 py-2 text-center text-xs font-bold text-muted-foreground whitespace-nowrap">Grade</th>
              </tr>
              {/* Exam name row */}
              <tr className="border-b-2 border-border bg-muted/30">
                <th className="px-3 py-2 text-center text-[10px] font-semibold text-muted-foreground border-r border-border whitespace-nowrap">
                  Rate
                </th>
                {exams.map(e => (
                  <th key={e.id} className="px-2 py-1 text-center border-r border-border/60 max-w-[90px]">
                    <div className="truncate text-[10px] font-bold text-foreground max-w-[80px]" title={e.name}>{e.name}</div>
                    {e.examDate && <div className="text-[9px] text-muted-foreground">{format(parseISO(e.examDate.split("T")[0]), "dd MMM")}</div>}
                    <div className="text-[9px] text-muted-foreground">{e.totalMarks}m</div>
                  </th>
                ))}
                <th className="px-3 py-2 border-r border-border" />
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => {
                const rowBg = i % 2 === 0 ? "bg-background" : "bg-muted/20";
                const riskRow = s.attendanceRate < 75 || (s.average !== null && s.average < 50);
                return (
                  <tr key={s.id} className={`border-b border-border/50 hover:bg-primary/5 transition-colors group ${riskRow ? "bg-red-50/30 dark:bg-red-950/10" : rowBg}`}>
                    {/* Student name — sticky */}
                    <td className={`sticky left-0 z-10 backdrop-blur-sm border-r border-border px-4 py-2.5 ${riskRow ? "bg-red-50/80 dark:bg-red-950/30" : "bg-background/95"} group-hover:bg-primary/5`}>
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-bold text-sm text-foreground truncate max-w-[140px]">{s.studentName}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">{s.studentCode}</p>
                        </div>
                      </div>
                    </td>
                    {/* Attendance */}
                    <td className="px-3 py-2 text-center border-r border-border">
                      <span className={`text-xs font-bold ${s.attendanceRate >= 75 ? "text-emerald-600" : "text-red-600"}`}>
                        {s.attendanceRate}%
                      </span>
                    </td>
                    {/* Exam scores */}
                    {exams.map(e => {
                      const sc = s.scores[e.id];
                      return (
                        <td key={e.id} className={`px-2 py-2 text-center border-r border-border/50 ${sc ? cellBg(sc.pct) : ""}`}>
                          {sc ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-[11px] font-bold text-foreground">{sc.pct}%</span>
                              <span className="text-[10px] text-muted-foreground">{sc.scored}/{sc.max}</span>
                              <GradeBadge grade={sc.grade} />
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground/40">—</span>
                          )}
                        </td>
                      );
                    })}
                    {/* Average */}
                    <td className="px-3 py-2 text-center border-r border-border">
                      {s.average !== null ? (
                        <span className={`text-sm font-black ${s.average >= 80 ? "text-emerald-600" : s.average >= 60 ? "text-amber-600" : "text-red-600"}`}>
                          {s.average}%
                        </span>
                      ) : <span className="text-muted-foreground/40 text-xs">—</span>}
                    </td>
                    {/* IGCSE Grade */}
                    <td className="px-3 py-2 text-center">
                      {s.igcse ? <GradeBadge grade={s.igcse} /> : <span className="text-muted-foreground/40 text-xs">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </motion.div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
        <span className="font-semibold">IGCSE Grade Scale:</span>
        {Object.entries(IGCSE_COLOR).map(([g, cls]) => (
          <span key={g} className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[11px] font-black ${cls}`}>{g}</span>
        ))}
        <span className="ml-2">· Cells: <span className="text-emerald-600 font-semibold">green ≥80%</span>, <span className="text-amber-600 font-semibold">amber ≥60%</span>, <span className="text-red-600 font-semibold">red &lt;60%</span></span>
      </div>
    </div>
  );
}
