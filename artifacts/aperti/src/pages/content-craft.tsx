import { useState, useRef, useCallback, useEffect } from "react";
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
  HelpCircle, Layers, Image, Heading1, Heading2,
  Bold, Italic, Underline, X, Save, ChevronRight, AlignLeft,
  Palette, Eye, EyeOff, Code, List, ListOrdered, Link2,
  Sigma, Check,
} from "lucide-react";
import { SaveIndicator } from "@/components/save-indicator";
import { MathHtml, smartTextToHtml } from "@/components/math-renderer";
import DOMPurify from "dompurify";

const API = "/api";

async function fetchJSON(url: string, options?: RequestInit) {
  const res = await fetch(`${API}${url}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    ...options,
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

type SectionType = "heading" | "subheading" | "text" | "video" | "quiz" | "image" | "flashcards";

interface Section {
  type: SectionType;
  title?: string;
  content?: string;
  htmlContent?: string;
  quizQuestionIds?: number[];
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

/* ── LaTeX Insert Popover ─────────────────────────────────────────────────── */
function LatexInsertBtn({ onInsert }: { onInsert: (latex: string, display: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [tex, setTex] = useState("");
  const [display, setDisplay] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);

  const insert = () => {
    if (!tex.trim()) return;
    onInsert(tex.trim(), display);
    setTex("");
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        title="Insert LaTeX formula"
        onMouseDown={e => { e.preventDefault(); setOpen(o => !o); }}
        className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-200 transition-colors text-gray-700 font-mono"
      >
        <Sigma className="h-3.5 w-3.5" />
        <span className="text-[10px] font-bold">TeX</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-xl shadow-lg p-3 w-72">
          <p className="text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-wide">Insert LaTeX Formula</p>
          <input
            ref={inputRef}
            value={tex}
            onChange={e => setTex(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") insert(); if (e.key === "Escape") setOpen(false); }}
            placeholder="e.g. E = mc^2"
            className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 mb-2"
          />
          <div className="flex items-center gap-2 mb-2">
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={display} onChange={e => setDisplay(e.target.checked)} className="rounded" />
              Display (centered block)
            </label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={insert} className="flex-1 h-7 text-xs bg-primary text-white gap-1">
              <Check className="h-3 w-3" /> Insert
            </Button>
            <Button size="sm" variant="outline" onClick={() => setOpen(false)} className="h-7 text-xs">Cancel</Button>
          </div>
          <p className="text-[9px] text-gray-400 mt-2">
            Inline: $E=mc^2$ · Block: $$\int f\,dx$$<br/>
            Works everywhere in the text editor
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Toolbar Button ──────────────────────────────────────────────────────── */
function ToolbarBtn({ onClick, children, title, active }: {
  onClick: () => void; children: React.ReactNode; title?: string; active?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      className={`flex items-center justify-center px-2 py-1 rounded transition-colors text-gray-700 ${active ? "bg-primary/10 text-primary" : "hover:bg-gray-200"}`}
    >
      {children}
    </button>
  );
}

/* ── Smart Paste Handler ──────────────────────────────────────────────────── */
function handleSmartPaste(e: React.ClipboardEvent<HTMLDivElement>) {
  const plain = e.clipboardData.getData("text/plain");
  if (!plain) return;
  const hasMarkdown = /\*\*|__|\$\$?|\\[\[(]/.test(plain);
  if (!hasMarkdown) return;
  e.preventDefault();
  const html = smartTextToHtml(plain);
  document.execCommand("insertHTML", false, html);
}

/* ── Rich Text Editor ─────────────────────────────────────────────────────── */
function RichTextEditor({
  value,
  onChange,
  preview,
}: {
  value: string;
  onChange: (v: string) => void;
  preview: boolean;
}) {
  const editorRef = useRef<HTMLDivElement>(null);

  const exec = (cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
  };

  const setBlock = (tag: string) => {
    editorRef.current?.focus();
    document.execCommand("formatBlock", false, tag);
  };

  const insertLatex = useCallback((tex: string, display: boolean) => {
    editorRef.current?.focus();
    const wrapped = display ? `$$${tex}$$` : `$${tex}$`;
    document.execCommand("insertHTML", false, wrapped);
    onChange(editorRef.current?.innerHTML || "");
  }, [onChange]);

  const [linkUrl, setLinkUrl] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);

  const insertLink = () => setShowLinkInput(true);

  const confirmLink = () => {
    if (linkUrl.trim()) exec("createLink", linkUrl.trim());
    setLinkUrl("");
    setShowLinkInput(false);
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      {!preview && (
        <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-gray-50 border-b">
          <ToolbarBtn title="Bold (Ctrl+B)" onClick={() => exec("bold")}><Bold className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn title="Italic (Ctrl+I)" onClick={() => exec("italic")}><Italic className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn title="Underline (Ctrl+U)" onClick={() => exec("underline")}><Underline className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn title="Code" onClick={() => exec("insertHTML", "<code style='background:#f1f5f9;padding:1px 5px;border-radius:4px;font-family:monospace'>code</code>")}><Code className="h-3.5 w-3.5" /></ToolbarBtn>
          <div className="w-px h-5 bg-gray-300 mx-1" />
          <ToolbarBtn title="Heading 1" onClick={() => setBlock("h2")}><span className="text-[11px] font-black">H1</span></ToolbarBtn>
          <ToolbarBtn title="Heading 2" onClick={() => setBlock("h3")}><span className="text-[11px] font-black">H2</span></ToolbarBtn>
          <ToolbarBtn title="Heading 3" onClick={() => setBlock("h4")}><span className="text-[11px] font-black">H3</span></ToolbarBtn>
          <ToolbarBtn title="Paragraph" onClick={() => setBlock("p")}><AlignLeft className="h-3.5 w-3.5" /></ToolbarBtn>
          <div className="w-px h-5 bg-gray-300 mx-1" />
          <ToolbarBtn title="Bullet list" onClick={() => exec("insertUnorderedList")}><List className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn title="Numbered list" onClick={() => exec("insertOrderedList")}><ListOrdered className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn title="Insert link" onClick={insertLink}><Link2 className="h-3.5 w-3.5" /></ToolbarBtn>
          <div className="w-px h-5 bg-gray-300 mx-1" />
          <label className="flex items-center gap-1 cursor-pointer px-2 py-1 rounded hover:bg-gray-200 transition-colors" title="Text color">
            <Palette className="h-3.5 w-3.5 text-gray-700" />
            <input type="color" defaultValue="#121212" onChange={e => exec("foreColor", e.target.value)} className="sr-only" />
            <span className="text-[10px] text-gray-500">Color</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer px-2 py-1 rounded hover:bg-gray-200 transition-colors" title="Highlight">
            <span className="text-[10px] font-bold" style={{ background: "#fef08a", padding: "0 3px", borderRadius: 2 }}>A</span>
            <input type="color" defaultValue="#fef08a" onChange={e => exec("hiliteColor", e.target.value)} className="sr-only" />
            <span className="text-[10px] text-gray-500">Highlight</span>
          </label>
          <div className="w-px h-5 bg-gray-300 mx-1" />
          <LatexInsertBtn onInsert={insertLatex} />
        </div>
      )}

      {showLinkInput && !preview && (
        <form
          className="flex items-center gap-2 px-3 py-2 bg-blue-50 border-b border-blue-100"
          onSubmit={(e) => { e.preventDefault(); confirmLink(); }}
        >
          <Link2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
          <input
            autoFocus
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://aperti.ai"
            className="flex-1 text-xs border border-blue-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 min-w-0"
          />
          <button type="submit" className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors shrink-0">Insert</button>
          <button type="button" onClick={() => { setShowLinkInput(false); setLinkUrl(""); }} className="text-xs text-gray-500 hover:text-gray-700 px-2">Cancel</button>
        </form>
      )}

      {preview ? (
        <div className="min-h-[120px] max-h-80 overflow-y-auto p-3">
          <MathHtml html={value} className="text-sm" />
        </div>
      ) : (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(value || "<p></p>") }}
          onInput={e => onChange((e.target as HTMLDivElement).innerHTML)}
          onPaste={handleSmartPaste}
          onKeyDown={e => {
            if (e.key === "Tab") {
              e.preventDefault();
              document.execCommand("insertHTML", false, "\u00A0\u00A0\u00A0\u00A0");
            }
          }}
          className="min-h-[120px] max-h-80 overflow-y-auto p-3 outline-none text-sm leading-relaxed focus:bg-slate-50/60 prose prose-sm max-w-none"
          style={{ direction: "ltr" }}
        />
      )}
    </div>
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
      <Input placeholder="Paste image URL (https://…)" value={section.imageUrl || ""} onChange={e => onChange("imageUrl", e.target.value)} className="text-sm" />
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">or</span>
        <button type="button" onClick={() => fileRef.current?.click()} className="text-xs text-primary underline">Upload from device (PNG, JPG)</button>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFile} />
      </div>
      {section.imageUrl && (
        <img src={section.imageUrl} alt="Section" className="max-h-64 rounded-xl object-contain border border-gray-200 bg-gray-50" />
      )}
    </div>
  );
}

/* ── Section type config ──────────────────────────────────────────────────── */
const SECTION_ICONS: Record<SectionType, React.ReactNode> = {
  heading: <Heading1 className="h-4 w-4" />,
  subheading: <Heading2 className="h-4 w-4" />,
  text: <FileText className="h-4 w-4" />,
  video: <Video className="h-4 w-4" />,
  image: <Image className="h-4 w-4" />,
  quiz: <HelpCircle className="h-4 w-4" />,
  flashcards: <Layers className="h-4 w-4" />,
};

const SECTION_COLORS: Record<SectionType, string> = {
  heading: "bg-primary/10 text-primary",
  subheading: "bg-blue-100 text-blue-700",
  text: "bg-slate-100 text-slate-700",
  video: "bg-purple-100 text-purple-700",
  image: "bg-green-100 text-green-700",
  quiz: "bg-amber-100 text-amber-700",
  flashcards: "bg-pink-100 text-pink-700",
};

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
  const [previewAll, setPreviewAll] = useState(false);
  const [saved, setSaved] = useState(false);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: any) =>
      fetch(`${API}/content-craft${lesson ? `/${lesson.id}` : ""}`, {
        method: lesson ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-craft"] });
      onRefresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
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
    const ni = dir === "up" ? idx - 1 : idx + 1;
    if (ni < 0 || ni >= sections.length) return;
    setSections(prev => {
      const arr = [...prev];
      [arr[idx], arr[ni]] = [arr[ni], arr[idx]];
      return arr;
    });
    setActiveIdx(ni);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        mutation.mutate({ title, description, sections });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [title, description, sections]);

  return (
    <div className="fixed inset-0 z-[999] bg-[#F5F5F5] flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center h-14 border-b bg-card px-4 gap-3 shrink-0 shadow-sm">
        <button type="button" onClick={onClose} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 transition-colors">
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
        <button
          type="button"
          onClick={() => setPreviewAll(p => !p)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${previewAll ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          title="Toggle render preview (shows LaTeX, bold, etc.)"
        >
          {previewAll ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {previewAll ? "Edit" : "Preview"}
        </button>
        <SaveIndicator
          status={mutation.isPending ? "saving" : saved ? "saved" : "idle"}
          className="mr-1 hidden sm:inline-flex"
        />
        <Button
          onClick={() => mutation.mutate({ title, description, sections })}
          disabled={mutation.isPending}
          className="h-9 text-white gap-2 shrink-0 bg-primary hover:bg-primary/90"
        >
          {mutation.isPending ? <Sigma className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {mutation.isPending ? "Saving…" : "Save  ⌘S"}
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel – structure */}
        <div className="w-60 shrink-0 border-r bg-card overflow-auto p-3 space-y-0.5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2 px-1">Structure</p>
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
              <span className={`shrink-0 p-0.5 rounded ${SECTION_COLORS[s.type]}`}>{SECTION_ICONS[s.type]}</span>
              <span className="truncate">
                {s.type === "heading" || s.type === "subheading" ? (s.content || s.type) : (s.title || s.type)}
              </span>
            </button>
          ))}

          <div className="pt-3 border-t mt-2 space-y-1.5">
            <p className="text-[10px] text-gray-400 px-1 font-medium">Add section</p>
            <Select value={newSectionType} onValueChange={(v: SectionType) => setNewSectionType(v)}>
              <SelectTrigger className="h-8 text-xs rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="heading">🏷️ Heading (Topic)</SelectItem>
                <SelectItem value="subheading">📌 Subheading</SelectItem>
                <SelectItem value="text">📝 Rich Text</SelectItem>
                <SelectItem value="video">🎬 Video</SelectItem>
                <SelectItem value="image">🖼️ Image</SelectItem>
                <SelectItem value="quiz">❓ Quiz</SelectItem>
                <SelectItem value="flashcards">🃏 Flashcards</SelectItem>
              </SelectContent>
            </Select>
            <button
              type="button"
              onClick={addSection}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
            >
              <Plus className="h-3 w-3" /> Add Section
            </button>
          </div>

          <div className="pt-3 border-t mt-2 px-1">
            <p className="text-[10px] text-gray-400 font-medium mb-1.5">LaTeX quick guide</p>
            <div className="space-y-1 text-[10px] text-gray-500 font-mono">
              <p className="bg-gray-50 px-2 py-1 rounded">$E=mc^2$</p>
              <p className="bg-gray-50 px-2 py-1 rounded">$$\int_0^\infty$$</p>
              <p className="bg-gray-50 px-2 py-1 rounded">\frac{"{a}"}{"{b}"}</p>
              <p className="bg-gray-50 px-2 py-1 rounded">\sqrt{"{x}"}</p>
            </div>
            <p className="text-[9px] text-gray-400 mt-1.5">Paste markdown too: **bold**, *italic*, `code`</p>
          </div>
        </div>

        {/* Main editor */}
        <div className="flex-1 overflow-auto p-6 space-y-4">
          <div className="max-w-3xl mx-auto space-y-4">
            {/* Overview */}
            {(activeIdx === -1 || activeIdx === null) && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-5 space-y-3">
                    <Label className="text-xs font-bold text-gray-500">Lesson Description</Label>
                    {previewAll ? (
                      <div className="min-h-[64px] text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{description || <span className="text-gray-300 italic">No description</span>}</div>
                    ) : (
                      <textarea
                        rows={3}
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Brief summary of what students will learn…"
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    )}
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
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`p-1 rounded ${SECTION_COLORS[s.type]}`}>{SECTION_ICONS[s.type]}</span>
                        <Badge variant="secondary" className="text-[10px] capitalize">{s.type}</Badge>
                        <div className="ml-auto flex gap-1">
                          <button type="button" onClick={e => { e.stopPropagation(); move(idx, "up"); }} className="p-1 rounded hover:bg-gray-100" title="Move up">
                            <ArrowUp className="h-3.5 w-3.5 text-gray-400" />
                          </button>
                          <button type="button" onClick={e => { e.stopPropagation(); move(idx, "down"); }} className="p-1 rounded hover:bg-gray-100" title="Move down">
                            <ArrowDown className="h-3.5 w-3.5 text-gray-400" />
                          </button>
                          <button type="button" onClick={e => { e.stopPropagation(); remove(idx); }} className="p-1 rounded hover:bg-red-50" title="Delete">
                            <Trash2 className="h-3.5 w-3.5 text-red-400" />
                          </button>
                        </div>
                      </div>

                      {(s.type === "heading" || s.type === "subheading") && (
                        previewAll ? (
                          <div className={s.type === "heading" ? "text-xl font-bold text-gray-900" : "text-base font-semibold text-gray-800"}>
                            {s.content || <span className="text-gray-300 italic">No title</span>}
                          </div>
                        ) : (
                          <Input
                            placeholder={s.type === "heading" ? "Topic title…" : "Subtopic title…"}
                            value={s.content || ""}
                            onChange={e => update(idx, "content", e.target.value)}
                            className={`border-0 border-b rounded-none px-0 text-sm focus-visible:ring-0 ${s.type === "heading" ? "text-lg font-bold" : "text-base font-semibold"}`}
                          />
                        )
                      )}

                      {s.type === "text" && (
                        <div className="space-y-2">
                          {!previewAll && (
                            <Input
                              placeholder="Section title (optional)"
                              value={s.title || ""}
                              onChange={e => update(idx, "title", e.target.value)}
                              className="text-sm h-8"
                            />
                          )}
                          {previewAll && s.title && (
                            <p className="font-semibold text-sm text-gray-800">{s.title}</p>
                          )}
                          <RichTextEditor
                            value={s.htmlContent || s.content || ""}
                            onChange={v => { update(idx, "htmlContent", v); update(idx, "content", v.replace(/<[^>]+>/g, "")); }}
                            preview={previewAll}
                          />
                        </div>
                      )}

                      {s.type === "video" && (
                        <div className="space-y-2">
                          {!previewAll && (
                            <>
                              <Input placeholder="Section title (optional)" value={s.title || ""} onChange={e => update(idx, "title", e.target.value)} className="text-sm h-8" />
                              <Input placeholder="YouTube or direct MP4 URL" value={s.content || ""} onChange={e => update(idx, "content", e.target.value)} className="text-sm h-8" />
                            </>
                          )}
                          {s.content && (s.content.includes("youtube") || s.content.includes("youtu.be")) && (
                            <div className="aspect-video rounded-xl overflow-hidden bg-black">
                              <iframe
                                src={s.content.replace("watch?v=", "embed/").replace("youtu.be/", "www.youtube.com/embed/")}
                                className="w-full h-full"
                                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            </div>
                          )}
                          {s.content && s.content.endsWith(".mp4") && (
                            <video src={s.content} controls className="w-full rounded-xl" />
                          )}
                        </div>
                      )}

                      {s.type === "image" && !previewAll && <ImageSection section={s} onChange={(f, v) => update(idx, f, v)} />}
                      {s.type === "image" && previewAll && s.imageUrl && (
                        <img src={s.imageUrl} alt={s.title || "Image"} className="max-h-64 rounded-xl object-contain border border-gray-200" />
                      )}

                      {s.type === "quiz" && (
                        <div className="space-y-2">
                          {!previewAll && (
                            <>
                              <Input placeholder="Section title (optional)" value={s.title || ""} onChange={e => update(idx, "title", e.target.value)} className="text-sm h-8" />
                              <Input
                                placeholder="Question IDs from QueryVault (e.g. 12, 34, 56)"
                                value={(s.quizQuestionIds || []).join(", ")}
                                onChange={e => update(idx, "quizQuestionIds", e.target.value.split(",").map(x => Number(x.trim())).filter(n => !isNaN(n) && n > 0))}
                                className="text-sm h-8"
                              />
                            </>
                          )}
                          {previewAll && <div className="flex items-center gap-2 py-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3"><HelpCircle className="h-4 w-4" /> Quiz · {s.quizQuestionIds?.length || 0} questions</div>}
                        </div>
                      )}

                      {s.type === "flashcards" && (
                        <div className="space-y-2">
                          {!previewAll && (
                            <>
                              <Input placeholder="Section title (optional)" value={s.title || ""} onChange={e => update(idx, "title", e.target.value)} className="text-sm h-8" />
                              <Input type="number" placeholder="CardStack deck ID" value={s.flashcardDeckId ?? ""} onChange={e => update(idx, "flashcardDeckId", e.target.value ? Number(e.target.value) : undefined)} className="text-sm h-8" />
                            </>
                          )}
                          {previewAll && <div className="flex items-center gap-2 py-2 text-sm text-pink-700 bg-pink-50 rounded-lg px-3"><Layers className="h-4 w-4" /> Flashcard Deck #{s.flashcardDeckId || "—"}</div>}
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
                <p className="text-sm font-medium">Start building your lesson</p>
                <p className="text-xs mt-1 max-w-xs mx-auto">Add a heading or text section from the panel on the left. Rich text supports LaTeX formulas ($E=mc^2$), bold, italic, and more.</p>
              </div>
            )}
          </div>
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

  const { data: lessons, isLoading, refetch } = useQuery<Lesson[]>({
    queryKey: ["content-craft"],
    queryFn: () => fetchJSON("/content-craft"),
  });

  const deleteLesson = useMutation({
    mutationFn: (id: number) =>
      fetch(`${API}/content-craft/${id}`, {
        method: "DELETE",
        headers: {},
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content-craft"] }),
  });

  const openNew = () => { setEditingLesson(null); setEditorOpen(true); };
  const openEdit = (l: Lesson) => { setEditingLesson(l); setEditorOpen(true); };
  const closeEditor = () => { setEditorOpen(false); setEditingLesson(null); };

  const TYPE_BADGE_COLORS: Record<string, string> = {
    text: "bg-slate-100 text-slate-600",
    video: "bg-purple-100 text-purple-700",
    image: "bg-green-100 text-green-700",
    quiz: "bg-amber-100 text-amber-700",
    heading: "bg-primary/10 text-primary",
    subheading: "bg-blue-100 text-blue-700",
    flashcards: "bg-pink-100 text-pink-700",
  };

  return (
    <>
      <div className="min-h-screen bg-[#F5F5F5] p-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Content Craft</h1>
            <p className="text-gray-500 text-sm mt-0.5">Build rich, interactive lessons — with LaTeX formulas, videos, quizzes, and more.</p>
          </div>
          <Button onClick={openNew} className="bg-primary hover:bg-primary/90 text-white gap-2">
            <Plus className="h-4 w-4" /> New Lesson
          </Button>
        </motion.div>

        {/* Feature chips */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {["LaTeX formulas", "Rich text", "Video embed", "Quizzes", "Simulations", "Flashcard decks"].map(f => (
            <span key={f} className="text-[11px] bg-card border border-border rounded-full px-3 py-1 text-muted-foreground">{f}</span>
          ))}
        </div>

        {isLoading ? (
          <div className="grid gap-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
        ) : !lessons?.length ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-16 text-center text-gray-400">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="font-semibold text-gray-700">No lessons yet</p>
              <p className="text-sm mt-1 max-w-sm mx-auto">Create your first interactive lesson. You can embed LaTeX formulas like $E = mc^2$, videos, quizzes, and more.</p>
              <Button onClick={openNew} className="mt-5 bg-primary text-white" size="sm">Create First Lesson</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {lessons.map((lesson, i) => (
              <motion.div key={lesson.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">{lesson.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {lesson.description || "No description"} · {lesson.sections?.length || 0} sections · Updated {new Date(lesson.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex gap-1 flex-wrap max-w-36 justify-end">
                        {[...new Set(lesson.sections?.map(s => s.type))].slice(0, 4).map(t => (
                          <span key={t} className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${TYPE_BADGE_COLORS[t] || "bg-gray-100 text-gray-600"}`}>{t}</span>
                        ))}
                      </div>
                      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => openEdit(lesson)}>
                        Edit <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); if (confirm("Delete this lesson?")) deleteLesson.mutate(lesson.id); }}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                        title="Delete lesson"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
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
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} transition={{ duration: 0.2 }}>
            <FullScreenEditor lesson={editingLesson} onClose={closeEditor} onRefresh={refetch} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
