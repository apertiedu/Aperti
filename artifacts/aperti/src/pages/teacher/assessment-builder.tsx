import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Trash2, Search, Sparkles, Eye, EyeOff, Save,
  ChevronRight, GripVertical, BookOpen, Wand2, ArrowLeft,
  CheckCircle2, Loader2, FileText, AlignLeft,
} from "lucide-react";
import AssessmentQualityChecker from "@/components/assessment-quality-checker";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface Section { id: number; title: string; section_order: number; }
interface Question {
  id: number; section_id: number | null; question_bank_id: number | null;
  custom_question: any; marks: number; question_order: number; question_type: string;
  question_text: string; options: string[] | null; correct_answer: string | null;
}
interface BankQuestion {
  id: number; question_text: string; topic: string; difficulty: string; max_marks: number; model_answer: string;
}

const QTYPES = ["written","mcq","short_answer","true_false","file_upload"];
const QTYPE_LABEL: Record<string, string> = { written: "Written", mcq: "MCQ", short_answer: "Short Answer", true_false: "True/False", file_upload: "File Upload" };

export default function AssessmentBuilder({ params }: { params: { id: string } }) {
  const assessmentId = params?.id;
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedSection, setSelectedSection] = useState<number | null>(null);
  const [showBankDrawer, setShowBankDrawer] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [preview, setPreview] = useState(false);
  const [bankSearch, setBankSearch] = useState("");

  // Custom question form
  const [customQ, setCustomQ] = useState({
    question_text: "", question_type: "written", marks: "1", options: ["","","",""], correct_answer: "", model_answer: "",
  });
  // AI gen form
  const [aiForm, setAiForm] = useState({ topic: "", subject: "", count: "3", difficulty: "medium", type: "written" });

  const { data: assessData, isLoading } = useQuery({
    queryKey: ["assessment-detail", assessmentId],
    queryFn: async () => {
      const res = await apiFetch(`/api/assessments/${assessmentId}`);
      return res.json();
    },
  });

  const assessment = assessData?.assessment;
  const sections: Section[] = assessData?.sections ?? [];
  const questions: Question[] = assessData?.questions ?? [];

  useEffect(() => {
    if (sections.length && selectedSection === null) setSelectedSection(sections[0]?.id ?? null);
  }, [sections]);

  const filteredQuestions = selectedSection !== null
    ? questions.filter(q => q.section_id === selectedSection)
    : questions.filter(q => !q.section_id);

  // Bank search
  const { data: bankData } = useQuery({
    queryKey: ["bank-search", bankSearch],
    queryFn: async () => {
      const res = await apiFetch(`/api/question-bank/advanced-search?q=${encodeURIComponent(bankSearch)}&limit=15`);
      return (await res.json()).questions as BankQuestion[];
    },
    enabled: showBankDrawer,
  });

  const addSectionMut = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/assessments/${assessmentId}/sections`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `Section ${sections.length + 1}` }),
      });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assessment-detail", assessmentId] }),
  });

  const addQuestionFromBankMut = useMutation({
    mutationFn: async (bankQ: BankQuestion) => {
      const res = await apiFetch(`/api/assessments/${assessmentId}/questions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section_id: selectedSection,
          question_bank_id: bankQ.id,
          marks: bankQ.max_marks,
          question_type: "written",
        }),
      });
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assessment-detail", assessmentId] }); toast({ title: "Question added" }); },
  });

  const addCustomQMut = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/assessments/${assessmentId}/questions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section_id: selectedSection,
          marks: parseFloat(customQ.marks) || 1,
          question_type: customQ.question_type,
          options: customQ.question_type === "mcq" ? customQ.options.filter(Boolean) : null,
          correct_answer: customQ.correct_answer || null,
          custom_question: { text: customQ.question_text, model_answer: customQ.model_answer },
        }),
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assessment-detail", assessmentId] });
      setShowCustomModal(false);
      setCustomQ({ question_text: "", question_type: "written", marks: "1", options: ["","","",""], correct_answer: "", model_answer: "" });
      toast({ title: "Question added" });
    },
  });

  const generateAiMut = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/assessments/${assessmentId}/generate-questions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aiForm),
      });
      if (!res.ok) throw new Error("AI unavailable");
      return (await res.json()).questions as Array<{ question_text: string; model_answer: string; marks: number; type: string }>;
    },
    onSuccess: async (generated) => {
      for (const q of generated) {
        await apiFetch(`/api/assessments/${assessmentId}/questions`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            section_id: selectedSection,
            marks: q.marks,
            question_type: q.type ?? "written",
            custom_question: { text: q.question_text, model_answer: q.model_answer },
          }),
        });
      }
      qc.invalidateQueries({ queryKey: ["assessment-detail", assessmentId] });
      setShowAiModal(false);
      toast({ title: `${generated.length} AI questions added` });
    },
    onError: () => toast({ title: "AI generation failed", variant: "destructive" }),
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      {/* Modals */}
      <AnimatePresence>
        {showCustomModal && (
          <motion.div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) setShowCustomModal(false); }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <h3 className="font-bold">Custom Question</h3>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Type</label>
                <div className="flex flex-wrap gap-1.5">
                  {QTYPES.map(t => (
                    <button key={t} onClick={() => setCustomQ(q => ({ ...q, question_type: t }))}
                      className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${customQ.question_type === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                      {QTYPE_LABEL[t]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Question *</label>
                <textarea className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none h-20 outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Enter the question text…" value={customQ.question_text} onChange={e => setCustomQ(q => ({ ...q, question_text: e.target.value }))} />
              </div>
              {customQ.question_type === "mcq" && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Options</label>
                  {customQ.options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-bold text-muted-foreground w-5">{["A","B","C","D"][i]}</span>
                      <Input value={opt} onChange={e => { const o = [...customQ.options]; o[i] = e.target.value; setCustomQ(q => ({ ...q, options: o })); }} placeholder={`Option ${["A","B","C","D"][i]}`} className="h-8 text-xs" />
                      <input type="radio" name="correct" value={opt} checked={customQ.correct_answer === opt} onChange={() => setCustomQ(q => ({ ...q, correct_answer: opt }))} />
                    </div>
                  ))}
                  <p className="text-[10px] text-muted-foreground">Select the radio button for the correct option.</p>
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Model Answer</label>
                <textarea className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none h-16 outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Expected answer / marking notes…" value={customQ.model_answer} onChange={e => setCustomQ(q => ({ ...q, model_answer: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Marks</label>
                <Input type="number" min={0.5} step={0.5} value={customQ.marks} onChange={e => setCustomQ(q => ({ ...q, marks: e.target.value }))} className="w-24" />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowCustomModal(false)}>Cancel</Button>
                <Button className="flex-1" onClick={() => addCustomQMut.mutate()} disabled={!customQ.question_text.trim() || addCustomQMut.isPending}>
                  {addCustomQMut.isPending ? "Adding…" : "Add Question"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showAiModal && (
          <motion.div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) setShowAiModal(false); }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
              <h3 className="font-bold flex items-center gap-2"><Wand2 className="w-4 h-4 text-primary" />AI Question Generator</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Topic *</label>
                  <Input placeholder="e.g. Covalent Bonding" value={aiForm.topic} onChange={e => setAiForm(f => ({ ...f, topic: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Subject</label>
                  <Input placeholder="e.g. Chemistry" value={aiForm.subject} onChange={e => setAiForm(f => ({ ...f, subject: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Count</label>
                  <Input type="number" min={1} max={10} value={aiForm.count} onChange={e => setAiForm(f => ({ ...f, count: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Difficulty</label>
                  <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={aiForm.difficulty} onChange={e => setAiForm(f => ({ ...f, difficulty: e.target.value }))}>
                    {["easy","medium","hard"].map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Type</label>
                  <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={aiForm.type} onChange={e => setAiForm(f => ({ ...f, type: e.target.value }))}>
                    {QTYPES.map(t => <option key={t} value={t}>{QTYPE_LABEL[t]}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowAiModal(false)}>Cancel</Button>
                <Button className="flex-1 gap-2" onClick={() => generateAiMut.mutate()} disabled={!aiForm.topic.trim() || generateAiMut.isPending}>
                  {generateAiMut.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Generating…</> : <><Sparkles className="w-3.5 h-3.5" />Generate</>}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top bar */}
      <div className="flex items-center justify-between px-1 pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/teacher/assessments">
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground h-8">
              <ArrowLeft className="w-3.5 h-3.5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-bold text-lg truncate max-w-md">{assessment?.title ?? "Builder"}</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{assessment?.type}</span><span>·</span>
              <span>{assessment?.total_marks ?? 0} marks</span><span>·</span>
              <span>{questions.length} questions</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setPreview(!preview)}>
            {preview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {preview ? "Exit Preview" : "Preview"}
          </Button>
          <Link href={`/teacher/assessments/${assessmentId}/monitor`}>
            <Button size="sm" className="gap-1.5">
              <Eye className="w-3.5 h-3.5" /> Monitor
            </Button>
          </Link>
        </div>
      </div>

      {preview ? (
        // PREVIEW MODE
        <div className="flex-1 overflow-y-auto bg-muted/30 rounded-xl border border-border p-6 space-y-6">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-card rounded-xl border border-border p-5">
              <h2 className="font-bold text-lg">{assessment?.title}</h2>
              {assessment?.instructions && <p className="text-sm text-muted-foreground mt-2">{assessment.instructions}</p>}
              <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                {assessment?.total_marks && <span>{assessment.total_marks} marks total</span>}
                {assessment?.time_limit_minutes && <span>{assessment.time_limit_minutes} minutes</span>}
              </div>
            </div>
            {questions.map((q, i) => (
              <div key={q.id} className="bg-card rounded-xl border border-border p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-muted-foreground">Q{i + 1}</span>
                    <span className="text-xs text-muted-foreground ml-2">[{q.marks} mark{q.marks !== 1 ? "s" : ""}]</span>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{QTYPE_LABEL[q.question_type] ?? q.question_type}</Badge>
                </div>
                <p className="text-sm">{q.question_text}</p>
                {q.question_type === "mcq" && q.options && (
                  <div className="space-y-1.5 ml-2">
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2 text-sm">
                        <span className="w-5 h-5 rounded-full border-2 border-border flex items-center justify-center text-[10px] font-bold">{["A","B","C","D"][oi]}</span>
                        <span>{opt}</span>
                      </div>
                    ))}
                  </div>
                )}
                {q.question_type !== "mcq" && (
                  <div className="min-h-[60px] rounded-lg border border-dashed border-border bg-muted/30 flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">Student answer area</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        // BUILDER MODE
        <div className="flex-1 flex gap-4 overflow-hidden">
          {/* Left: sections */}
          <div className="w-52 shrink-0 flex flex-col gap-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Sections</span>
              <button onClick={() => addSectionMut.mutate()} className="text-primary hover:text-primary/80 text-xs font-semibold flex items-center gap-1">
                <Plus className="w-3 h-3" />Add
              </button>
            </div>
            <button
              onClick={() => setSelectedSection(null)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors ${
                selectedSection === null ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />No Section
            </button>
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedSection(s.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors ${
                  selectedSection === s.id ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{s.title}</span>
              </button>
            ))}
          </div>

          {/* Right: questions + actions */}
          <div className="flex-1 flex gap-4 overflow-hidden">
            {/* Questions list */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowBankDrawer(!showBankDrawer)}>
                  <BookOpen className="w-3 h-3" />{showBankDrawer ? "Close" : "Question Bank"}
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowCustomModal(true)}>
                  <Plus className="w-3 h-3" />Custom
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowAiModal(true)}>
                  <Wand2 className="w-3 h-3" />AI Generate
                </Button>
                <div className="ml-auto w-56">
                  <AssessmentQualityChecker
                    questions={questions}
                    timeLimitMinutes={assessment?.time_limit_minutes}
                    status={assessment?.status}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2">
                {filteredQuestions.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-border rounded-xl">
                    <AlignLeft className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No questions yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Import from Question Bank, add custom, or generate with AI.</p>
                  </div>
                ) : (
                  filteredQuestions.map((q, i) => (
                    <motion.div key={q.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-card border border-border rounded-xl p-3.5 flex items-start gap-3 group"
                    >
                      <div className="text-muted-foreground mt-0.5 cursor-grab shrink-0"><GripVertical className="w-3.5 h-3.5" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold text-muted-foreground">Q{i + 1}</span>
                          <Badge variant="outline" className="text-[9px] px-1.5">{QTYPE_LABEL[q.question_type] ?? q.question_type}</Badge>
                          <span className="text-[10px] text-muted-foreground ml-auto">{q.marks}m</span>
                        </div>
                        <p className="text-xs leading-relaxed line-clamp-2">{q.question_text}</p>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>

            {/* Bank drawer */}
            <AnimatePresence>
              {showBankDrawer && (
                <motion.div initial={{ opacity: 0, x: 20, width: 0 }} animate={{ opacity: 1, x: 0, width: 280 }} exit={{ opacity: 0, x: 20, width: 0 }}
                  className="flex flex-col bg-card border border-border rounded-xl overflow-hidden shrink-0">
                  <div className="p-3 border-b border-border">
                    <p className="text-xs font-bold mb-2">Question Bank</p>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2 w-3 h-3 text-muted-foreground" />
                      <Input placeholder="Search…" className="pl-7 h-7 text-xs" value={bankSearch} onChange={e => setBankSearch(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                    {(bankData ?? []).map(bq => (
                      <div key={bq.id} className="bg-muted/50 rounded-lg p-2.5 space-y-1">
                        <p className="text-[11px] leading-tight line-clamp-2">{bq.question_text}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">{bq.topic} · {bq.max_marks}m · {bq.difficulty}</span>
                          <button
                            onClick={() => addQuestionFromBankMut.mutate(bq)}
                            className="text-[10px] text-primary font-semibold hover:underline"
                          >
                            + Add
                          </button>
                        </div>
                      </div>
                    ))}
                    {bankSearch.length > 0 && (bankData?.length ?? 0) === 0 && (
                      <p className="text-center text-xs text-muted-foreground py-4">No results</p>
                    )}
                    {bankSearch.length === 0 && (
                      <p className="text-center text-xs text-muted-foreground py-4">Type to search questions</p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
