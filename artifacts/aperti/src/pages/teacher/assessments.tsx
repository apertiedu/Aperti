import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, ClipboardList, Eye, Send, Trash2, Clock, Users,
  BarChart3, ChevronRight, Search, GraduationCap, Zap,
  BookOpen, Edit3, Mic, Layers, FileText, Settings,
  CheckCircle2, ArrowRight, ArrowLeft, Shield,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { InlineError } from "@/components/inline-error";

const TYPES = [
  { id: "quiz",         label: "Quiz",          icon: Zap,          desc: "Short formative check", color: "border-amber-200 bg-amber-50 text-amber-700" },
  { id: "homework",     label: "Homework",       icon: BookOpen,     desc: "Take-home assignment",   color: "border-blue-200 bg-blue-50 text-blue-700" },
  { id: "topic_test",   label: "Topic Test",     icon: FileText,     desc: "End-of-topic assessment",color: "border-violet-200 bg-violet-50 text-violet-700" },
  { id: "unit_test",    label: "Unit Test",      icon: Layers,       desc: "Full unit evaluation",   color: "border-orange-200 bg-orange-50 text-orange-700" },
  { id: "progress_test",label: "Progress Test",  icon: BarChart3,    desc: "Mid-course check",       color: "border-primary/25 bg-primary/8 text-primary" },
  { id: "mock_exam",    label: "Mock Exam",      icon: GraduationCap,desc: "Exam practice paper",    color: "border-red-200 bg-red-50 text-red-700" },
  { id: "practical",    label: "Practical",      icon: Zap,          desc: "Lab / hands-on work",    color: "border-green-200 bg-green-50 text-green-700" },
  { id: "coursework",   label: "Coursework",     icon: Edit3,        desc: "Extended project",       color: "border-indigo-200 bg-indigo-50 text-indigo-700" },
  { id: "oral",         label: "Oral Exam",      icon: Mic,          desc: "Speaking assessment",    color: "border-pink-200 bg-pink-50 text-pink-700" },
  { id: "final_exam",   label: "Final Exam",     icon: ClipboardList,desc: "Summative exam paper",   color: "border-red-300 bg-red-50 text-red-800" },
] as const;

const SECURITY_LEVELS = [
  { id: "low",    label: "Low",    desc: "Open navigation, no restrictions" },
  { id: "medium", label: "Medium", desc: "Tab-switch monitoring, no back navigation" },
  { id: "high",   label: "High",   desc: "Full lockdown, all anti-cheat enabled" },
];

const STEPS = ["Type", "Details", "Security", "Review"];

interface WizardForm {
  type: string;
  title: string;
  instructions: string;
  total_marks: string;
  time_limit_minutes: string;
  passing_mark: string;
  due_at: string;
  scheduled_for: string;
  security_level: string;
  shuffle_questions: boolean;
  show_results_immediately: boolean;
  allow_back_navigation: boolean;
}

const DEFAULT_FORM: WizardForm = {
  type: "quiz", title: "", instructions: "", total_marks: "0",
  time_limit_minutes: "", passing_mark: "", due_at: "", scheduled_for: "",
  security_level: "medium", shuffle_questions: false,
  show_results_immediately: false, allow_back_navigation: true,
};

function CreateWizard({ onClose, onCreate }: { onClose: () => void; onCreate: (id: number) => void }) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<WizardForm>(DEFAULT_FORM);

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
          scheduled_for: form.scheduled_for || null,
          settings: {
            security_level: form.security_level,
            shuffle_questions: form.shuffle_questions,
            show_results_immediately: form.show_results_immediately,
            allow_back_navigation: form.allow_back_navigation,
          },
        }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => { toast({ title: "Assessment created" }); onCreate(data.assessment.id); },
    onError: () => toast({ title: "Failed to create", variant: "destructive" }),
  });

  const canNext = step === 0 ? !!form.type : step === 1 ? !!form.title.trim() : true;
  const selectedType = TYPES.find(t => t.id === form.type);

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg">Create Assessment</h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
          </div>
          {/* Step indicator */}
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
                  i < step ? "bg-emerald-500 text-white" : i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  {i < step ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className={`text-xs font-medium hidden sm:inline ${i === step ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
                {i < STEPS.length - 1 && <div className={`w-8 h-px ${i < step ? "bg-emerald-500" : "bg-border"}`} />}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <AnimatePresence mode="wait">
            {/* STEP 0 — TYPE */}
            {step === 0 && (
              <motion.div key="type" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <p className="text-sm text-muted-foreground mb-4">What kind of assessment are you creating?</p>
                <div className="grid grid-cols-2 gap-2.5">
                  {TYPES.map(t => {
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setForm(f => ({ ...f, type: t.id }))}
                        className={`flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                          form.type === t.id ? `${t.color} border-current shadow-sm scale-[1.01]` : "border-border hover:border-primary/40 hover:bg-muted/50"
                        }`}
                      >
                        <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold leading-tight">{t.label}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{t.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* STEP 1 — DETAILS */}
            {step === 1 && (
              <motion.div key="details" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                {selectedType && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${selectedType.color}`}>
                    <selectedType.icon className="w-3.5 h-3.5" />{selectedType.label}
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Title *</label>
                  <Input placeholder="e.g. Chapter 8 Mock Exam — Chemical Bonding" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
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
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none h-24 outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Instructions for students (visible before they start)…"
                    value={form.instructions}
                    onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
                  />
                </div>
              </motion.div>
            )}

            {/* STEP 2 — SECURITY */}
            {step === 2 && (
              <motion.div key="security" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                <p className="text-sm text-muted-foreground">Configure how the exam is delivered and secured.</p>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 block">Security Level</label>
                  <div className="space-y-2">
                    {SECURITY_LEVELS.map(s => (
                      <button
                        key={s.id}
                        onClick={() => setForm(f => ({ ...f, security_level: s.id }))}
                        className={`w-full flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                          form.security_level === s.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/30"
                        }`}
                      >
                        <Shield className={`w-4 h-4 mt-0.5 shrink-0 ${form.security_level === s.id ? "text-primary" : "text-muted-foreground"}`} />
                        <div>
                          <p className="text-sm font-semibold">{s.label}</p>
                          <p className="text-xs text-muted-foreground">{s.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">Options</label>
                  {[
                    { key: "shuffle_questions", label: "Shuffle question order" },
                    { key: "show_results_immediately", label: "Show results immediately after submission" },
                    { key: "allow_back_navigation", label: "Allow back navigation between questions" },
                  ].map(opt => (
                    <label key={opt.key} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(form as any)[opt.key]}
                        onChange={e => setForm(f => ({ ...f, [opt.key]: e.target.checked }))}
                        className="w-4 h-4 accent-primary"
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP 3 — REVIEW */}
            {step === 3 && (
              <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <p className="text-sm text-muted-foreground">Review your assessment before creating it.</p>
                <div className="bg-muted/50 rounded-xl p-4 space-y-3 text-sm">
                  {[
                    ["Type", TYPES.find(t => t.id === form.type)?.label ?? form.type],
                    ["Title", form.title],
                    ["Total Marks", form.total_marks],
                    ["Time Limit", form.time_limit_minutes ? `${form.time_limit_minutes} minutes` : "No limit"],
                    ["Security", SECURITY_LEVELS.find(s => s.id === form.security_level)?.label],
                    ["Shuffle Questions", form.shuffle_questions ? "Yes" : "No"],
                    ["Back Navigation", form.allow_back_navigation ? "Allowed" : "Disabled"],
                    ["Show Results Immediately", form.show_results_immediately ? "Yes" : "No"],
                  ].map(([k, v]) => (
                    <div key={String(k)} className="flex justify-between gap-4">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="font-medium text-right">{v || "—"}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                  After creating, you'll be taken to the Assessment Builder to add questions and sections.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-3 border-t border-border flex justify-between">
          <Button variant="outline" onClick={step === 0 ? onClose : () => setStep(s => s - 1)}>
            {step === 0 ? "Cancel" : <><ArrowLeft className="w-3.5 h-3.5 mr-1" />Back</>}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(s => s + 1)} disabled={!canNext}>
              Next <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          ) : (
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
              {createMut.isPending ? "Creating…" : "Create & Open Builder"}
            </Button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function TeacherAssessments() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["assessments"],
    queryFn: async () => {
      const res = await apiFetch("/api/assessments");
      if (!res.ok) throw new Error(`Failed to load assessments (${res.status})`);
      return (await res.json()).assessments ?? [];
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/assessments/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assessments"] }); toast({ title: "Archived" }); },
  });

  const publishMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/assessments/${id}/publish`, { method: "POST" });
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assessments"] }); toast({ title: "Published" }); },
  });

  const assessments = (data ?? []).filter((a: any) => {
    const matchSearch = !search || a.title.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "all" || a.type === filterType;
    const matchStatus = filterStatus === "all" || a.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  const STATUS_COLOR: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    scheduled: "bg-blue-500/10 text-blue-600",
    published: "bg-emerald-500/10 text-emerald-600",
    active: "bg-primary/10 text-primary",
    completed: "bg-violet-500/10 text-violet-600",
    archived: "bg-muted/60 text-muted-foreground/60",
  };

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {showCreate && (
          <CreateWizard
            onClose={() => setShowCreate(false)}
            onCreate={(id) => { setShowCreate(false); qc.invalidateQueries({ queryKey: ["assessments"] }); window.location.href = `/teacher/assessments/${id}/builder`; }}
          />
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-primary" /> Assessments
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create and manage all your assessments.</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Assessment
        </Button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: data?.length ?? 0 },
          { label: "Published", value: data?.filter((a: any) => ["published","active"].includes(a.status)).length ?? 0 },
          { label: "Draft", value: data?.filter((a: any) => a.status === "draft").length ?? 0 },
          { label: "Submissions", value: data?.reduce((s: number, a: any) => s + (parseInt(a.submission_count ?? 0) || 0), 0) ?? 0 },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-3">
            <p className="text-2xl font-bold text-primary">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Search…" className="pl-8 h-9 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="rounded-lg border border-border bg-background px-3 py-2 text-sm" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="all">All Types</option>
          {TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <select className="rounded-lg border border-border bg-background px-3 py-2 text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          {["all","draft","scheduled","published","active","completed"].map(s => (
            <option key={s} value={s}>{s === "all" ? "All Statuses" : s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {isError ? (
        <InlineError message="Could not load assessments. Please try again." onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-20 bg-muted/40 rounded-xl animate-pulse" />)}</div>
      ) : assessments.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-2xl">
          <GraduationCap className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No assessments found</p>
          <Button variant="outline" className="mt-4 gap-2" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" /> Create First Assessment
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {assessments.map((a: any) => (
            <motion.div key={a.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:border-primary/30 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{a.title}</span>
                  <Badge variant="secondary" className="text-[10px]">{TYPES.find(t => t.id === a.type)?.label ?? a.type}</Badge>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLOR[a.status] ?? ""}`}>{a.status}</span>
                </div>
                <div className="flex items-center gap-4 mt-1 text-[11px] text-muted-foreground">
                  <span>{a.total_marks} marks</span>
                  {a.time_limit_minutes && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{a.time_limit_minutes}min</span>}
                  {a.submission_count > 0 && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{a.submission_count} submissions</span>}
                  {a.avg_score && <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" />Avg {a.avg_score}%</span>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link href={`/teacher/assessments/${a.id}/builder`}>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                    <Edit3 className="w-3 h-3" /> Build
                  </Button>
                </Link>
                {a.status === "draft" && (
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => publishMut.mutate(a.id)}>
                    <Send className="w-3 h-3" /> Publish
                  </Button>
                )}
                {["published","active"].includes(a.status) && (
                  <Link href={`/teacher/assessments/${a.id}/monitor`}>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                      <Eye className="w-3 h-3" /> Monitor
                    </Button>
                  </Link>
                )}
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteMut.mutate(a.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
