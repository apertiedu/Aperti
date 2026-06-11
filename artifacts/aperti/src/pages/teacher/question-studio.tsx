import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Search, Filter, Sparkles, Download, Upload, BookOpen,
  ChevronLeft, ChevronRight, Star, Tag, Clock, AlertCircle, Copy,
  Edit, Trash2, Link, BarChart3, FileText,
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

const DIFFICULTIES = ["easy", "medium", "hard"];
const COMMAND_WORDS = ["Define","State","Describe","Explain","Calculate","Determine","Derive","Show","Discuss","Evaluate","Analyse","Suggest","Predict","Compare","Justify","Outline","Draw","Sketch","Plot","Identify","Name","Give"];
const QUESTION_TYPES = ["structured","mcq","essay","calculation","short-answer","data-response","practical"];

function questionQualityScore(q: any): { score: number; label: string; color: string } {
  let pts = 0;
  if (q.question_text && q.question_text.length >= 30) pts += 25;
  else if (q.question_text && q.question_text.length >= 10) pts += 10;
  if (q.topic) pts += 20;
  if (q.difficulty) pts += 15;
  if (q.max_marks > 0) pts += 15;
  if (q.command_word) pts += 15;
  if (q.model_answer && q.model_answer.length >= 20) pts += 10;
  if (pts >= 80) return { score: pts, label: "High Quality", color: "bg-emerald-100 text-emerald-700" };
  if (pts >= 50) return { score: pts, label: "Fair", color: "bg-amber-100 text-amber-700" };
  return { score: pts, label: "Needs Work", color: "bg-red-100 text-red-600" };
}

function QuestionCard({ q, onEdit, onDuplicate, onDelete }: { q: any; onEdit: () => void; onDuplicate: () => void; onDelete: () => void }) {
  const diffColors: Record<string, string> = { easy: "bg-green-100 text-green-700", medium: "bg-amber-100 text-amber-700", hard: "bg-red-100 text-red-700" };
  const quality = questionQualityScore(q);
  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-gray-100 rounded-xl p-5 hover:border-gray-200 hover:shadow-sm transition-all group">
      <div className="flex items-start justify-between gap-4 mb-3">
        <p className="text-sm text-gray-800 leading-relaxed flex-1 line-clamp-3">{q.question_text}</p>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}><Edit size={13} /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDuplicate}><Copy size={13} /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={onDelete}><Trash2 size={13} /></Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {q.difficulty && <Badge className={`text-xs ${diffColors[q.difficulty] || "bg-gray-100 text-gray-700"}`}>{q.difficulty}</Badge>}
        {q.max_marks && <Badge variant="outline" className="text-xs">{q.max_marks}m</Badge>}
        {q.command_word && <Badge className="text-xs bg-blue-100 text-blue-700">{q.command_word}</Badge>}
        {q.topic && <Badge className="text-xs bg-purple-100 text-purple-700">{q.topic}</Badge>}
        {q.subtopic && <Badge className="text-xs bg-teal-100 text-teal-700">{q.subtopic}</Badge>}
        {q.year && <Badge className="text-xs bg-gray-100 text-gray-600">{q.year}</Badge>}
        {q.paper && <Badge variant="outline" className="text-xs">{q.paper}</Badge>}
        {q.source === "import" && <Badge className="text-xs bg-orange-100 text-orange-700"><Upload size={10} className="mr-1" />Imported</Badge>}
        <Badge className={`text-xs ml-auto ${quality.color}`}>{quality.label}</Badge>
      </div>
      {q.model_answer && (
        <details className="mt-3">
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">View model answer</summary>
          <p className="text-xs text-gray-600 mt-2 pl-3 border-l-2 border-teal-200 leading-relaxed">{q.model_answer}</p>
        </details>
      )}
    </motion.div>
  );
}

function CreateQuestionDialog({ open, onClose, subjectId, onCreated }: { open: boolean; onClose: () => void; subjectId?: number; onCreated: () => void }) {
  const [form, setForm] = useState({
    questionText: "", modelAnswer: "", topic: "", subtopic: "", difficulty: "medium",
    maxMarks: "4", commandWord: "", questionType: "structured", year: "", paper: "",
    board: "", qualification: "", learningObjectives: "",
  });
  const [aiLoading, setAiLoading] = useState(false);

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    try {
      await fetchJSON("/question-bank", {
        method: "POST",
        body: JSON.stringify({
          questionText: form.questionText,
          modelAnswer: form.modelAnswer,
          topic: form.topic,
          subtopic: form.subtopic,
          difficulty: form.difficulty,
          maxMarks: parseInt(form.maxMarks),
          commandWord: form.commandWord,
          questionType: form.questionType,
          year: form.year ? parseInt(form.year) : undefined,
          paper: form.paper,
          board: form.board,
          subjectId,
        }),
      });
      onCreated();
      onClose();
    } catch {}
  };

  const aiGenerate = async () => {
    if (!form.topic) return;
    setAiLoading(true);
    try {
      const result = await fetchJSON("/questions/generate", {
        method: "POST",
        body: JSON.stringify({ topic: form.topic, count: 1, difficulty: form.difficulty }),
      });
      if (result.questions?.[0]) {
        const q = result.questions[0];
        setForm(p => ({ ...p, questionText: q.questionText || p.questionText, modelAnswer: q.modelAnswer || p.modelAnswer, commandWord: q.commandWord || p.commandWord }));
      }
    } catch {}
    setAiLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Plus size={18} className="text-teal-600" /> Create Question</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Question Text *</label>
            <Textarea value={form.questionText} onChange={e => f("questionText", e.target.value)} rows={4} placeholder="Enter the full question text..." className="resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Command Word</label>
              <Select value={form.commandWord} onValueChange={v => f("commandWord", v)}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{COMMAND_WORDS.map(cw => <SelectItem key={cw} value={cw}>{cw}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Question Type</label>
              <Select value={form.questionType} onValueChange={v => f("questionType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{QUESTION_TYPES.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1).replace("-", " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Topic</label>
              <Input value={form.topic} onChange={e => f("topic", e.target.value)} placeholder="e.g. Cell Division" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Subtopic</label>
              <Input value={form.subtopic} onChange={e => f("subtopic", e.target.value)} placeholder="e.g. Meiosis" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Difficulty</label>
              <Select value={form.difficulty} onValueChange={v => f("difficulty", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DIFFICULTIES.map(d => <SelectItem key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Max Marks</label>
              <Input value={form.maxMarks} onChange={e => f("maxMarks", e.target.value)} type="number" min="1" max="25" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Year</label>
              <Input value={form.year} onChange={e => f("year", e.target.value)} placeholder="2023" type="number" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Paper</label>
              <Input value={form.paper} onChange={e => f("paper", e.target.value)} placeholder="Paper 2" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Model Answer</label>
            <Textarea value={form.modelAnswer} onChange={e => f("modelAnswer", e.target.value)} rows={4} placeholder="Enter mark scheme / model answer..." className="resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={aiGenerate} disabled={aiLoading || !form.topic} className="flex-1">
              <Sparkles size={14} className="mr-1 text-teal-600" /> {aiLoading ? "Generating..." : "AI Assist"}
            </Button>
            <Button onClick={save} disabled={!form.questionText} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white">Save Question</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function QuestionStudio() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ search: "", difficulty: "all", topic: "", commandWord: "all", page: 1 });
  const [showCreate, setShowCreate] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState("bank");
  const [aiGenForm, setAiGenForm] = useState({ topic: "", count: 3, difficulty: "medium", subjectId: "" });
  const [aiGenLoading, setAiGenLoading] = useState(false);
  const [aiGenResults, setAiGenResults] = useState<any[]>([]);

  const { data: questionsData, isLoading } = useQuery({
    queryKey: ["questions-advanced", filters],
    queryFn: () => {
      const p = new URLSearchParams();
      if (filters.search) p.set("search", filters.search);
      if (filters.difficulty !== "all") p.set("difficulty", filters.difficulty);
      if (filters.topic) p.set("topic", filters.topic);
      if (filters.commandWord !== "all") p.set("commandWord", filters.commandWord);
      p.set("page", String(filters.page));
      p.set("limit", "20");
      return fetchJSON(`/questions/advanced-search?${p.toString()}`);
    },
  });

  const { data: analytics } = useQuery({
    queryKey: ["analytics-dashboard"],
    queryFn: () => fetchJSON("/analytics/content/dashboard"),
  });

  const deleteQ = useMutation({
    mutationFn: (id: number) => fetchJSON(`/question-bank/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["questions-advanced"] }),
  });

  const generateAiQuestions = async () => {
    setAiGenLoading(true);
    try {
      const result = await fetchJSON("/questions/generate", {
        method: "POST",
        body: JSON.stringify({ topic: aiGenForm.topic, count: aiGenForm.count, difficulty: aiGenForm.difficulty }),
      });
      setAiGenResults(result.questions || []);
    } catch {}
    setAiGenLoading(false);
  };

  const saveAiQuestion = async (q: any) => {
    await fetchJSON("/question-bank", {
      method: "POST",
      body: JSON.stringify({
        questionText: q.questionText,
        modelAnswer: q.modelAnswer,
        topic: q.topic || aiGenForm.topic,
        difficulty: q.difficulty || aiGenForm.difficulty,
        maxMarks: q.maxMarks || 4,
        commandWord: q.commandWord,
      }),
    });
    qc.invalidateQueries({ queryKey: ["questions-advanced"] });
    setAiGenResults(prev => prev.filter(r => r !== q));
  };

  const questions: any[] = questionsData?.questions || [];
  const total = questionsData?.total || 0;
  const totalPages = Math.ceil(total / 20);

  const statCards = [
    { label: "Total Questions", value: total, color: "text-teal-600" },
    { label: "Easy", value: (analytics?.questions || []).find((q: any) => q.difficulty === "easy")?.total || 0, color: "text-green-600" },
    { label: "Medium", value: (analytics?.questions || []).find((q: any) => q.difficulty === "medium")?.total || 0, color: "text-amber-600" },
    { label: "Hard", value: (analytics?.questions || []).find((q: any) => q.difficulty === "hard")?.total || 0, color: "text-red-600" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3"><BookOpen className="text-teal-600" size={28} /> Question Studio</h1>
            <p className="text-gray-500 mt-1">Build, import, and manage your question bank</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate("/teacher/questions/import")}><Upload size={16} className="mr-2" /> Import</Button>
            <Button onClick={() => setShowCreate(true)} className="bg-teal-600 hover:bg-teal-700 text-white"><Plus size={16} className="mr-2" /> New Question</Button>
          </div>
        </motion.div>

        <div className="grid grid-cols-4 gap-4">
          {statCards.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
              <Card className="bg-white border-0 shadow-sm">
                <CardContent className="pt-5 pb-4">
                  <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                  <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white border border-gray-200">
            <TabsTrigger value="bank">Question Bank</TabsTrigger>
            <TabsTrigger value="ai">AI Generator</TabsTrigger>
          </TabsList>

          <TabsContent value="bank" className="space-y-4 mt-4">
            <Card className="bg-white border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input value={filters.search} onChange={e => setFilters(p => ({ ...p, search: e.target.value, page: 1 }))} placeholder="Search questions..." className="pl-9" />
                  </div>
                  <Button variant="outline" onClick={() => setShowFilters(!showFilters)}><Filter size={14} className="mr-1" /> Filters</Button>
                </div>
                <AnimatePresence>
                  {showFilters && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-100">
                        <Select value={filters.difficulty} onValueChange={v => setFilters(p => ({ ...p, difficulty: v, page: 1 }))}>
                          <SelectTrigger><SelectValue placeholder="All Difficulties" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Difficulties</SelectItem>
                            {DIFFICULTIES.map(d => <SelectItem key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input value={filters.topic} onChange={e => setFilters(p => ({ ...p, topic: e.target.value, page: 1 }))} placeholder="Topic filter..." />
                        <Select value={filters.commandWord} onValueChange={v => setFilters(p => ({ ...p, commandWord: v, page: 1 }))}>
                          <SelectTrigger><SelectValue placeholder="All Command Words" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Command Words</SelectItem>
                            {COMMAND_WORDS.map(cw => <SelectItem key={cw} value={cw}>{cw}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>

            {isLoading ? (
              <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
            ) : questions.length === 0 ? (
              <div className="rounded-xl border border-border bg-card flex flex-col items-center justify-center py-16 text-center px-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: "#0D948815" }}>
                  <BookOpen className="w-6 h-6" style={{ color: "#0D9488" }} />
                </div>
                <p className="text-base font-semibold text-foreground mb-1">No questions found</p>
                <p className="text-sm text-muted-foreground max-w-xs mb-5">Create your first question or adjust your search filters.</p>
                <Button style={{ background: "#0D9488", color: "white" }} onClick={() => setShowCreate(true)}>
                  <Plus size={14} className="mr-1" /> New Question
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {questions.map((q: any) => (
                    <QuestionCard key={q.id} q={q}
                      onEdit={() => {}}
                      onDuplicate={() => {}}
                      onDelete={() => deleteQ.mutate(q.id)}
                    />
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3">
                    <Button variant="outline" size="sm" disabled={filters.page <= 1} onClick={() => setFilters(p => ({ ...p, page: p.page - 1 }))}><ChevronLeft size={14} /></Button>
                    <span className="text-sm text-gray-600">{filters.page} / {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={filters.page >= totalPages} onClick={() => setFilters(p => ({ ...p, page: p.page + 1 }))}><ChevronRight size={14} /></Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="ai" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-white border-0 shadow-sm">
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles size={16} className="text-teal-600" /> AI Question Generator</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Topic *</label>
                    <Input value={aiGenForm.topic} onChange={e => setAiGenForm(p => ({ ...p, topic: e.target.value }))} placeholder="e.g. Photosynthesis, Quadratic Equations..." />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">Difficulty</label>
                      <Select value={aiGenForm.difficulty} onValueChange={v => setAiGenForm(p => ({ ...p, difficulty: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{DIFFICULTIES.map(d => <SelectItem key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">Count</label>
                      <Select value={String(aiGenForm.count)} onValueChange={v => setAiGenForm(p => ({ ...p, count: parseInt(v) }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{[1,2,3,5,10].map(n => <SelectItem key={n} value={String(n)}>{n} questions</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button onClick={generateAiQuestions} disabled={aiGenLoading || !aiGenForm.topic} className="w-full bg-teal-600 hover:bg-teal-700 text-white">
                    <Sparkles size={14} className="mr-2" /> {aiGenLoading ? "Generating..." : "Generate Questions"}
                  </Button>
                </CardContent>
              </Card>

              <div className="space-y-3">
                <AnimatePresence>
                  {aiGenResults.map((q, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: i * 0.05 }}
                      className="bg-white border border-gray-100 rounded-xl p-4 hover:border-teal-200 transition-all">
                      <p className="text-sm text-gray-800 mb-2 leading-relaxed">{q.questionText}</p>
                      <div className="flex gap-2 flex-wrap mb-3">
                        {q.commandWord && <Badge className="text-xs bg-blue-100 text-blue-700">{q.commandWord}</Badge>}
                        {q.maxMarks && <Badge variant="outline" className="text-xs">{q.maxMarks}m</Badge>}
                        {q.difficulty && <Badge className="text-xs bg-amber-100 text-amber-700">{q.difficulty}</Badge>}
                      </div>
                      {q.modelAnswer && <p className="text-xs text-gray-500 border-l-2 border-teal-300 pl-2 mb-3 leading-relaxed">{q.modelAnswer}</p>}
                      <Button size="sm" onClick={() => saveAiQuestion(q)} className="bg-teal-600 hover:bg-teal-700 text-white text-xs h-7">Save to Bank</Button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {aiGenResults.length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    <Sparkles size={36} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">AI generated questions will appear here</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <CreateQuestionDialog open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => qc.invalidateQueries({ queryKey: ["questions-advanced"] })} />
    </div>
  );
}
