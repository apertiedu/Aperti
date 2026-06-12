import { useState, useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Upload, FileText, CheckCircle2, XCircle, Clock, Loader2,
  AlertCircle, BookOpen, ChevronDown, ChevronUp, Copy, Check, Brain,
  Zap, BarChart3, FileUp, Paperclip, X, Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const TEAL = "#0D9488";

interface ExtractedQuestion {
  id: string;
  text: string;
  marks: number | null;
  subparts: string[];
  topic: string;
  subject: string;
  difficulty: "easy" | "medium" | "hard";
  commandWord: string;
  paperType: string;
  diagramHint: string;
  markScheme?: string;
  status: "pending" | "approved" | "rejected";
  isDuplicate: boolean;
  duplicateOf?: number;
}
interface ExtractionJob {
  id: string;
  status: "pending" | "processing" | "done" | "failed";
  totalExtracted: number;
  approved: number;
  rejected: number;
  questions: ExtractedQuestion[];
  error?: string;
  createdAt: string;
  completedAt?: string;
  source?: string;
}

const DIFF_COLORS: Record<string, string> = {
  easy: "#059669",
  medium: "#D97706",
  hard: "#DC2626",
};

function QuestionCard({
  q, index, selected, onToggle, onApprove, onReject,
}: {
  q: ExtractedQuestion;
  index: number;
  selected: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(q.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`bg-white rounded-xl border transition-all ${
        q.status === "approved" ? "border-green-300 bg-green-50/20" :
        q.status === "rejected" ? "border-red-200 bg-red-50/10 opacity-50" :
        selected ? "border-teal-500 bg-teal-50/20" :
        "border-gray-200 hover:border-gray-300"
      }`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {q.status === "pending" && (
            <input type="checkbox" checked={selected} onChange={onToggle}
              className="mt-0.5 shrink-0 w-4 h-4 rounded accent-teal-600 cursor-pointer" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {q.marks != null && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{q.marks}m</span>
              )}
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${DIFF_COLORS[q.difficulty]}18`, color: DIFF_COLORS[q.difficulty] }}>
                {q.difficulty}
              </span>
              {q.commandWord && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600">{q.commandWord}</span>
              )}
              {q.topic && (
                <span className="text-[10px] font-semibold text-muted-foreground">{q.topic}</span>
              )}
              {q.isDuplicate && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">⚠ Possible duplicate</span>
              )}
              {q.diagramHint && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600" title={q.diagramHint}>📐 diagram</span>
              )}
              {q.status !== "pending" && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${q.status === "approved" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                  {q.status}
                </span>
              )}
            </div>
            <p className={`text-sm text-gray-800 leading-relaxed ${!expanded && "line-clamp-2"}`}>{q.text}</p>
            {q.subparts.length > 0 && expanded && (
              <div className="mt-2 pl-3 border-l-2 border-gray-200 space-y-1">
                {q.subparts.map((sp, i) => (
                  <p key={i} className="text-xs text-gray-600">{sp}</p>
                ))}
              </div>
            )}
            {q.markScheme && expanded && (
              <div className="mt-3 p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                <p className="text-[10px] font-bold text-emerald-700 mb-1 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Mark Scheme
                </p>
                <p className="text-xs text-emerald-800 whitespace-pre-line">{q.markScheme}</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={copy} className="p-1.5 rounded-lg hover:bg-gray-100 text-muted-foreground">
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <button onClick={() => setExpanded(e => !e)} className="p-1.5 rounded-lg hover:bg-gray-100 text-muted-foreground">
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
        {q.status === "pending" && (
          <div className="flex gap-2 mt-3">
            <button onClick={onApprove}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-green-700 bg-green-100 hover:bg-green-200 transition-colors">
              <CheckCircle2 className="h-3.5 w-3.5" />Approve
            </button>
            <button onClick={onReject}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors">
              <XCircle className="h-3.5 w-3.5" />Reject
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

type InputMode = "text" | "pdf";

function FileDropZone({ label, accept, file, onFile, onClear }: {
  label: string;
  accept: string;
  file: File | null;
  onFile: (f: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  }, [onFile]);

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  if (file) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-teal-50 border border-teal-200 rounded-xl">
        <FileText className="h-4 w-4 text-teal-600 shrink-0" />
        <span className="text-sm font-medium text-teal-800 flex-1 truncate">{file.name}</span>
        <span className="text-xs text-teal-600">{(file.size / 1024).toFixed(0)} KB</span>
        <button onClick={onClear} className="p-1 rounded-md hover:bg-teal-100 text-teal-600">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={() => inputRef.current?.click()}
      className="border-2 border-dashed border-gray-200 hover:border-teal-400 rounded-xl p-4 text-center cursor-pointer transition-colors group"
    >
      <FileUp className="h-6 w-6 mx-auto text-gray-300 group-hover:text-teal-500 transition-colors mb-1.5" />
      <p className="text-xs font-semibold text-gray-500 group-hover:text-teal-700">{label}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">Drag & drop or click · PDF, max 10MB</p>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={e => {
        const f = e.target.files?.[0];
        if (f) onFile(f);
        e.target.value = "";
      }} />
    </div>
  );
}

export default function QuestionExtractionPage() {
  const { toast } = useToast();
  const [mode, setMode] = useState<InputMode>("text");
  const [text, setText] = useState("");
  const [subject, setSubject] = useState("");
  const [paperType, setPaperType] = useState("structured");
  const [jobId, setJobId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [questionPdf, setQuestionPdf] = useState<File | null>(null);
  const [markSchemePdf, setMarkSchemePdf] = useState<File | null>(null);

  const startExtraction = useMutation({
    mutationFn: async () => {
      if (mode === "pdf") {
        if (!questionPdf) throw new Error("Please upload a question paper PDF");
        const form = new FormData();
        form.append("questionPdf", questionPdf);
        if (markSchemePdf) form.append("markSchemePdf", markSchemePdf);
        form.append("subject", subject);
        form.append("paperType", paperType);
        const res = await apiFetch("/api/questions/extract/upload", {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Upload failed" }));
          throw new Error(err.error || "Upload failed");
        }
        return res.json();
      } else {
        const res = await apiFetch("/api/questions/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, subject, paperType }),
        });
        if (!res.ok) throw new Error("Failed to start extraction");
        return res.json();
      }
    },
    onSuccess: (data) => {
      setJobId(data.jobId);
      toast({ title: "Extraction started", description: "AI is reading the paper…" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const { data: job } = useQuery<ExtractionJob>({
    queryKey: ["extraction-job", jobId],
    queryFn: async () => {
      const res = await apiFetch(`/api/questions/extract/${jobId}`);
      if (!res.ok) throw new Error("Job not found");
      return res.json();
    },
    enabled: !!jobId,
    refetchInterval: (q) => {
      const status = (q.state.data as ExtractionJob | undefined)?.status;
      return status === "done" || status === "failed" ? false : 2000;
    },
  });

  const batchAction = useMutation({
    mutationFn: async ({ ids, action }: { ids: string[]; action: "approve" | "reject" }) => {
      const res = await apiFetch(`/api/questions/extract/${jobId}/approve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionIds: ids, action }),
      });
      if (!res.ok) throw new Error("Action failed");
      return res.json();
    },
    onSuccess: (data, vars) => {
      toast({ title: vars.action === "approve" ? "Questions saved to Question Bank" : "Questions rejected", description: data.message });
      setSelectedIds(new Set());
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const canExtract = mode === "pdf" ? !!questionPdf : text.trim().length >= 20;
  const questions = job?.questions ?? [];
  const pending = questions.filter(q => q.status === "pending");
  const approved = questions.filter(q => q.status === "approved").length;
  const rejected = questions.filter(q => q.status === "rejected").length;
  const withMarkScheme = questions.filter(q => q.markScheme).length;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
          <Brain className="h-6 w-6" style={{ color: TEAL }} />
          AI Question Extraction 2.0
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Extract questions from exam papers and mark schemes — by text paste or PDF upload.
        </p>
      </div>

      {!jobId ? (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            {/* Mode tabs */}
            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
              {(["text", "pdf"] as InputMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    mode === m ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {m === "text" ? <><FileText className="h-3.5 w-3.5" />Paste Text</> : <><Paperclip className="h-3.5 w-3.5" />Upload PDF</>}
                </button>
              ))}
            </div>

            {/* Subject + Paper Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Subject</label>
                <input value={subject} onChange={e => setSubject(e.target.value)}
                  placeholder="e.g. Physics, Maths"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/20" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Paper Type</label>
                <select value={paperType} onChange={e => setPaperType(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20">
                  <option value="structured">Structured (written)</option>
                  <option value="mcq">Multiple Choice</option>
                  <option value="data_response">Data Response</option>
                  <option value="essay">Essay</option>
                </select>
              </div>
            </div>

            {/* Input area */}
            <AnimatePresence mode="wait">
              {mode === "text" ? (
                <motion.div key="text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                    Paste Exam Paper Text
                  </label>
                  <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    rows={10}
                    placeholder="Paste the full exam paper text here. AI will identify and extract individual questions, mark allocations, command words, and topics automatically…"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/20 resize-y font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">{text.length} characters</p>
                </motion.div>
              ) : (
                <motion.div key="pdf" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1.5 flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5 text-teal-600" /> Question Paper PDF <span className="text-red-500">*</span>
                    </label>
                    <FileDropZone
                      label="Upload question paper PDF"
                      accept=".pdf,application/pdf"
                      file={questionPdf}
                      onFile={setQuestionPdf}
                      onClear={() => setQuestionPdf(null)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1.5 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Mark Scheme PDF
                      <span className="ml-1 text-[10px] font-normal text-muted-foreground">(optional — AI will link answers to questions)</span>
                    </label>
                    <FileDropZone
                      label="Upload mark scheme PDF (optional)"
                      accept=".pdf,application/pdf"
                      file={markSchemePdf}
                      onFile={setMarkSchemePdf}
                      onClear={() => setMarkSchemePdf(null)}
                    />
                  </div>
                  {markSchemePdf && (
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-700">
                      <Wand2 className="h-3.5 w-3.5 shrink-0" />
                      AI will automatically match mark scheme answers to extracted questions
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <Button
              onClick={() => startExtraction.mutate()}
              disabled={!canExtract || startExtraction.isPending}
              className="gap-2 text-white"
              style={{ background: TEAL }}
            >
              {startExtraction.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Starting…</>
              ) : (
                <><Sparkles className="h-4 w-4" />Extract Questions with AI</>
              )}
            </Button>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-5">
          {/* Status bar */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                {job?.status === "processing" || job?.status === "pending" ? (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${TEAL}15` }}>
                    <Loader2 className="h-4 w-4 animate-spin" style={{ color: TEAL }} />
                  </div>
                ) : job?.status === "done" ? (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-green-100">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-red-100">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    {job?.status === "processing" || job?.status === "pending" ? "Extracting questions…" :
                     job?.status === "done" ? `${job.totalExtracted} questions extracted` :
                     "Extraction failed"}
                  </p>
                  {job?.status === "done" && (
                    <p className="text-xs text-muted-foreground">
                      {approved} approved · {rejected} rejected · {pending.length} pending
                      {withMarkScheme > 0 && ` · ${withMarkScheme} with mark scheme`}
                    </p>
                  )}
                  {job?.error && <p className="text-xs text-red-600 mt-0.5">{job.error}</p>}
                </div>
              </div>
              <button onClick={() => { setJobId(null); setText(""); setQuestionPdf(null); setMarkSchemePdf(null); }}
                className="text-xs text-muted-foreground hover:text-gray-800 transition-colors">
                ← New extraction
              </button>
            </div>
          </div>

          {/* Batch actions */}
          {selectedIds.size > 0 && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-teal-50 border border-teal-200 rounded-xl p-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-teal-800">{selectedIds.size} selected</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => batchAction.mutate({ ids: Array.from(selectedIds), action: "approve" })}
                  disabled={batchAction.isPending} className="text-green-700 border-green-300 hover:bg-green-50 gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />Approve All
                </Button>
                <Button size="sm" variant="outline" onClick={() => batchAction.mutate({ ids: Array.from(selectedIds), action: "reject" })}
                  disabled={batchAction.isPending} className="text-red-600 border-red-200 hover:bg-red-50 gap-1.5">
                  <XCircle className="h-3.5 w-3.5" />Reject All
                </Button>
              </div>
            </motion.div>
          )}

          {/* Quick approve all pending */}
          {pending.length > 0 && job?.status === "done" && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => batchAction.mutate({ ids: pending.map(q => q.id), action: "approve" })}
                disabled={batchAction.isPending} className="gap-1.5 text-teal-700 border-teal-300 hover:bg-teal-50">
                <Zap className="h-3.5 w-3.5" />Approve All {pending.length} Pending
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set(pending.map(q => q.id)))}
                className="gap-1.5 text-muted-foreground">
                Select all pending
              </Button>
            </div>
          )}

          {/* Questions list */}
          <div className="space-y-3">
            {questions.map((q, i) => (
              <QuestionCard
                key={q.id}
                q={q}
                index={i}
                selected={selectedIds.has(q.id)}
                onToggle={() => toggleSelect(q.id)}
                onApprove={() => batchAction.mutate({ ids: [q.id], action: "approve" })}
                onReject={() => batchAction.mutate({ ids: [q.id], action: "reject" })}
              />
            ))}
          </div>

          {(job?.status === "pending" || job?.status === "processing") && questions.length === 0 && (
            <div className="text-center py-10">
              <Loader2 className="h-8 w-8 mx-auto animate-spin mb-3" style={{ color: TEAL }} />
              <p className="text-sm text-muted-foreground">AI is reading the paper and extracting questions…</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
