import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Upload, FileText, CheckCircle, XCircle, Loader2,
  AlertCircle, ChevronRight, Sparkles, Database, Eye, Check,
  X, Edit,
} from "lucide-react";

const API = "/api";
const token = () => localStorage.getItem("aperti_token");
async function fetchJSON(url: string, opts?: RequestInit) {
  const res = await fetch(`${API}${url}`, {
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) },
    ...opts,
  });
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

const STEPS = ["Upload", "Review", "Import"];

export default function QuestionImport() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [url, setUrl] = useState("");
  const [sourceType, setSourceType] = useState("pdf");
  const [jobId, setJobId] = useState<number | null>(null);
  const [extractedQuestions, setExtractedQuestions] = useState<any[]>([]);
  const [approved, setApproved] = useState<Set<number>>(new Set());
  const [rejected, setRejected] = useState<Set<number>>(new Set());
  const [editingQ, setEditingQ] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const uploadMutation = useMutation({
    mutationFn: () => fetchJSON("/questions/import", {
      method: "POST",
      body: JSON.stringify({ fileUrl: url, sourceType, fileName: url.split("/").pop() || "document" }),
    }),
    onSuccess: async (data) => {
      setJobId(data.jobId);
      const job = await fetchJSON(`/questions/import/${data.jobId}`);
      const qs = job.extracted_data?.questions || [];
      setExtractedQuestions(qs);
      setApproved(new Set(qs.map((_: any, i: number) => i)));
      setStep(1);
    },
  });

  const handleImport = async () => {
    setImporting(true);
    try {
      const approvedQuestions = extractedQuestions.filter((_, i) => approved.has(i) && !rejected.has(i));
      const result = await fetchJSON(`/questions/import/${jobId}/review`, {
        method: "PUT",
        body: JSON.stringify({ approvedQuestions, rejectedIds: [...rejected] }),
      });
      setImportResult(result);
      setStep(2);
      qc.invalidateQueries({ queryKey: ["questions-advanced"] });
    } catch {}
    setImporting(false);
  };

  const toggleApprove = (i: number) => {
    setApproved(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });
    setRejected(prev => { const s = new Set(prev); s.delete(i); return s; });
  };
  const toggleReject = (i: number) => {
    setRejected(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });
    setApproved(prev => { const s = new Set(prev); s.delete(i); return s; });
  };

  const diffColors: Record<string, string> = { easy: "bg-green-100 text-green-700", medium: "bg-amber-100 text-amber-700", hard: "bg-red-100 text-red-700" };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/teacher/question-studio")}><ArrowLeft size={16} /></Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Upload className="text-teal-600" size={22} /> Question Import</h1>
            <p className="text-gray-500 text-sm">AI-powered extraction from PDFs and documents</p>
          </div>
        </motion.div>

        {/* Stepper */}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${i < step ? "bg-green-500 text-white" : i === step ? "bg-teal-600 text-white" : "bg-gray-200 text-gray-500"}`}>
                {i < step ? <CheckCircle size={14} /> : i + 1}
              </div>
              <span className={`text-sm font-medium ${i === step ? "text-teal-700" : "text-gray-500"}`}>{s}</span>
              {i < STEPS.length - 1 && <ChevronRight size={16} className="text-gray-300 mx-2" />}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Card className="bg-white border-0 shadow-sm">
                <CardHeader><CardTitle className="text-base">Upload Document</CardTitle></CardHeader>
                <CardContent className="space-y-5">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-2 block">Source Type</label>
                    <div className="grid grid-cols-4 gap-2">
                      {["pdf","past_paper","worksheet","textbook"].map(t => (
                        <button key={t} onClick={() => setSourceType(t)}
                          className={`p-3 rounded-xl border-2 text-xs font-medium transition-all ${sourceType === t ? "border-teal-400 bg-teal-50 text-teal-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                          <FileText size={18} className="mx-auto mb-1" />
                          {t.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-2 block">Document URL</label>
                    <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." className="text-sm" />
                    <p className="text-xs text-gray-400 mt-1">Paste a public URL to a PDF, past paper, or document</p>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-teal-50 border border-teal-200 rounded-xl">
                    <Sparkles size={16} className="text-teal-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-teal-800">AI Extraction</p>
                      <p className="text-xs text-teal-700 mt-1">Our AI will analyse the document, extract all questions, identify topics, difficulty levels, command words, and model answers automatically.</p>
                    </div>
                  </div>
                  <Button onClick={() => uploadMutation.mutate()} disabled={uploadMutation.isPending || !url.trim()} className="w-full bg-teal-600 hover:bg-teal-700 text-white">
                    {uploadMutation.isPending ? <><Loader2 size={14} className="mr-2 animate-spin" /> Extracting questions...</> : <><Sparkles size={14} className="mr-2" /> Extract Questions</>}
                  </Button>
                  {uploadMutation.isError && (
                    <div className="flex items-center gap-2 text-red-600 text-sm"><AlertCircle size={14} /> Extraction failed. Please check the URL.</div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{extractedQuestions.length} questions extracted</p>
                  <p className="text-xs text-gray-500">{approved.size} approved · {rejected.size} rejected · {extractedQuestions.length - approved.size - rejected.size} pending</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setApproved(new Set(extractedQuestions.map((_, i) => i)))}>Approve All</Button>
                  <Button variant="outline" size="sm" onClick={() => setRejected(new Set(extractedQuestions.map((_, i) => i)))}>Reject All</Button>
                </div>
              </div>

              {extractedQuestions.map((q, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className={`bg-white border-2 rounded-xl p-4 transition-all ${approved.has(i) ? "border-green-300" : rejected.has(i) ? "border-red-200 opacity-60" : "border-gray-100"}`}>
                  {editingQ === i ? (
                    <div className="space-y-3">
                      <textarea value={editForm.questionText || q.questionText} onChange={e => setEditForm((p: any) => ({ ...p, questionText: e.target.value }))}
                        className="w-full text-sm border border-gray-200 rounded-lg p-3 resize-none" rows={3} />
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <Input value={editForm.topic || q.topic || ""} onChange={e => setEditForm((p: any) => ({ ...p, topic: e.target.value }))} placeholder="Topic" className="h-7 text-xs" />
                        <Input value={editForm.modelAnswer || q.modelAnswer || ""} onChange={e => setEditForm((p: any) => ({ ...p, modelAnswer: e.target.value }))} placeholder="Model answer" className="h-7 text-xs" />
                        <Input value={String(editForm.maxMarks || q.maxMarks || 4)} onChange={e => setEditForm((p: any) => ({ ...p, maxMarks: parseInt(e.target.value) }))} placeholder="Marks" type="number" className="h-7 text-xs" />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 bg-teal-600 text-white text-xs" onClick={() => { extractedQuestions[i] = { ...q, ...editForm }; setEditingQ(null); setEditForm({}); }}>Save</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingQ(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-gray-800 leading-relaxed mb-2">{q.questionText}</p>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {q.difficulty && <Badge className={`text-xs ${diffColors[q.difficulty] || "bg-gray-100 text-gray-700"}`}>{q.difficulty}</Badge>}
                        {q.maxMarks && <Badge variant="outline" className="text-xs">{q.maxMarks}m</Badge>}
                        {q.commandWord && <Badge className="text-xs bg-blue-100 text-blue-700">{q.commandWord}</Badge>}
                        {q.topic && <Badge className="text-xs bg-purple-100 text-purple-700">{q.topic}</Badge>}
                        {q.questionType && <Badge className="text-xs bg-gray-100 text-gray-600">{q.questionType}</Badge>}
                      </div>
                      {q.modelAnswer && <p className="text-xs text-gray-500 border-l-2 border-teal-200 pl-2 mb-3">{q.modelAnswer}</p>}
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditingQ(i); setEditForm({}); }}><Edit size={11} className="mr-1" /> Edit</Button>
                        <Button size="sm" onClick={() => toggleApprove(i)} className={`h-7 text-xs ${approved.has(i) ? "bg-green-600 hover:bg-green-700 text-white" : "border border-green-300 text-green-700"}`}>
                          <Check size={11} className="mr-1" /> {approved.has(i) ? "Approved" : "Approve"}
                        </Button>
                        <Button size="sm" onClick={() => toggleReject(i)} variant={rejected.has(i) ? "destructive" : "outline"} className="h-7 text-xs">
                          <X size={11} className="mr-1" /> {rejected.has(i) ? "Rejected" : "Reject"}
                        </Button>
                      </div>
                    </>
                  )}
                </motion.div>
              ))}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
                <Button onClick={handleImport} disabled={importing || approved.size === 0} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white">
                  {importing ? <><Loader2 size={14} className="mr-2 animate-spin" /> Importing...</> : <><Database size={14} className="mr-2" /> Import {approved.size} Questions</>}
                </Button>
              </div>
            </motion.div>
          )}

          {step === 2 && importResult && (
            <motion.div key="step2" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <Card className="bg-white border-0 shadow-sm">
                <CardContent className="py-12 text-center space-y-4">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle size={40} className="text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800">Import Complete!</h2>
                  <p className="text-gray-500">{importResult.imported} questions added to your question bank</p>
                  <div className="flex gap-4 justify-center pt-4">
                    <Button variant="outline" onClick={() => { setStep(0); setUrl(""); setExtractedQuestions([]); }}>Import More</Button>
                    <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => navigate("/teacher/question-studio")}>View Question Bank</Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
