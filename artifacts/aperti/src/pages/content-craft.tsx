import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Trash2, ArrowUp, ArrowDown, FileText, Video,
  HelpCircle, FlaskConical, Layers, Image, Heading1, Heading2,
  Bold, Italic, Underline, X, Save, ChevronRight, Clock,
  AlignLeft, Palette,
} from "lucide-react";

const API = "/api";
const token = () => localStorage.getItem("aperti_token");

async function fetchJSON(url: string, options?: RequestInit) {
  const res = await fetch(`${API}${url}`, {
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(options?.headers || {}) },
    ...options,
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

type SectionType = "heading" | "subheading" | "text" | "video" | "quiz" | "image" | "simulation" | "flashcards";

interface Section {
  type: SectionType;
  title?: string;
  content?: string;
  htmlContent?: string;
  quizQuestionIds?: number[];
  simulationId?: number;
  flashcardDeckId?: number;
  imageUrl?: string;
}

interface Lesson {
  id: number;
  title: string;
  description: string | null;
  sections: Section[];
  updatedAt: string;
}

/* ── Rich Text Editor ─────────────────────────────────────────────────────── */
function RichTextEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);

  const exec = (cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
  };

  const setBlock = (tag: string) => {
    editorRef.current?.focus();
    document.execCommand("formatBlock", false, tag);
  };

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-gray-50 border-b">
        <ToolbarBtn title="Bold" onClick={() => exec("bold")}><Bold className="h-3.5 w-3.5" /></ToolbarBtn>
        <ToolbarBtn title="Italic" onClick={() => exec("italic")}><Italic className="h-3.5 w-3.5" /></ToolbarBtn>
        <ToolbarBtn title="Underline" onClick={() => exec("underline")}><Underline className="h-3.5 w-3.5" /></ToolbarBtn>
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <ToolbarBtn title="Heading 1" onClick={() => setBlock("h1")}><span className="text-[11px] font-black">H1</span></ToolbarBtn>
        <ToolbarBtn title="Heading 2" onClick={() => setBlock("h2")}><span className="text-[11px] font-black">H2</span></ToolbarBtn>
        <ToolbarBtn title="Heading 3" onClick={() => setBlock("h3")}><span className="text-[11px] font-black">H3</span></ToolbarBtn>
        <ToolbarBtn title="Paragraph" onClick={() => setBlock("p")}><AlignLeft className="h-3.5 w-3.5" /></ToolbarBtn>
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <ToolbarBtn title="Bullet list" onClick={() => exec("insertUnorderedList")}>
          <span className="text-xs font-medium">• List</span>
        </ToolbarBtn>
        <ToolbarBtn title="Numbered list" onClick={() => exec("insertOrderedList")}>
          <span className="text-xs font-medium">1. List</span>
        </ToolbarBtn>
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <label className="flex items-center gap-1 cursor-pointer px-2 py-1 rounded hover:bg-gray-200 transition-colors" title="Text color">
          <Palette className="h-3.5 w-3.5" />
          <input type="color" defaultValue="#121212" onChange={e => exec("foreColor", e.target.value)} className="sr-only" />
          <span className="text-[10px] text-gray-500">Color</span>
        </label>
        <label className="flex items-center gap-1 cursor-pointer px-2 py-1 rounded hover:bg-gray-200 transition-colors" title="Highlight color">
          <span className="text-[10px] font-bold" style={{ background: "#fef08a", padding: "0 2px" }}>A</span>
          <input type="color" defaultValue="#fef08a" onChange={e => exec("hiliteColor", e.target.value)} className="sr-only" />
          <span className="text-[10px] text-gray-500">Highlight</span>
        </label>
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <div className="flex items-center gap-1 px-2 py-1 opacity-50 cursor-not-allowed" title="LaTeX coming soon">
          <span className="text-xs font-mono">∑</span>
          <Badge className="text-[9px] h-4 px-1.5 bg-[#E6F4F1] text-[#00796B] border-0 gap-0.5">
            <Clock className="h-2.5 w-2.5" />Soon
          </Badge>
        </div>
      </div>

      {/* Editor area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        dangerouslySetInnerHTML={{ __html: value || "<p></p>" }}
        onInput={e => onChange((e.target as HTMLDivElement).innerHTML)}
        onKeyDown={e => {
          if (e.key === "Tab") {
            e.preventDefault();
            document.execCommand("insertHTML", false, "\u00A0\u00A0\u00A0\u00A0");
          }
        }}
        className="min-h-[120px] max-h-80 overflow-y-auto p-3 outline-none text-sm leading-relaxed focus:bg-slate-50/60 prose prose-sm max-w-none"
        style={{ direction: "ltr" }}
      />
    </div>
  );
}

function ToolbarBtn({ onClick, children, title }: { onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      className="flex items-center justify-center px-2 py-1 rounded hover:bg-gray-200 transition-colors text-gray-700"
    >
      {children}
    </button>
  );
}

/* ── Image section ─────────────────────────────────────────────────────────── */
function ImageSection({ section, onChange }: { section: Section; onChange: (field: string, val: any) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => onChange("imageUrl", ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2">
      <Input
        placeholder="Paste image URL (https://…)"
        value={section.imageUrl || ""}
        onChange={e => onChange("imageUrl", e.target.value)}
        className="text-sm"
      />
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">or</span>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="text-xs text-primary underline"
        >
          Upload from device (PNG, JPG)
        </button>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFile} />
      </div>
      {section.imageUrl && (
        <img
          src={section.imageUrl}
          alt="Section"
          className="max-h-64 rounded-xl object-contain border border-gray-200 bg-gray-50"
        />
      )}
    </div>
  );
}

/* ── Full-screen editor ────────────────────────────────────────────────────── */
function FullScreenEditor({
  lesson,
  onClose,
  onRefresh,
}: {
  lesson: Lesson | null;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [title, setTitle] = useState(lesson?.title || "Untitled Lesson");
  const [description, setDescription] = useState(lesson?.description || "");
  const [sections, setSections] = useState<Section[]>(lesson?.sections || []);
  const [newSectionType, setNewSectionType] = useState<SectionType>("text");
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: any) =>
      fetch(`${API}/content-craft${lesson ? `/${lesson.id}` : ""}`, {
        method: lesson ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-craft"] });
      onRefresh();
      onClose();
    },
  });

  const addSection = () => {
    const s: Section = { type: newSectionType, title: "", content: "", htmlContent: "" };
    setSections(prev => [...prev, s]);
    setActiveIdx(sections.length);
  };

  const update = (idx: number, field: string, val: any) => {
    setSections(prev => {
      const arr = [...prev];
      (arr[idx] as any)[field] = val;
      return arr;
    });
  };

  const remove = (idx: number) => {
    setSections(prev => prev.filter((_, i) => i !== idx));
    setActiveIdx(null);
  };

  const move = (idx: number, dir: "up" | "down") => {
    const newIdx = dir === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= sections.length) return;
    setSections(prev => {
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
    setActiveIdx(newIdx);
  };

  const SECTION_ICONS: Record<SectionType, React.ReactNode> = {
    heading: <Heading1 className="h-4 w-4" />,
    subheading: <Heading2 className="h-4 w-4" />,
    text: <FileText className="h-4 w-4" />,
    video: <Video className="h-4 w-4" />,
    image: <Image className="h-4 w-4" />,
    quiz: <HelpCircle className="h-4 w-4" />,
    simulation: <FlaskConical className="h-4 w-4" />,
    flashcards: <Layers className="h-4 w-4" />,
  };

  const SECTION_COLORS: Record<SectionType, string> = {
    heading: "bg-primary/10 text-primary",
    subheading: "bg-blue-100 text-blue-700",
    text: "bg-slate-100 text-slate-700",
    video: "bg-purple-100 text-purple-700",
    image: "bg-green-100 text-green-700",
    quiz: "bg-amber-100 text-amber-700",
    simulation: "bg-teal-100 text-teal-700",
    flashcards: "bg-pink-100 text-pink-700",
  };

  return (
    <div className="fixed inset-0 z-[999] bg-[#F5F5F5] flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center h-14 border-b bg-white px-4 gap-3 shrink-0 shadow-sm">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors"
        >
          <X className="h-4 w-4" />
          <span className="text-sm">Back</span>
        </button>
        <div className="w-px h-6 bg-gray-200" />
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Lesson title…"
          className="flex-1 text-base font-semibold border-0 outline-none bg-transparent text-gray-900 placeholder:text-gray-400"
        />
        <Button
          onClick={() => mutation.mutate({ title, description, sections })}
          disabled={mutation.isPending}
          className="h-9 bg-primary hover:bg-primary/90 text-white gap-2 shrink-0"
        >
          <Save className="h-3.5 w-3.5" />
          {mutation.isPending ? "Saving…" : "Save Lesson"}
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel – structure */}
        <div className="w-56 shrink-0 border-r bg-white overflow-auto p-3 space-y-1">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2 px-1">Structure</p>

          {/* Description */}
          <button
            type="button"
            onClick={() => setActiveIdx(-1)}
            className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-colors ${activeIdx === -1 ? "bg-primary/10 text-primary font-medium" : "text-gray-500 hover:bg-gray-100"}`}
          >
            <AlignLeft className="h-3 w-3 shrink-0" /> Overview
          </button>

          {sections.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveIdx(idx)}
              className={`w-full text-left rounded-lg text-xs flex items-center gap-2 transition-colors ${
                s.type === "heading" ? "px-2 py-1.5" : s.type === "subheading" ? "px-4 py-1.5" : "px-6 py-1"
              } ${activeIdx === idx ? "bg-primary/10 text-primary font-medium" : "text-gray-500 hover:bg-gray-100"}`}
            >
              <span className={`shrink-0 p-0.5 rounded ${SECTION_COLORS[s.type]}`}>
                {SECTION_ICONS[s.type]}
              </span>
              <span className="truncate">
                {s.type === "heading" || s.type === "subheading" ? (s.content || s.type) : (s.title || s.type)}
              </span>
            </button>
          ))}

          <div className="pt-2 border-t">
            <p className="text-[10px] text-gray-400 px-2 mb-1.5">Add section</p>
            <Select value={newSectionType} onValueChange={(v: SectionType) => setNewSectionType(v)}>
              <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="heading">Heading (Topic)</SelectItem>
                <SelectItem value="subheading">Subheading</SelectItem>
                <SelectItem value="text">Rich Text</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="quiz">Quiz</SelectItem>
                <SelectItem value="simulation">Simulation</SelectItem>
                <SelectItem value="flashcards">Flashcards</SelectItem>
              </SelectContent>
            </Select>
            <button
              type="button"
              onClick={addSection}
              className="mt-1.5 w-full flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          </div>
        </div>

        {/* Main editor */}
        <div className="flex-1 overflow-auto p-6 space-y-4 max-w-3xl mx-auto">
          {/* Overview */}
          {(activeIdx === -1 || activeIdx === null) && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-5 space-y-3">
                  <Label className="text-xs font-bold text-gray-500">Lesson Description</Label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Brief summary of what students will learn…"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Sections */}
          {sections.map((s, idx) => {
            const isActive = activeIdx === idx;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setActiveIdx(idx)}
                className={`cursor-pointer ${isActive ? "ring-2 ring-primary/40 rounded-2xl" : ""}`}
              >
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    {/* Section header */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`p-1 rounded ${SECTION_COLORS[s.type]}`}>
                        {SECTION_ICONS[s.type]}
                      </span>
                      <Badge variant="secondary" className="text-[10px] capitalize">{s.type}</Badge>
                      <div className="ml-auto flex gap-1">
                        <button type="button" onClick={e => { e.stopPropagation(); move(idx, "up"); }} className="p-1 rounded hover:bg-gray-100">
                          <ArrowUp className="h-3.5 w-3.5 text-gray-400" />
                        </button>
                        <button type="button" onClick={e => { e.stopPropagation(); move(idx, "down"); }} className="p-1 rounded hover:bg-gray-100">
                          <ArrowDown className="h-3.5 w-3.5 text-gray-400" />
                        </button>
                        <button type="button" onClick={e => { e.stopPropagation(); remove(idx); }} className="p-1 rounded hover:bg-red-50">
                          <Trash2 className="h-3.5 w-3.5 text-red-400" />
                        </button>
                      </div>
                    </div>

                    {/* Section content */}
                    {(s.type === "heading" || s.type === "subheading") && (
                      <Input
                        placeholder={s.type === "heading" ? "Topic title…" : "Subtopic title…"}
                        value={s.content || ""}
                        onChange={e => update(idx, "content", e.target.value)}
                        className={`border-0 border-b rounded-none px-0 text-sm focus-visible:ring-0 ${s.type === "heading" ? "text-lg font-bold" : "text-base font-semibold"}`}
                      />
                    )}

                    {s.type === "text" && (
                      <div>
                        <Input
                          placeholder="Section title (optional)"
                          value={s.title || ""}
                          onChange={e => update(idx, "title", e.target.value)}
                          className="mb-2 text-sm h-8"
                        />
                        <RichTextEditor
                          value={s.htmlContent || s.content || ""}
                          onChange={v => { update(idx, "htmlContent", v); update(idx, "content", v.replace(/<[^>]+>/g, "")); }}
                        />
                      </div>
                    )}

                    {s.type === "video" && (
                      <div className="space-y-2">
                        <Input
                          placeholder="Section title (optional)"
                          value={s.title || ""}
                          onChange={e => update(idx, "title", e.target.value)}
                          className="text-sm h-8"
                        />
                        <Input
                          placeholder="Video URL (YouTube, Vimeo, or direct mp4)"
                          value={s.content || ""}
                          onChange={e => update(idx, "content", e.target.value)}
                          className="text-sm h-8"
                        />
                        {s.content && s.content.includes("youtube") && (
                          <div className="aspect-video rounded-xl overflow-hidden bg-black">
                            <iframe
                              src={s.content.replace("watch?v=", "embed/")}
                              className="w-full h-full"
                              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {s.type === "image" && <ImageSection section={s} onChange={(f, v) => update(idx, f, v)} />}

                    {s.type === "quiz" && (
                      <div className="space-y-2">
                        <Input placeholder="Section title (optional)" value={s.title || ""} onChange={e => update(idx, "title", e.target.value)} className="text-sm h-8" />
                        <Input
                          placeholder="Question IDs from QueryVault (e.g. 12, 34, 56)"
                          value={(s.quizQuestionIds || []).join(", ")}
                          onChange={e => update(idx, "quizQuestionIds", e.target.value.split(",").map(x => Number(x.trim())).filter(n => !isNaN(n) && n > 0))}
                          className="text-sm h-8"
                        />
                      </div>
                    )}

                    {s.type === "simulation" && (
                      <div className="space-y-2">
                        <Input placeholder="Section title (optional)" value={s.title || ""} onChange={e => update(idx, "title", e.target.value)} className="text-sm h-8" />
                        <Input type="number" placeholder="SimVerse simulation ID" value={s.simulationId ?? ""} onChange={e => update(idx, "simulationId", e.target.value ? Number(e.target.value) : undefined)} className="text-sm h-8" />
                      </div>
                    )}

                    {s.type === "flashcards" && (
                      <div className="space-y-2">
                        <Input placeholder="Section title (optional)" value={s.title || ""} onChange={e => update(idx, "title", e.target.value)} className="text-sm h-8" />
                        <Input type="number" placeholder="CardStack deck ID" value={s.flashcardDeckId ?? ""} onChange={e => update(idx, "flashcardDeckId", e.target.value ? Number(e.target.value) : undefined)} className="text-sm h-8" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}

          {sections.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Add a heading or text section to begin building your lesson.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────────────────── */
export default function ContentCraft() {
  const qc = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);

  const { data: lessons, isLoading } = useQuery<Lesson[]>({
    queryKey: ["content-craft"],
    queryFn: () => fetchJSON("/content-craft"),
  });

  const openNew = () => { setEditingLesson(null); setEditorOpen(true); };
  const openEdit = (l: Lesson) => { setEditingLesson(l); setEditorOpen(true); };
  const closeEditor = () => { setEditorOpen(false); setEditingLesson(null); };

  return (
    <>
      <div className="min-h-screen bg-[#F5F5F5] p-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Content Craft</h1>
            <p className="text-gray-500 text-sm mt-0.5">Build structured, interactive lessons for your courses.</p>
          </div>
          <Button onClick={openNew} className="bg-primary hover:bg-primary/90 text-white gap-2">
            <Plus className="h-4 w-4" /> New Lesson
          </Button>
        </motion.div>

        {isLoading ? (
          <div className="grid gap-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
        ) : lessons?.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-16 text-center text-gray-400">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="font-semibold">No lessons yet</p>
              <p className="text-sm mt-1">Create your first interactive lesson to get started.</p>
              <Button onClick={openNew} className="mt-5 bg-primary text-white" size="sm">Create Lesson</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {lessons?.map((lesson, i) => (
              <motion.div key={lesson.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => openEdit(lesson)}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">{lesson.title}</p>
                      <p className="text-sm text-gray-400 mt-0.5">
                        {lesson.sections?.length || 0} sections · Updated {new Date(lesson.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1 flex-wrap max-w-32">
                        {[...new Set(lesson.sections?.map(s => s.type))].slice(0, 3).map(t => (
                          <Badge key={t} variant="secondary" className="text-[10px] capitalize">{t}</Badge>
                        ))}
                      </div>
                      <Button variant="outline" size="sm" className="h-8 text-xs shrink-0">Edit <ChevronRight className="h-3 w-3 ml-1" /></Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {editorOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            <FullScreenEditor
              lesson={editingLesson}
              onClose={closeEditor}
              onRefresh={() => qc.invalidateQueries({ queryKey: ["content-craft"] })}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
