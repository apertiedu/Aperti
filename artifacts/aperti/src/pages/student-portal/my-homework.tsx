import { apiFetch } from "@/lib/api";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, Clock, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp,
  Send, Edit3, Award, Paperclip, X, FileText, ImageIcon, Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type HW = {
  id: number; title: string; description: string | null; instructions: string | null;
  dueDate: string | null; totalMarks: string | null; allowLate: boolean;
  subjectName: string | null; submissionId: number | null; submissionStatus: string | null;
  submissionContent: string | null; marksAwarded: string | null; teacherFeedback: string | null;
  submittedAt: string | null; gradedAt: string | null; createdAt: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  draft: { label: "Draft", color: "text-gray-600", bg: "bg-gray-100", icon: Edit3 },
  submitted: { label: "Submitted", color: "text-blue-600", bg: "bg-blue-100", icon: CheckCircle2 },
  graded: { label: "Graded", color: "text-emerald-600", bg: "bg-emerald-100", icon: Award },
};

function FileUploader({ onUploaded }: { onUploaded: (url: string, name: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!["image/png", "image/jpeg", "image/jpg", "application/pdf"].includes(file.type)) {
      alert("Only PNG, JPG and PDF files are supported.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("File must be under 10 MB.");
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
      alert("Upload failed. Please try again.");
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.pdf"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2 text-xs border-dashed"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <><div className="h-3 w-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />Uploading…</>
        ) : (
          <><Paperclip className="h-3 w-3" />Attach file (PNG, JPG, PDF)</>
        )}
      </Button>
    </div>
  );
}

function AttachedFile({ name, url, onRemove }: { name: string; url: string; onRemove: () => void }) {
  const isPdf = url.endsWith(".pdf");
  return (
    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
      {isPdf ? <FileText className="h-4 w-4 text-red-500 shrink-0" /> : <ImageIcon className="h-4 w-4 text-blue-500 shrink-0" />}
      <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-700 underline truncate max-w-[180px]">{name}</a>
      {onRemove && (
        <button type="button" onClick={onRemove} className="ml-auto text-gray-400 hover:text-red-500">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export default function MyHomework() {
  const { toast } = useToast();
  const [homework, setHomework] = useState<HW[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [attachments, setAttachments] = useState<Record<number, Array<{ url: string; name: string }>>>({});
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "submitted" | "graded">("pending");

  const load = () => {
    apiFetch("/api/portal/homework", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then((rows: HW[]) => {
        setHomework(rows);
        const d: Record<number, string> = {};
        rows.forEach(h => { if (h.submissionContent) d[h.id] = h.submissionContent; });
        setDrafts(d);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const addAttachment = (hwId: number, url: string, name: string) => {
    setAttachments(a => ({ ...a, [hwId]: [...(a[hwId] || []), { url, name }] }));
    toast({ title: "File attached", description: name });
  };

  const removeAttachment = (hwId: number, index: number) => {
    setAttachments(a => ({ ...a, [hwId]: (a[hwId] || []).filter((_, i) => i !== index) }));
  };

  const handleSubmit = async (hwId: number, isDraft: boolean) => {
    setSubmitting(hwId);
    try {
      const attachList = attachments[hwId] || [];
      const contentPayload = JSON.stringify({
        text: drafts[hwId] || "",
        files: attachList,
      });
      const res = await apiFetch(`/api/portal/homework/${hwId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: contentPayload, isDraft }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || "Submit failed"); }
      toast({ title: isDraft ? "Draft saved" : "Homework submitted! ✅" });
      load();
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setSubmitting(null); }
  };

  const today = new Date().toISOString().split("T")[0];
  const pending = homework.filter(h => !h.submissionStatus || h.submissionStatus === "draft");
  const submitted = homework.filter(h => h.submissionStatus === "submitted");
  const graded = homework.filter(h => h.submissionStatus === "graded");
  const tabData = { pending, submitted, graded };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />Homework
        </h1>
        <p className="text-gray-500 text-sm mt-1">Complete and submit your assignments.</p>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([["pending", "Pending", pending.length], ["submitted", "Submitted", submitted.length], ["graded", "Graded", graded.length]] as [typeof activeTab, string, number][]).map(([tab, label, count]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === tab ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
            {label}
            {count > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === tab ? "bg-primary/10 text-primary" : "bg-gray-200 text-gray-600"}`}>{count}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-white animate-pulse rounded-2xl" />)}</div>
      ) : tabData[activeTab].length === 0 ? (
        <div className="py-16 text-center text-gray-400 bg-white rounded-2xl">
          <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No {activeTab} homework</p>
          {activeTab === "pending" && <p className="text-sm mt-1">You're all caught up! 🎉</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {tabData[activeTab].map((hw, i) => {
            const isOverdue = hw.dueDate && hw.dueDate < today && hw.submissionStatus !== "submitted" && hw.submissionStatus !== "graded";
            const isExpanded = expandedId === hw.id;
            const status = STATUS_CONFIG[hw.submissionStatus || ""] || null;
            const hwAttachments = attachments[hw.id] || [];

            let parsedContent: { text?: string; files?: Array<{ url: string; name: string }> } | null = null;
            if (hw.submissionContent) {
              try { parsedContent = JSON.parse(hw.submissionContent); } catch { parsedContent = { text: hw.submissionContent }; }
            }

            return (
              <motion.div key={hw.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${isOverdue ? "border-red-200" : "border-gray-100"}`}>
                <button className="w-full flex items-start gap-4 p-5 text-left hover:bg-gray-50/50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : hw.id)}>
                  <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${isOverdue ? "bg-red-400" : "bg-primary/40"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-bold text-gray-900 text-sm">{hw.title}</p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {status && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${status.bg} ${status.color}`}>{status.label}</span>
                        )}
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      {hw.subjectName && <span className="text-primary font-medium">{hw.subjectName}</span>}
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
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
                      className="overflow-hidden">
                      <div className="px-5 pb-5 space-y-4 border-t border-gray-50 pt-4">
                        {hw.description && <p className="text-sm text-gray-600">{hw.description}</p>}
                        {hw.instructions && (
                          <div className="bg-primary/5 border border-primary/15 rounded-xl p-3">
                            <p className="text-xs font-semibold text-primary mb-1">Instructions</p>
                            <p className="text-xs text-gray-700 whitespace-pre-wrap">{hw.instructions}</p>
                          </div>
                        )}

                        {hw.submissionStatus === "graded" ? (
                          <div className="space-y-3">
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-bold text-emerald-800">Graded ✅</p>
                                {hw.marksAwarded !== null && hw.totalMarks && (
                                  <span className="text-lg font-black text-emerald-700">{hw.marksAwarded} / {hw.totalMarks}</span>
                                )}
                              </div>
                              {hw.teacherFeedback && <p className="text-xs text-emerald-700 whitespace-pre-wrap">{hw.teacherFeedback}</p>}
                            </div>
                            {parsedContent?.text && (
                              <div className="bg-gray-50 rounded-xl p-3">
                                <p className="text-xs text-gray-500 font-medium mb-1">Your answer</p>
                                <p className="text-xs text-gray-700 whitespace-pre-wrap">{parsedContent.text}</p>
                              </div>
                            )}
                            {parsedContent?.files && parsedContent.files.length > 0 && (
                              <div className="space-y-1.5">
                                <p className="text-xs text-gray-500 font-medium">Attached files</p>
                                {parsedContent.files.map((f, idx) => (
                                  <AttachedFile key={idx} url={f.url} name={f.name} onRemove={null as any} />
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <Textarea
                              className="text-sm min-h-[100px] resize-none border-gray-200 rounded-xl focus:border-primary/50"
                              placeholder="Write your answer here..."
                              value={drafts[hw.id] ?? ""}
                              onChange={e => setDrafts(d => ({ ...d, [hw.id]: e.target.value }))}
                              disabled={hw.submissionStatus === "graded"}
                            />

                            {/* File attachments */}
                            <div className="space-y-2">
                              <FileUploader onUploaded={(url, name) => addAttachment(hw.id, url, name)} />
                              {hwAttachments.length > 0 && (
                                <div className="space-y-1.5">
                                  {hwAttachments.map((f, idx) => (
                                    <AttachedFile key={idx} url={f.url} name={f.name} onRemove={() => removeAttachment(hw.id, idx)} />
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" className="gap-2 text-xs" disabled={submitting === hw.id} onClick={() => handleSubmit(hw.id, true)}>
                                <Edit3 className="h-3 w-3" />Save Draft
                              </Button>
                              <Button size="sm" className="gap-2 text-xs bg-primary hover:bg-primary/90"
                                disabled={submitting === hw.id || (!drafts[hw.id]?.trim() && hwAttachments.length === 0)}
                                onClick={() => handleSubmit(hw.id, false)}>
                                <Send className="h-3 w-3" />{submitting === hw.id ? "Submitting..." : "Submit"}
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
          })}
        </div>
      )}
    </div>
  );
}
