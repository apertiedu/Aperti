import { apiFetch } from "@/lib/api";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DiscussButton from "@/components/discuss-button";
import {
  BookOpen, Clock, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp,
  Send, Edit3, Award, Paperclip, X, FileText, ImageIcon, RotateCcw,
  MessageSquare, Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type HW = {
  id: number; title: string; description: string | null; instructions: string | null;
  dueDate: string | null; totalMarks: string | null; allowLate: boolean;
  subjectName: string | null; submissionId: number | null; submissionStatus: string | null;
  submissionContent: string | null; marksAwarded: string | null; teacherFeedback: string | null;
  submittedAt: string | null; gradedAt: string | null; createdAt: string;
};

type TabId = "pending" | "submitted" | "overdue" | "returned" | "resubmission";

const TAB_CONFIG: { id: TabId; label: string; color: string }[] = [
  { id: "pending",      label: "Pending",      color: "text-blue-600" },
  { id: "submitted",    label: "Submitted",    color: "text-teal-600" },
  { id: "overdue",      label: "Overdue",      color: "text-red-600" },
  { id: "returned",     label: "Returned",     color: "text-emerald-600" },
  { id: "resubmission", label: "Resubmission", color: "text-orange-600" },
];

function FileUploader({ onUploaded }: { onUploaded: (url: string, name: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { toast } = useToast();

  const handleFile = async (file: File) => {
    if (!["image/png", "image/jpeg", "image/jpg", "application/pdf"].includes(file.type)) {
      toast({ variant: "destructive", title: "Unsupported file type", description: "Only PNG, JPG and PDF files are supported." });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large", description: "File must be under 10 MB." });
      return;
    }
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const fileData = e.target?.result as string;
        const res = await apiFetch("/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name, fileType: file.type, fileData }),
        });
        if (!res.ok) throw new Error("Upload failed");
        const { url } = await res.json();
        onUploaded(url, file.name);
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      toast({ variant: "destructive", title: "Upload failed", description: "Please try again." });
      setUploading(false);
    }
  };

  return (
    <div>
      <input ref={inputRef} type="file" accept=".png,.jpg,.jpeg,.pdf" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
      <Button type="button" variant="outline" size="sm" className="gap-2 text-xs border-dashed" disabled={uploading}
        onClick={() => inputRef.current?.click()}>
        {uploading
          ? <><div className="h-3 w-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />Uploading…</>
          : <><Paperclip className="h-3 w-3" />Attach file</>}
      </Button>
    </div>
  );
}

function AttachedFile({ name, url, onRemove }: { name: string; url: string; onRemove?: () => void }) {
  const isPdf = url.endsWith(".pdf");
  return (
    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
      {isPdf ? <FileText className="h-4 w-4 text-red-500 shrink-0" /> : <ImageIcon className="h-4 w-4 text-blue-500 shrink-0" />}
      <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-700 underline truncate max-w-[180px]">{name}</a>
      {onRemove && <button type="button" onClick={onRemove} className="ml-auto text-gray-400 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>}
    </div>
  );
}

function AssignmentCard({ hw, today, expanded, onToggle, onSubmit, draft, onDraftChange, attachments, onAttach, onRemoveAttach, submitting }: any) {
  const isOverdue = hw.dueDate && hw.dueDate < today && !["submitted", "graded"].includes(hw.submissionStatus || "");
  const status = hw.submissionStatus;

  let parsedContent: { text?: string; files?: Array<{ url: string; name: string }> } | null = null;
  if (hw.submissionContent) {
    try { parsedContent = JSON.parse(hw.submissionContent); } catch { parsedContent = { text: hw.submissionContent }; }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={`bg-card rounded-2xl border shadow-sm overflow-hidden ${isOverdue ? "border-red-200" : "border-border"}`}
      role="article" aria-label={`Assignment: ${hw.title}`}>
      <button className="w-full flex items-start gap-4 p-5 text-left hover:bg-gray-50/50 transition-colors"
        onClick={onToggle} aria-expanded={expanded}>
        <div className={`w-1 self-stretch rounded-full shrink-0 ${isOverdue ? "bg-red-400" : status === "graded" ? "bg-emerald-400" : status === "submitted" ? "bg-teal-400" : "bg-primary/40"}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <p className="font-bold text-gray-900 text-sm">{hw.title}</p>
            <div className="flex items-center gap-2 shrink-0">
              {status === "graded" && hw.marksAwarded && (
                <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">{hw.marksAwarded}/{hw.totalMarks}</span>
              )}
              {isOverdue && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-100 text-red-700">Overdue</span>}
              {!isOverdue && status === "submitted" && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-teal-100 text-teal-700">Submitted</span>}
              {!isOverdue && status === "graded" && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-700">Graded</span>}
              {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-400">
            {hw.subjectName && <span className="text-teal-600 font-medium">{hw.subjectName}</span>}
            {hw.dueDate && (
              <span className={`flex items-center gap-1 ${isOverdue ? "text-red-500 font-medium" : ""}`}>
                <Clock className="h-3 w-3" />
                {isOverdue ? "Overdue — " : "Due "}
                {new Date(hw.dueDate + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
              </span>
            )}
            {hw.totalMarks && <span><Award className="h-3 w-3 inline mr-0.5" />{hw.totalMarks} marks</span>}
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
            <div className="px-5 pb-5 space-y-4 border-t border-gray-50 pt-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400 font-medium">Have a question?</p>
                <DiscussButton contextType="assignment" contextId={hw.id} contextTitle={hw.title} size="sm" />
              </div>
              {hw.description && <p className="text-sm text-gray-600">{hw.description}</p>}
              {hw.instructions && (
                <div className="bg-primary/5 border border-primary/15 rounded-xl p-3">
                  <p className="text-xs font-semibold text-primary mb-1">Instructions</p>
                  <p className="text-xs text-gray-700 whitespace-pre-wrap">{hw.instructions}</p>
                </div>
              )}

              {status === "graded" ? (
                <div className="space-y-3">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-bold text-emerald-800">Graded ✅</p>
                      {hw.marksAwarded !== null && hw.totalMarks && (
                        <span className="text-xl font-black text-emerald-700">{hw.marksAwarded} / {hw.totalMarks}</span>
                      )}
                    </div>
                    {hw.teacherFeedback && (
                      <div className="mt-2 flex gap-2">
                        <MessageSquare className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-emerald-700 whitespace-pre-wrap">{hw.teacherFeedback}</p>
                      </div>
                    )}
                  </div>
                  {parsedContent?.text && (
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500 font-medium mb-1">Your answer</p>
                      <p className="text-xs text-gray-700 whitespace-pre-wrap">{parsedContent.text}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <Textarea
                    className="text-sm min-h-[100px] resize-none border-gray-200 rounded-xl focus:border-primary/50"
                    placeholder="Write your answer here…"
                    value={draft ?? ""}
                    onChange={(e) => onDraftChange(e.target.value)}
                    aria-label="Assignment answer"
                  />
                  <div className="space-y-2">
                    <FileUploader onUploaded={(url, name) => onAttach(url, name)} />
                    {attachments?.length > 0 && (
                      <div className="space-y-1.5">
                        {attachments.map((f: any, idx: number) => (
                          <AttachedFile key={idx} url={f.url} name={f.name} onRemove={() => onRemoveAttach(idx)} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-2 text-xs" disabled={submitting}
                      onClick={() => onSubmit(true)}>
                      <Edit3 className="h-3 w-3" /> Save Draft
                    </Button>
                    <Button size="sm" className="gap-2 text-xs" style={{ background: "#0D9488" }}
                      disabled={submitting || (!draft?.trim() && !attachments?.length)}
                      onClick={() => onSubmit(false)}>
                      <Send className="h-3 w-3" />{submitting ? "Submitting…" : "Submit"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function AssignmentCenter() {
  const { toast } = useToast();
  const [homework, setHomework] = useState<HW[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [attachments, setAttachments] = useState<Record<number, Array<{ url: string; name: string }>>>({});
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("pending");

  const load = () => {
    apiFetch("/api/portal/homework", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: HW[]) => {
        setHomework(rows);
        const d: Record<number, string> = {};
        rows.forEach((h) => { if (h.submissionContent) { try { d[h.id] = JSON.parse(h.submissionContent).text || ""; } catch { d[h.id] = h.submissionContent; } } });
        setDrafts(d);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (hwId: number, isDraft: boolean) => {
    setSubmitting(hwId);
    try {
      const attachList = attachments[hwId] || [];
      const res = await apiFetch(`/api/portal/homework/${hwId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: JSON.stringify({ text: drafts[hwId] || "", files: attachList }), isDraft }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || "Submit failed"); }
      toast({ title: isDraft ? "Draft saved" : "Submitted! ✅" });
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSubmitting(null); }
  };

  const today = new Date().toISOString().split("T")[0];

  const tabData: Record<TabId, HW[]> = {
    pending: homework.filter(h => !h.submissionStatus || h.submissionStatus === "draft")
              .filter(h => !h.dueDate || h.dueDate >= today),
    submitted: homework.filter(h => h.submissionStatus === "submitted"),
    overdue: homework.filter(h => h.dueDate && h.dueDate < today && !["submitted", "graded"].includes(h.submissionStatus || "")),
    returned: homework.filter(h => h.submissionStatus === "graded"),
    resubmission: homework.filter(h => h.submissionStatus === "graded" && h.allowLate),
  };

  return (
    <div className="min-h-screen bg-[#F8FAFB] px-4 py-6 max-w-3xl mx-auto" style={{ fontFamily: "Inter, sans-serif" }}>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center">
            <BookOpen className="h-4.5 w-4.5 text-blue-600" style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900">Assignment Center</h1>
            <p className="text-xs text-gray-500">Manage all your homework and submissions</p>
          </div>
        </div>
      </motion.div>

      {/* Summary bar */}
      {!loading && (
        <div className="grid grid-cols-4 gap-2 mb-5">
          {[
            { label: "Pending", count: tabData.pending.length, color: "text-blue-700", bg: "bg-blue-50" },
            { label: "Submitted", count: tabData.submitted.length, color: "text-teal-700", bg: "bg-teal-50" },
            { label: "Overdue", count: tabData.overdue.length, color: "text-red-700", bg: "bg-red-50" },
            { label: "Returned", count: tabData.returned.length, color: "text-emerald-700", bg: "bg-emerald-50" },
          ].map(({ label, count, color, bg }) => (
            <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
              <p className={`text-xl font-black ${color}`}>{count}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-5 overflow-x-auto">
        {TAB_CONFIG.map(({ id, label }) => {
          const count = tabData[id]?.length ?? 0;
          return (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}>
              {label}
              {count > 0 && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                  activeTab === id ? "bg-primary/10 text-primary" : "bg-gray-200 text-gray-600"
                }`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : tabData[activeTab].length === 0 ? (
        <div className="py-16 text-center text-gray-400 bg-card rounded-2xl border border-border">
          {activeTab === "overdue"
            ? <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-20" />
            : activeTab === "returned"
            ? <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-20" />
            : <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-20" />}
          <p className="font-medium text-sm">
            {activeTab === "pending" ? "All caught up! 🎉"
              : activeTab === "overdue" ? "No overdue work — great job!"
              : activeTab === "returned" ? "No graded work yet"
              : activeTab === "resubmission" ? "No resubmissions needed"
              : `No ${activeTab} assignments`}
          </p>
        </div>
      ) : (
        <div className="space-y-3" role="list">
          {tabData[activeTab].map((hw) => (
            <AssignmentCard
              key={hw.id}
              hw={hw}
              today={today}
              expanded={expandedId === hw.id}
              onToggle={() => setExpandedId(expandedId === hw.id ? null : hw.id)}
              onSubmit={(isDraft: boolean) => handleSubmit(hw.id, isDraft)}
              draft={drafts[hw.id] ?? ""}
              onDraftChange={(v: string) => setDrafts((d) => ({ ...d, [hw.id]: v }))}
              attachments={attachments[hw.id] || []}
              onAttach={(url: string, name: string) => setAttachments((a) => ({ ...a, [hw.id]: [...(a[hw.id] || []), { url, name }] }))}
              onRemoveAttach={(idx: number) => setAttachments((a) => ({ ...a, [hw.id]: (a[hw.id] || []).filter((_: any, i: number) => i !== idx) }))}
              submitting={submitting === hw.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
