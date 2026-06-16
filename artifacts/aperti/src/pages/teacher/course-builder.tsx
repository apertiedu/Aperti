import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
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
  Plus, BookOpen, ChevronRight, ChevronDown, Trash2, GripVertical,
  Video, FileText, FlaskConical, CheckSquare, Clock, ArrowLeft,
  Save, Sparkles, Layout, Upload, Eye,
} from "lucide-react";

const API = "/api";
async function fetchJSON(url: string, opts?: RequestInit) {
  const res = await fetch(`${API}${url}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) },
    ...opts,
  });
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

const LESSON_TYPES = [
  { id: "lecture", icon: BookOpen, label: "Lecture", color: "bg-blue-100 text-blue-700" },
  { id: "video", icon: Video, label: "Video", color: "bg-purple-100 text-purple-700" },
  { id: "worksheet", icon: FileText, label: "Worksheet", color: "bg-amber-100 text-amber-700" },
  { id: "lab", icon: FlaskConical, label: "Lab/Sim", color: "bg-green-100 text-green-700" },
  { id: "assessment", icon: CheckSquare, label: "Assessment", color: "bg-red-100 text-red-700" },
  { id: "reading", icon: FileText, label: "Reading", color: "bg-gray-100 text-gray-700" },
];

function LessonItem({ lesson, onUpdate, onDelete }: { lesson: any; onUpdate: (updates: any) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(lesson);
  const typeInfo = LESSON_TYPES.find(t => t.id === lesson.type) || LESSON_TYPES[0];
  const Icon = typeInfo.icon;
  return (
    <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg hover:border-border group">
      <GripVertical size={14} className="text-gray-300 cursor-grab" />
      <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${typeInfo.color}`}><Icon size={12} className="inline mr-1" />{typeInfo.label}</span>
      {editing ? (
        <>
          <Input value={local.title} onChange={e => setLocal((p: any) => ({ ...p, title: e.target.value }))} className="flex-1 h-7 text-sm" autoFocus />
          <Input value={String(local.duration_min || 60)} onChange={e => setLocal((p: any) => ({ ...p, duration_min: parseInt(e.target.value) || 60 }))} className="w-20 h-7 text-sm" type="number" />
          <Button size="sm" className="h-7 bg-teal-600 text-white" onClick={() => { onUpdate(local); setEditing(false); }}><Save size={12} /></Button>
        </>
      ) : (
        <>
          <span className="flex-1 text-sm text-gray-700 cursor-text" onDoubleClick={() => setEditing(true)}>{lesson.title}</span>
          {lesson.duration_min && <span className="text-xs text-gray-400 flex items-center gap-1"><Clock size={11} /> {lesson.duration_min}m</span>}
        </>
      )}
      <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditing(!editing)}><FileText size={12} /></Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={onDelete}><Trash2 size={12} /></Button>
      </div>
    </div>
  );
}

function TopicPanel({ topic, unitIdx, topicIdx, onUpdate, onDelete }: {
  topic: any; unitIdx: number; topicIdx: number;
  onUpdate: (u: number, t: number, data: any) => void;
  onDelete: (u: number, t: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [localLessons, setLocalLessons] = useState<any[]>(topic.lessons || []);

  const addLesson = (type: string) => {
    const lesson = { id: Date.now(), title: `New ${type} lesson`, type, duration_min: 60, ord: localLessons.length };
    const updated = [...localLessons, lesson];
    setLocalLessons(updated);
    onUpdate(unitIdx, topicIdx, { ...topic, lessons: updated });
  };

  const updateLesson = (idx: number, updates: any) => {
    const updated = localLessons.map((l, i) => i === idx ? { ...l, ...updates } : l);
    setLocalLessons(updated);
    onUpdate(unitIdx, topicIdx, { ...topic, lessons: updated });
  };

  const deleteLesson = (idx: number) => {
    const updated = localLessons.filter((_, i) => i !== idx);
    setLocalLessons(updated);
    onUpdate(unitIdx, topicIdx, { ...topic, lessons: updated });
  };

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <motion.div animate={{ rotate: expanded ? 90 : 0 }}><ChevronRight size={14} className="text-gray-500" /></motion.div>
        <span className="flex-1 text-sm font-medium text-gray-800">{topic.title}</span>
        <Badge variant="outline" className="text-xs">{localLessons.length} lessons</Badge>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={e => { e.stopPropagation(); onDelete(unitIdx, topicIdx); }}><Trash2 size={12} /></Button>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="p-3 space-y-2 bg-card">
              {localLessons.map((lesson, li) => (
                <LessonItem key={lesson.id || li} lesson={lesson} onUpdate={updates => updateLesson(li, updates)} onDelete={() => deleteLesson(li)} />
              ))}
              <div className="flex gap-2 flex-wrap">
                {LESSON_TYPES.map(lt => (
                  <Button key={lt.id} variant="outline" size="sm" className="h-7 text-xs" onClick={() => addLesson(lt.id)}>
                    <Plus size={11} className="mr-1" /> {lt.label}
                  </Button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CourseBuilder() {
  const [, params] = useRoute("/courses/:courseId/builder");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const courseId = params?.courseId ? parseInt(params.courseId) : null;
  const qc = useQueryClient();
  const [units, setUnits] = useState<any[]>([]);
  const [expandedUnits, setExpandedUnits] = useState<Set<number>>(new Set([0]));
  const [aiDialog, setAiDialog] = useState(false);
  const [aiForm, setAiForm] = useState({ board: "CAIE", subject: "", level: "A Level", fileUrl: "" });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [saved, setSaved] = useState(false);

  const { data: structure, isLoading } = useQuery({
    queryKey: ["course-structure", courseId],
    queryFn: async () => {
      try {
        const s = await fetchJSON(`/courses/${courseId}/structure`);
        setUnits(s);
        return s;
      } catch { return []; }
    },
    enabled: !!courseId,
  });

  const saveStructure = useMutation({
    mutationFn: () => fetchJSON(`/courses/${courseId}/structure`, { method: "POST", body: JSON.stringify({ units }) }),
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 3000); qc.invalidateQueries({ queryKey: ["course-structure", courseId] }); },
  });

  const aiExtract = async () => {
    setAiLoading(true);
    try {
      const result = await fetchJSON("/syllabuilder/upload", {
        method: "POST",
        body: JSON.stringify({ ...aiForm, courseId, fileName: `${aiForm.subject} Syllabus` }),
      });
      setAiResult(result);
    } catch (e: any) {
      toast({ title: e?.message || "AI extraction failed", variant: "destructive" });
    }
    setAiLoading(false);
  };

  const confirmAiStructure = async () => {
    if (!aiResult?.jobId) return;
    try {
      await fetchJSON(`/syllabuilder/${aiResult.jobId}/confirm`, {
        method: "PUT",
        body: JSON.stringify({ courseId, structure: aiResult.extractedData }),
      });
      setAiDialog(false);
      qc.invalidateQueries({ queryKey: ["course-structure", courseId] });
    } catch (e: any) {
      toast({ title: e?.message || "Failed to apply structure", variant: "destructive" });
    }
  };

  const addUnit = () => {
    const newUnit = { id: Date.now(), title: "New Unit", ord: units.length, topics: [] };
    setUnits(prev => [...prev, newUnit]);
    setExpandedUnits(prev => new Set([...prev, units.length]));
  };

  const updateUnit = (idx: number, updates: any) => {
    setUnits(prev => prev.map((u, i) => i === idx ? { ...u, ...updates } : u));
  };

  const deleteUnit = (idx: number) => {
    setUnits(prev => prev.filter((_, i) => i !== idx));
  };

  const addTopic = (unitIdx: number) => {
    const topic = { id: Date.now(), title: "New Topic", ord: units[unitIdx]?.topics?.length || 0, lessons: [] };
    updateUnit(unitIdx, { ...units[unitIdx], topics: [...(units[unitIdx]?.topics || []), topic] });
  };

  const updateTopic = (unitIdx: number, topicIdx: number, data: any) => {
    const u = { ...units[unitIdx] };
    u.topics = (u.topics || []).map((t: any, i: number) => i === topicIdx ? data : t);
    updateUnit(unitIdx, u);
  };

  const deleteTopic = (unitIdx: number, topicIdx: number) => {
    const u = { ...units[unitIdx] };
    u.topics = (u.topics || []).filter((_: any, i: number) => i !== topicIdx);
    updateUnit(unitIdx, u);
  };

  const totalLessons = units.reduce((a, u) => a + (u.topics || []).reduce((b: number, t: any) => b + (t.lessons || []).length, 0), 0);
  const totalTopics = units.reduce((a, u) => a + (u.topics || []).length, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-20 bg-card border-b border-border px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/teacher/my-courses")}><ArrowLeft size={16} /></Button>
          <div>
            <h1 className="font-bold text-gray-900">Course Builder</h1>
            <p className="text-xs text-gray-500">{units.length} units · {totalTopics} topics · {totalLessons} lessons</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {saved && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs text-green-600 flex items-center gap-1"><Save size={12} /> Saved</motion.span>}
          <Button variant="outline" size="sm" onClick={() => setAiDialog(true)}><Sparkles size={14} className="mr-1 text-teal-600" /> AI Structure</Button>
          <Button size="sm" onClick={() => saveStructure.mutate()} className="bg-teal-600 hover:bg-teal-700 text-white" disabled={saveStructure.isPending}>
            {saveStructure.isPending ? "Saving..." : "Save Structure"}
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-4">
        {isLoading ? (
          <div className="space-y-4">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        ) : (
          <>
            <AnimatePresence>
              {units.map((unit, ui) => (
                <motion.div key={unit.id || ui} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}>
                  <Card className="overflow-hidden border-2 border-gray-100 hover:border-gray-200 transition-all">
                    <div
                      className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-teal-50 to-white cursor-pointer"
                      onClick={() => setExpandedUnits(prev => { const s = new Set(prev); s.has(ui) ? s.delete(ui) : s.add(ui); return s; })}
                    >
                      <GripVertical size={16} className="text-gray-300 cursor-grab" />
                      <motion.div animate={{ rotate: expandedUnits.has(ui) ? 90 : 0 }}><ChevronRight size={16} className="text-teal-600" /></motion.div>
                      <div className="w-8 h-8 bg-teal-600 text-white rounded-lg flex items-center justify-center text-sm font-bold">{ui + 1}</div>
                      <Input
                        value={unit.title}
                        onChange={e => updateUnit(ui, { title: e.target.value })}
                        onClick={e => e.stopPropagation()}
                        className="flex-1 border-none bg-transparent font-semibold text-gray-800 focus-visible:ring-0 p-0"
                        placeholder="Unit title..."
                      />
                      <Badge variant="outline" className="text-xs">{(unit.topics || []).length} topics</Badge>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={e => { e.stopPropagation(); deleteUnit(ui); }}><Trash2 size={14} /></Button>
                    </div>
                    <AnimatePresence>
                      {expandedUnits.has(ui) && (
                        <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                          <CardContent className="pt-0 pb-4 space-y-3">
                            {(unit.topics || []).map((topic: any, ti: number) => (
                              <TopicPanel key={topic.id || ti} topic={topic} unitIdx={ui} topicIdx={ti} onUpdate={updateTopic} onDelete={deleteTopic} />
                            ))}
                            <Button variant="outline" size="sm" onClick={() => addTopic(ui)} className="w-full border-dashed">
                              <Plus size={14} className="mr-1" /> Add Topic
                            </Button>
                          </CardContent>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
            <Button onClick={addUnit} variant="outline" className="w-full border-dashed border-2 border-gray-300 hover:border-teal-400 h-14 text-gray-500 hover:text-teal-600">
              <Plus size={18} className="mr-2" /> Add Unit
            </Button>
          </>
        )}
      </div>

      <Dialog open={aiDialog} onOpenChange={setAiDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles size={18} className="text-teal-600" /> AI Course Structure Generator</DialogTitle></DialogHeader>
          {!aiResult ? (
            <div className="space-y-4 py-2">
              <p className="text-sm text-gray-500">Upload your syllabus PDF and our AI will extract the course structure automatically.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Board</label>
                  <Input value={aiForm.board} onChange={e => setAiForm(p => ({ ...p, board: e.target.value }))} placeholder="CAIE, Edexcel..." />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Level</label>
                  <Input value={aiForm.level} onChange={e => setAiForm(p => ({ ...p, level: e.target.value }))} placeholder="A Level, IGCSE..." />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Subject</label>
                <Input value={aiForm.subject} onChange={e => setAiForm(p => ({ ...p, subject: e.target.value }))} placeholder="e.g. Biology, Chemistry..." />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Syllabus URL (optional)</label>
                <Input value={aiForm.fileUrl} onChange={e => setAiForm(p => ({ ...p, fileUrl: e.target.value }))} placeholder="https://..." />
              </div>
              <Button onClick={aiExtract} disabled={aiLoading || !aiForm.subject} className="w-full bg-teal-600 hover:bg-teal-700 text-white">
                <Sparkles size={14} className="mr-2" /> {aiLoading ? "Extracting structure..." : "Generate Structure"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-semibold text-green-800">Structure extracted!</p>
                <p className="text-xs text-green-600 mt-1">
                  {aiResult.extractedData?.units?.length || 0} units found · {aiResult.extractedData?.totalHours || 0} total hours
                </p>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {(aiResult.extractedData?.units || []).map((u: any, i: number) => (
                  <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="text-sm font-medium">{u.title}</p>
                    <p className="text-xs text-gray-500">{(u.topics || []).length} topics</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setAiResult(null)}>Re-generate</Button>
                <Button className="flex-1 bg-teal-600 hover:bg-teal-700 text-white" onClick={confirmAiStructure}>Apply to Course</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
