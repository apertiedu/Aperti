import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Download, Search, BarChart3, Users, ChevronUp, ChevronDown,
  ArrowUpDown, ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { InlineError } from "@/components/inline-error";
import { AppEmptyState } from "@/components/app-empty-state";

const IGCSE_COLOR: Record<string, string> = {
  "A*": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  "A":  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  "B":  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  "C":  "bg-primary/15 text-primary dark:bg-primary/10 dark:text-primary",
  "D":  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "E":  "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  "F":  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "G":  "bg-red-100 text-red-400 dark:bg-red-900/30 dark:text-red-400",
  "U":  "bg-red-200 text-red-700 dark:bg-red-900/50 dark:text-red-500",
};

interface GradebookEntry {
  student_name: string;
  grade_level: string;
  assessment_title: string;
  assessment_type: string;
  score: number;
  max_score: number;
  percentage: number;
  grade: string;
  submitted_at: string;
  graded_at: string;
}

interface StudentRow {
  name: string;
  grade_level: string;
  entries: GradebookEntry[];
  avg: number;
  overallGrade: string;
}

function igcseGrade(pct: number): string {
  if (pct >= 90) return "A*";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  if (pct >= 40) return "E";
  if (pct >= 30) return "F";
  if (pct >= 20) return "G";
  return "U";
}

export default function TeacherGradebook() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filterType, setFilterType] = useState("all");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["gradebook-export-data"],
    queryFn: async () => {
      const res = await apiFetch("/api/gradebook/export");
      if (!res.ok) throw new Error(`Failed to load gradebook (${res.status})`);
      return (await res.json()).entries as GradebookEntry[];
    },
  });

  const exportMut = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/gradebook/export?format=csv");
      const text = await res.text();
      const blob = new Blob([text], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "gradebook.csv"; a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => toast({ title: "Exported" }),
  });

  const entries = (data ?? []).filter(e =>
    (!search || e.student_name?.toLowerCase().includes(search.toLowerCase())) &&
    (filterType === "all" || e.assessment_type === filterType)
  );

  // Build student rows
  const studentMap = new Map<string, StudentRow>();
  for (const e of entries) {
    if (!studentMap.has(e.student_name)) {
      studentMap.set(e.student_name, { name: e.student_name, grade_level: e.grade_level, entries: [], avg: 0, overallGrade: "U" });
    }
    studentMap.get(e.student_name)!.entries.push(e);
  }
  for (const row of studentMap.values()) {
    const scores = row.entries.map(e => parseFloat(String(e.percentage ?? 0)) || 0);
    row.avg = scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0;
    row.overallGrade = igcseGrade(row.avg);
  }

  const studentRows = Array.from(studentMap.values()).sort((a, b) =>
    sortDir === "desc" ? b.avg - a.avg : a.avg - b.avg
  );

  // Get all unique assessment titles (columns)
  const assessmentCols = [...new Set(entries.map(e => e.assessment_title))].slice(0, 8);

  const typeOptions = [...new Set((data ?? []).map(e => e.assessment_type))];

  const classAvg = studentRows.length > 0
    ? Math.round(studentRows.reduce((s, r) => s + r.avg, 0) / studentRows.length)
    : 0;

  if (isError) {
    return (
      <InlineError
        message="Could not load gradebook data. Check your connection or try again."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" /> Gradebook
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Spreadsheet view of all student grades.</p>
        </div>
        <Button className="gap-2" onClick={() => exportMut.mutate()} disabled={exportMut.isPending}>
          <Download className="w-4 h-4" />
          {exportMut.isPending ? "Exporting…" : "Export CSV"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Students", value: studentRows.length, icon: <Users className="w-4 h-4" /> },
          { label: "Assessments", value: assessmentCols.length, icon: <BarChart3 className="w-4 h-4" /> },
          { label: "Class Average", value: `${classAvg}% · ${igcseGrade(classAvg)}`, icon: <BarChart3 className="w-4 h-4" /> },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">{s.icon}<span className="text-xs">{s.label}</span></div>
            <p className="text-xl font-bold text-primary">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Search student…" className="pl-8 h-9 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="rounded-lg border border-border bg-background px-3 py-2 text-sm" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="all">All Types</option>
          {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <Button variant="outline" size="sm" className="gap-1.5 h-9"
          onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}>
          <ArrowUpDown className="w-3.5 h-3.5" />
          {sortDir === "desc" ? "Highest first" : "Lowest first"}
        </Button>
      </div>

      {/* Spreadsheet table */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-12 bg-muted/40 rounded-xl animate-pulse" />)}</div>
      ) : studentRows.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-2xl">
          <AppEmptyState
            type="gradebook"
            title={search ? "No students match your search" : "No graded submissions yet"}
            description={search ? `No students found for "${search}". Try a different name.` : "Grades will appear here once assessments are marked and published to students."}
            size="md"
          />
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="sticky left-0 bg-muted/50 text-left px-4 py-2.5 font-semibold text-muted-foreground min-w-[160px]">Student</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground w-10">Yr</th>
                  {assessmentCols.map(col => (
                    <th key={col} className="text-center px-3 py-2.5 font-semibold text-muted-foreground whitespace-nowrap max-w-[100px]">
                      <span className="block truncate max-w-[90px]" title={col}>{col}</span>
                    </th>
                  ))}
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground border-l border-border">Avg</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {studentRows.map((row, i) => (
                  <motion.tr key={row.name} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: i * 0.02 } }}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="sticky left-0 bg-card px-4 py-2.5 font-medium whitespace-nowrap">{row.name}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{row.grade_level ?? "—"}</td>
                    {assessmentCols.map(col => {
                      const entry = row.entries.find(e => e.assessment_title === col);
                      if (!entry) return <td key={col} className="px-3 py-2.5 text-center text-muted-foreground/40">—</td>;
                      const pct = parseFloat(String(entry.percentage ?? 0)) || 0;
                      return (
                        <td key={col} className="px-3 py-2.5 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="font-medium">{Math.round(pct)}%</span>
                            <div className="w-10 bg-muted rounded-full h-0.5">
                              <div className="bg-primary rounded-full h-0.5 transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
                            </div>
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-center border-l border-border font-bold text-primary">{row.avg}%</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${IGCSE_COLOR[row.overallGrade] ?? ""}`}>{row.overallGrade}</span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
