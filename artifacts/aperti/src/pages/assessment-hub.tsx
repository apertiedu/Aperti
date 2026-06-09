import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import UpgradeModal from "@/components/upgrade-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, ClipboardList, FileText, Eye, Send, Trash2,
  Users, Clock, BarChart3, ChevronRight, Search, Filter,
  CheckCircle2, AlertCircle, Edit3, Download, Zap,
  BookOpen, Award, Mic, Layers,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

type AssessmentType = "homework" | "quiz" | "topic_test" | "unit_test" | "progress_test" |
  "mock_exam" | "practical" | "coursework" | "project" | "oral" | "final_exam" | "certification";
type AssessmentStatus = "draft" | "scheduled" | "published" | "active" | "completed" | "archived";

const TYPE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  homework:       { label: "Homework",         icon: <BookOpen className="w-3.5 h-3.5" />,    color: "bg-blue-500/10 text-blue-600" },
  quiz:           { label: "Quiz",             icon: <Zap className="w-3.5 h-3.5" />,          color: "bg-amber-500/10 text-amber-600" },
  topic_test:     { label: "Topic Test",       icon: <FileText className="w-3.5 h-3.5" />,     color: "bg-violet-500/10 text-violet-600" },
  unit_test:      { label: "Unit Test",        icon: <Layers className="w-3.5 h-3.5" />,       color: "bg-orange-500/10 text-orange-600" },
  progress_test:  { label: "Progress Test",    icon: <BarChart3 className="w-3.5 h-3.5" />,    color: "bg-teal-500/10 text-teal-600" },
  mock_exam:      { label: "Mock Exam",        icon: <ClipboardList className="w-3.5 h-3.5" />,color: "bg-red-500/10 text-red-600" },
  practical:      { label: "Practical",        icon: <Zap className="w-3.5 h-3.5" />,          color: "bg-green-500/10 text-green-600" },
  coursework:     { label: "Coursework",       icon: <Edit3 className="w-3.5 h-3.5" />,        color: "bg-indigo-500/10 text-indigo-600" },
  oral:           { label: "Oral Exam",        icon: <Mic className="w-3.5 h-3.5" />,          color: "bg-pink-500/10 text-pink-600" },
  final_exam:     { label: "Final Exam",       icon: <ClipboardList className="w-3.5 h-3.5" />,color: "bg-red-600/10 text-red-700" },
  certification:  { label: "Certification",    icon: <Award className="w-3.5 h-3.5" />,        color: "bg-yellow-500/10 text-yellow-600" },
  project:        { label: "Project",          icon: <Layers className="w-3.5 h-3.5" />,       color: "bg-cyan-500/10 text-cyan-600" },
};

const STATUS_META: Record<AssessmentStatus, { label: string; color: string }> = {
  draft:        { label: "Draft",        color: "bg-muted text-muted-foreground" },
  scheduled:    { label: "Scheduled",   color: "bg-blue-500/10 text-blue-600" },
  published:    { label: "Published",   color: "bg-emerald-500/10 text-emerald-600" },
  active:       { label: "Active",      color: "bg-primary/10 text-primary" },
  completed:    { label: "Completed",   color: "bg-violet-500/10 text-violet-600" },
  archived:     { label: "Archived",    color: "bg-muted text-muted-foreground/60" },
};

interface Assessment {
  id: number;
  title: string;
  type: AssessmentType;
  status: AssessmentStatus;
  total_marks: number;
  time_limit_minutes: number | null;
  submission_count: number;
  avg_score: number | null;
  created_at: string;
  due_at: string | null;
}

const DEFAULT_FORM = {
  title: "",
  type: "quiz" as AssessmentType,
  instructions: "",
  time_limit_minutes: "",
  total_marks: "0",
  passing_mark: "",
  due_at: "",
};

function CreateModal({ open, onClose, onLimitExceeded }: { open: boolean; onClose: () => void; onLimitExceeded?: (msg: string) => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState(DEFAULT_FORM);

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          time_limit_minutes: form.time_limit_minutes ? parseInt(form.time_limit_minutes) : null,
          total_marks: parseFloat(form.total_marks) || 0,
          passing_mark: form.passing_mark ? parseFloat(form.passing_mark) : null,
          due_at: form.due_at || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403 && data.code === "LIMIT_EXCEEDED") {
        onLimitExceeded?.(data.error);
        return null;
      }
      if (!res.ok) throw new Error(data.error || "Failed to create");
      return data;
    },
    onSuccess: (data) => {
      if (!data) return;
      qc.invalidateQueries({ queryKey: ["assessments"] });
      onClose();
      setForm(DEFAULT_FORM);
      toast({ title: "Assessment created" });
    },
    onError: () => toast({ title: "Failed to create assessment", variant: "destructive" }),
  });

  if (!open) return null;
  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="font-bold text-lg">Create Assessment</h2>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Title *</label>
          <Input
            placeholder="e.g. Chapter 5 Quiz — Forces"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Type</label>
          <div className="grid grid-cols-3 gap-2">
            {(["quiz","homework","topic_test","unit_test","mock_exam","practical","coursework","oral","final_exam"] as AssessmentType[]).map(t => (
              <button
                key={t}
                onClick={() => setForm(f => ({ ...f, type: t }))}
                className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium transition-all text-left ${
                  form.type === t ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/30 text-muted-foreground"
                }`}
              >
                {TYPE_META[t]?.icon}
                <span>{TYPE_META[t]?.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Total Marks</label>
            <Input type="number" min={0} value={form.total_marks} onChange={e => setForm(f => ({ ...f, total_marks: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Time Limit (min)</label>
            <Input type="number" min={0} placeholder="No limit" value={form.time_limit_minutes} onChange={e => setForm(f => ({ ...f, time_limit_minutes: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Passing Mark</label>
            <Input type="number" min={0} placeholder="Optional" value={form.passing_mark} onChange={e => setForm(f => ({ ...f, passing_mark: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Due Date</label>
            <Input type="datetime-local" value={form.due_at} onChange={e => setForm(f => ({ ...f, due_at: e.target.value }))} />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Instructions</label>
          <textarea
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none h-20 outline-none focus:ring-1 focus:ring-primary"
            placeholder="Instructions for students…"
            value={form.instructions}
            onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
          />
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={() => createMut.mutate()} disabled={!form.title.trim() || createMut.isPending}>
            {createMut.isPending ? "Creating…" : "Create"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function AssessmentHub() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["assessments"],
    queryFn: async () => {
      const res = await apiFetch("/api/assessments");
      return (await res.json()).assessments as Assessment[];
    },
  });

  const publishMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/assessments/${id}/publish`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assessments"] }); toast({ title: "Assessment published" }); },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => apiFetch(`/api/assessments/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assessments"] }); toast({ title: "Assessment archived" }); },
  });

  const assessments = (data ?? []).filter(a => {
    const matchSearch = !search || a.title.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || a.status === filterStatus;
    const matchType = filterType === "all" || a.type === filterType;
    return matchSearch && matchStatus && matchType;
  });

  const stats = {
    total: data?.length ?? 0,
    published: data?.filter(a => ["published","active"].includes(a.status)).length ?? 0,
    draft: data?.filter(a => a.status === "draft").length ?? 0,
    avgScore: data && data.length > 0
      ? Math.round(data.reduce((s, a) => s + (parseFloat(String(a.avg_score ?? 0)) || 0), 0) / data.length)
      : 0,
  };

  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeMsg, setUpgradeMsg] = useState<string | undefined>(undefined);

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {showCreate && (
          <CreateModal
            open={showCreate}
            onClose={() => setShowCreate(false)}
            onLimitExceeded={(msg) => { setUpgradeMsg(msg); setUpgradeOpen(true); }}
          />
        )}
      </AnimatePresence>

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        resource="assessments"
        message={upgradeMsg}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" />
            Assessment Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create, manage, and grade all assessments in one place.</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Assessment
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total",     value: stats.total,     color: "text-foreground" },
          { label: "Published", value: stats.published, color: "text-emerald-500" },
          { label: "Draft",     value: stats.draft,     color: "text-amber-500" },
          { label: "Avg Score", value: `${stats.avgScore}%`, color: "text-primary" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-3">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search assessments…"
            className="pl-8 h-9 text-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="all">All Statuses</option>
          {Object.entries(STATUS_META).map(([v, m]) => (
            <option key={v} value={v}>{m.label}</option>
          ))}
        </select>
        <select
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
        >
          <option value="all">All Types</option>
          {Object.entries(TYPE_META).map(([v, m]) => (
            <option key={v} value={v}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-20 bg-muted/40 rounded-xl animate-pulse" />)}
        </div>
      ) : assessments.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-2xl">
          <ClipboardList className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-medium text-muted-foreground">No assessments found</p>
          <Button variant="outline" className="mt-4 gap-2" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" /> Create First Assessment
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {assessments.map(a => {
              const typeMeta = TYPE_META[a.type] ?? TYPE_META.quiz;
              const statusMeta = STATUS_META[a.status] ?? STATUS_META.draft;
              return (
                <motion.div
                  key={a.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:border-primary/30 transition-colors group cursor-pointer"
                  onClick={() => setSelectedId(selectedId === a.id ? null : a.id)}
                >
                  <div className={`p-2 rounded-lg ${typeMeta.color.replace("text-", "bg-").replace("/10", "/10")}`}>
                    {typeMeta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm truncate">{a.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${typeMeta.color}`}>
                        {typeMeta.label}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusMeta.color}`}>
                        {statusMeta.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-[11px] text-muted-foreground">
                      <span>{a.total_marks} marks</span>
                      {a.time_limit_minutes && (
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{a.time_limit_minutes}min</span>
                      )}
                      {a.submission_count > 0 && (
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{a.submission_count} submitted</span>
                      )}
                      {a.avg_score && (
                        <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" />Avg {a.avg_score}%</span>
                      )}
                      {a.due_at && (
                        <span className="text-amber-500">Due {new Date(a.due_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {a.status === "draft" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={e => { e.stopPropagation(); publishMut.mutate(a.id); }}
                      >
                        <Send className="w-3 h-3" /> Publish
                      </Button>
                    )}
                    {["submitted","graded"].includes(a.status) || a.submission_count > 0 ? (
                      <Link href={`/assessment-hub/${a.id}/submissions`}>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                          onClick={e => e.stopPropagation()}>
                          <Eye className="w-3 h-3" /> Submissions
                        </Button>
                      </Link>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={e => { e.stopPropagation(); deleteMut.mutate(a.id); }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${selectedId === a.id ? "rotate-90" : ""}`} />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
