import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3, Download, Settings, Search, ChevronDown,
  Award, TrendingUp, Users, Calculator, FileText,
  CheckCircle2, AlertCircle, Plus, Printer,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const IGCSE_GRADES = ["A*","A","B","C","D","E","F","G","U"];

const GRADE_COLOR: Record<string, string> = {
  "A*": "text-yellow-500 bg-yellow-500/10",
  "A":  "text-emerald-500 bg-emerald-500/10",
  "B":  "text-green-500 bg-green-500/10",
  "C":  "text-teal-500 bg-teal-500/10",
  "D":  "text-blue-500 bg-blue-500/10",
  "E":  "text-orange-500 bg-orange-500/10",
  "F":  "text-amber-500 bg-amber-500/10",
  "G":  "text-red-400 bg-red-400/10",
  "U":  "text-red-600 bg-red-600/10",
};

interface ClassReport {
  title: string;
  type: string;
  submissions: number;
  avg_pct: number;
  min_pct: number;
  max_pct: number;
  passed: number;
  failed: number;
}

interface GradebookExport {
  entries: Array<{
    student_name: string;
    grade_level: string;
    assessment_title: string;
    assessment_type: string;
    score: number;
    max_score: number;
    percentage: number;
    grade: string;
    submitted_at: string;
  }>;
}

export default function GradebookPlus() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"overview" | "settings" | "export" | "appeals">("overview");
  const [search, setSearch] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    quiz_weight: "20",
    homework_weight: "10",
    test_weight: "30",
    exam_weight: "40",
    grading_scale: "igcse",
  });

  const { data: classReport, isLoading } = useQuery({
    queryKey: ["class-report"],
    queryFn: async () => {
      const res = await apiFetch("/api/reports/teacher/me/class");
      const data = await res.json();
      return data.assessments as ClassReport[];
    },
  });

  const { data: exportData } = useQuery({
    queryKey: ["gradebook-export"],
    queryFn: async () => {
      const res = await apiFetch("/api/gradebook/export");
      return (await res.json()) as GradebookExport;
    },
    enabled: tab === "export",
  });

  const { data: appeals } = useQuery({
    queryKey: ["appeals"],
    queryFn: async () => {
      const res = await apiFetch("/api/appeals");
      return (await res.json()).appeals ?? [];
    },
    enabled: tab === "appeals",
  });

  const resolveAppealMut = useMutation({
    mutationFn: async ({ id, resolution }: { id: number; resolution: string }) => {
      const res = await apiFetch(`/api/appeals/${id}/resolve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution, status: "resolved" }),
      });
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["appeals"] }); toast({ title: "Appeal resolved" }); },
  });

  const saveSettingsMut = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/gradebook/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weightings: {
            quiz: parseFloat(settings.quiz_weight) / 100,
            homework: parseFloat(settings.homework_weight) / 100,
            topic_test: parseFloat(settings.test_weight) / 100,
            final_exam: parseFloat(settings.exam_weight) / 100,
          },
          grading_scale: { type: settings.grading_scale },
        }),
      });
      return res.json();
    },
    onSuccess: () => toast({ title: "Settings saved" }),
  });

  const exportCSVMut = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/gradebook/export?format=csv");
      const text = await res.text();
      const blob = new Blob([text], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "gradebook.csv"; a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => toast({ title: "Exported successfully" }),
  });

  const reports = (classReport ?? []).filter(r => !search || r.title.toLowerCase().includes(search.toLowerCase()));

  const totalSubmissions = reports.reduce((s, r) => s + (r.submissions ?? 0), 0);
  const avgClass = reports.length > 0
    ? Math.round(reports.reduce((s, r) => s + (parseFloat(String(r.avg_pct ?? 0)) || 0), 0) / reports.length)
    : 0;
  const totalPassed = reports.reduce((s, r) => s + (r.passed ?? 0), 0);
  const totalFailed = reports.reduce((s, r) => s + (r.failed ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Gradebook+
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Performance overview, grade calculations, and certificate management.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2 no-print" onClick={() => window.print()}>
            <Printer className="w-4 h-4" /> Print
          </Button>
          <Button variant="outline" size="sm" className="gap-2 no-print" onClick={() => exportCSVMut.mutate()}>
            <Download className="w-4 h-4" /> Export CSV
          </Button>
          <Button size="sm" className="gap-2 no-print" onClick={() => setTab("settings")}>
            <Settings className="w-4 h-4" /> Settings
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Assessments",    value: reports.length,    icon: <FileText className="w-4 h-4" />,    color: "text-foreground" },
          { label: "Submissions",    value: totalSubmissions,  icon: <Users className="w-4 h-4" />,       color: "text-primary" },
          { label: "Class Average",  value: `${avgClass}%`,    icon: <TrendingUp className="w-4 h-4" />, color: "text-emerald-500" },
          { label: "Pass Rate",
            value: totalSubmissions > 0 ? `${Math.round((totalPassed / (totalPassed + totalFailed)) * 100)}%` : "—",
            icon: <CheckCircle2 className="w-4 h-4" />, color: "text-teal-500" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">{s.icon}<span className="text-xs">{s.label}</span></div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 p-1 rounded-xl w-fit">
        {(["overview","export","appeals","settings"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
              tab === t ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "appeals" ? `Appeals${appeals?.length ? ` (${appeals.length})` : ""}` : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === "overview" && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Search assessments…" className="pl-8 h-9 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted/40 rounded-xl animate-pulse" />)}</div>
          ) : reports.length === 0 ? (
            <EmptyState icon="analytics" title="No graded assessments yet" description="Results will appear here after you grade your first assessment." />
          ) : (
            <div className="space-y-2">
              {reports.map((r, i) => {
                const pct = parseFloat(String(r.avg_pct ?? 0)) || 0;
                const passRate = (r.passed + r.failed) > 0
                  ? Math.round((r.passed / (r.passed + r.failed)) * 100)
                  : 0;

                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-card border border-border rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm truncate">{r.title}</span>
                          <Badge variant="secondary" className="text-[10px]">{r.type}</Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-[11px] text-muted-foreground">
                          <span>{r.submissions} submissions</span>
                          <span className="text-emerald-500">{r.passed} passed</span>
                          <span className="text-red-400">{r.failed} failed</span>
                          <span>Range: {r.min_pct}% – {r.max_pct}%</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold text-primary">{pct}%</p>
                        <p className="text-[11px] text-muted-foreground">class avg</p>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                        <span>Pass rate: {passRate}%</span>
                        <span>Avg: {pct}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div
                          className="bg-primary rounded-full h-1.5 transition-all"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {tab === "settings" && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-6 max-w-lg">
          <div>
            <h3 className="font-bold text-sm mb-1">Grade Weightings</h3>
            <p className="text-xs text-muted-foreground mb-4">Set the contribution of each assessment type to the final grade.</p>
            <div className="space-y-3">
              {[
                { key: "quiz_weight", label: "Quiz %" },
                { key: "homework_weight", label: "Homework %" },
                { key: "test_weight", label: "Tests %" },
                { key: "exam_weight", label: "Final Exam %" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <label className="text-sm w-28 text-muted-foreground">{label}</label>
                  <Input
                    type="number" min={0} max={100}
                    value={(settings as any)[key]}
                    onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}
                    className="w-24 h-8 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-bold text-sm mb-3">Grading Scale</h3>
            <div className="flex gap-2">
              {["igcse","percentage","letter"].map(scale => (
                <button
                  key={scale}
                  onClick={() => setSettings(s => ({ ...s, grading_scale: scale }))}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all capitalize ${
                    settings.grading_scale === scale ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                  }`}
                >
                  {scale === "igcse" ? "IGCSE (A*–U)" : scale === "percentage" ? "Percentage" : "Letter (A–F)"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-bold text-sm mb-2">IGCSE Grade Bands</h3>
            <div className="flex flex-wrap gap-1.5">
              {IGCSE_GRADES.map(g => (
                <span key={g} className={`px-2 py-0.5 rounded text-xs font-bold ${GRADE_COLOR[g] ?? ""}`}>{g}</span>
              ))}
            </div>
          </div>
          <Button onClick={() => saveSettingsMut.mutate()} disabled={saveSettingsMut.isPending}>
            {saveSettingsMut.isPending ? "Saving…" : "Save Settings"}
          </Button>
        </div>
      )}

      {/* Export Tab */}
      {tab === "export" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button className="gap-2" onClick={() => exportCSVMut.mutate()} disabled={exportCSVMut.isPending}>
              <Download className="w-4 h-4" />
              {exportCSVMut.isPending ? "Exporting…" : "Download CSV"}
            </Button>
            <p className="text-sm text-muted-foreground">Download all graded results as a spreadsheet.</p>
          </div>
          {exportData?.entries && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      {["Student","Assessment","Type","Score","Max","Pct","Grade","Submitted"].map(h => (
                        <th key={h} className="text-left px-3 py-2 font-semibold text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {exportData.entries.slice(0, 20).map((e, i) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">{e.student_name}</td>
                        <td className="px-3 py-2 text-muted-foreground truncate max-w-[120px]">{e.assessment_title}</td>
                        <td className="px-3 py-2"><Badge variant="secondary" className="text-[10px]">{e.assessment_type}</Badge></td>
                        <td className="px-3 py-2">{e.score}</td>
                        <td className="px-3 py-2 text-muted-foreground">{e.max_score}</td>
                        <td className="px-3 py-2 font-medium">{e.percentage}%</td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${GRADE_COLOR[e.grade] ?? ""}`}>{e.grade}</span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{e.submitted_at ? new Date(e.submitted_at).toLocaleDateString() : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Appeals Tab */}
      {tab === "appeals" && (
        <div className="space-y-3">
          {(!appeals || appeals.length === 0) ? (
            <div className="text-center py-16 border border-dashed border-border rounded-2xl">
              <CheckCircle2 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">No grade appeals at the moment</p>
            </div>
          ) : (
            appeals.map((appeal: any) => (
              <div key={appeal.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm">{appeal.student_name}</p>
                    <p className="text-xs text-muted-foreground">{appeal.assessment_title} · Grade: {appeal.grade}</p>
                    <p className="text-sm mt-2 text-muted-foreground">{appeal.reason}</p>
                  </div>
                  <Badge className={
                    appeal.status === "resolved" ? "bg-emerald-500/10 text-emerald-600" :
                    appeal.status === "under_review" ? "bg-blue-500/10 text-blue-600" :
                    "bg-amber-500/10 text-amber-600"
                  }>
                    {appeal.status}
                  </Badge>
                </div>
                {appeal.status === "requested" && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7"
                      onClick={() => resolveAppealMut.mutate({ id: appeal.id, resolution: "Grade upheld after review." })}
                    >
                      Uphold Grade
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => resolveAppealMut.mutate({ id: appeal.id, resolution: "Grade adjusted after review." })}
                    >
                      Adjust Grade
                    </Button>
                  </div>
                )}
                {appeal.resolution && (
                  <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                    Resolution: {appeal.resolution}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
