import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
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
import {
  Plus, FileText, Type, Image, Code, Table, List, GripVertical,
  Trash2, Copy, ChevronDown, ChevronUp, Eye, Save, Sparkles,
  ArrowLeft, BookOpen, Hash, AlertCircle, CheckSquare, Layout,
  History, Share2, Video, HelpCircle, Layers, Clock, Divide,
  Search, ChevronRight, Play,
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

const BLOCK_CATEGORIES = [
  { id: "content",   label: "Content",   color: "text-gray-600" },
  { id: "education", label: "Education", color: "text-teal-600" },
  { id: "media",     label: "Media",     color: "text-blue-600" },
];

const BLOCK_TYPES = [
  { id: "heading",        icon: Hash,         label: "Heading",           desc: "H1–H3 title",            category: "content",   slash: "/h" },
  { id: "text",           icon: Type,         label: "Text",              desc: "Rich paragraph",          category: "content",   slash: "/p" },
  { id: "callout",        icon: AlertCircle,  label: "Callout",           desc: "Info / warning box",      category: "content",   slash: "/!" },
  { id: "divider",        icon: Divide,       label: "Divider",           desc: "Section break",           category: "content",   slash: "/---" },
  { id: "code",           icon: Code,         label: "Code",              desc: "Syntax-highlighted",      category: "content",   slash: "/code" },
  { id: "bullet-list",    icon: List,         label: "Bullet List",       desc: "Unordered items",         category: "content",   slash: "/-" },
  { id: "numbered-list",  icon: List,         label: "Numbered List",     desc: "Step sequence",           category: "content",   slash: "/1." },
  { id: "table",          icon: Table,        label: "Table",             desc: "Data grid",               category: "content",   slash: "/table" },
  { id: "key-terms",      icon: BookOpen,     label: "Key Terms",         desc: "Glossary of terms",       category: "education", slash: "/terms" },
  { id: "worked-example", icon: CheckSquare,  label: "Worked Example",    desc: "Step-by-step solution",   category: "education", slash: "/example" },
  { id: "question",       icon: FileText,     label: "Practice Question", desc: "Embedded question",       category: "education", slash: "/q" },
  { id: "quiz",           icon: HelpCircle,   label: "Quiz Block",        desc: "MCQ with answer reveal",  category: "education", slash: "/quiz" },
  { id: "flashcard",      icon: Layers,       label: "Flashcard",         desc: "Flip card — front/back",  category: "education", slash: "/card" },
  { id: "equation",       icon: Hash,         label: "Equation",          desc: "Mathematical formula",    category: "education", slash: "/eq" },
  { id: "timeline",       icon: Clock,        label: "Timeline",          desc: "Chronological events",    category: "education", slash: "/timeline" },
  { id: "image",          icon: Image,        label: "Image",             desc: "Figure with caption",     category: "media",     slash: "/img" },
  { id: "video",          icon: Video,        label: "Video Embed",       desc: "YouTube / URL embed",     category: "media",     slash: "/video" },
];

const CALLOUT_VARIANTS = {
  info:    "border-l-4 border-teal-400 bg-teal-50",
  warning: "border-l-4 border-amber-400 bg-amber-50",
  success: "border-l-4 border-green-400 bg-green-50",
  danger:  "border-l-4 border-red-400 bg-red-50",
};

/* ─── Slash Command Palette ─────────────────────────────────────────────── */
function SlashCommandPalette({
  search, onSelect, onClose, activeIndex, setActiveIndex,
}: {
  search: string;
  onSelect: (blockType: string) => void;
  onClose: () => void;
  activeIndex: number;
  setActiveIndex: (i: number) => void;
}) {
  const filtered = BLOCK_TYPES.filter(
    bt => !search || bt.label.toLowerCase().includes(search.toLowerCase()) ||
      bt.id.includes(search.toLowerCase()) || bt.slash.includes(search.toLowerCase()),
  );

  const grouped = BLOCK_CATEGORIES.map(cat => ({
    ...cat,
    items: filtered.filter(bt => bt.category === cat.id),
  })).filter(g => g.items.length > 0);

  const flat = filtered;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex(Math.min(activeIndex + 1, flat.length - 1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIndex(Math.max(activeIndex - 1, 0)); }
      if (e.key === "Enter")     { e.preventDefault(); if (flat[activeIndex]) onSelect(flat[activeIndex].id); }
      if (e.key === "Escape")    { e.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeIndex, flat, onSelect, onClose, setActiveIndex]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className="absolute left-0 right-0 top-full mt-2 bg-card border border-border rounded-2xl shadow-2xl z-40 overflow-hidden"
    >
      <div className="p-3 border-b border-gray-100 flex items-center gap-2">
        <Search size={14} className="text-gray-400" />
        <p className="text-xs text-gray-400">Type to filter blocks · <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">↑↓</kbd> navigate · <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">↵</kbd> insert · <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">Esc</kbd> close</p>
      </div>
      <div className="max-h-72 overflow-y-auto p-2">
        {grouped.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-6">No blocks match "{search}"</p>
        )}
        {grouped.map(group => (
          <div key={group.id} className="mb-3">
            <p className={`text-[10px] font-bold uppercase tracking-wider px-2 mb-1 ${group.color}`}>{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map(bt => {
                const globalIdx = flat.indexOf(bt);
                return (
                  <motion.button
                    key={bt.id}
                    whileHover={{ backgroundColor: "#f0fdfa" }}
                    onClick={() => onSelect(bt.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors ${globalIdx === activeIndex ? "bg-teal-50 border border-teal-200" : "hover:bg-gray-50"}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${group.id === "education" ? "bg-teal-100" : group.id === "media" ? "bg-blue-100" : "bg-gray-100"}`}>
                      <bt.icon size={14} className={group.id === "education" ? "text-teal-600" : group.id === "media" ? "text-blue-600" : "text-gray-600"} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{bt.label}</p>
                      <p className="text-xs text-gray-400">{bt.desc}</p>
                    </div>
                    <code className="text-[10px] text-gray-300 font-mono shrink-0">{bt.slash}</code>
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ─── Block Renderer ────────────────────────────────────────────────────── */
function BlockRenderer({ block, onUpdate, onDelete, onDuplicate, selected, onSelect }: {
  block: any;
  onUpdate: (id: number, content: any) => void;
  onDelete: (id: number) => void;
  onDuplicate: (id: number) => void;
  selected: boolean;
  onSelect: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [localContent, setLocalContent] = useState(block.content || {});
  const [flipped, setFlipped] = useState(false);
  const [quizRevealed, setQuizRevealed] = useState(false);

  const save = () => { onUpdate(block.id, localContent); setEditing(false); };

  function getYouTubeId(url: string) {
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    return m ? m[1] : null;
  }

  const renderPreview = () => {
    switch (block.block_type) {
      case "heading": {
        const sizes: Record<string, string> = { 1: "text-2xl font-bold", 2: "text-xl font-semibold", 3: "text-lg font-medium" };
        return <p className={sizes[localContent.level || 1] || "text-2xl font-bold"}>{localContent.text || "Untitled Heading"}</p>;
      }
      case "text":
        return <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{localContent.text || "Empty paragraph..."}</p>;
      case "callout":
        return (
          <div className={`p-4 rounded-lg ${CALLOUT_VARIANTS[localContent.variant as keyof typeof CALLOUT_VARIANTS] || CALLOUT_VARIANTS.info}`}>
            <p className="text-sm font-medium">{localContent.text || "Callout text..."}</p>
          </div>
        );
      case "divider":
        return <hr className="border-gray-200 my-2" />;
      case "code":
        return <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto font-mono">{localContent.code || "// code here"}</pre>;
      case "key-terms":
        return (
          <div className="grid grid-cols-1 gap-2">
            {(localContent.terms || []).map((t: any, i: number) => (
              <div key={i} className="flex gap-3 p-3 bg-teal-50 rounded-lg border border-teal-100">
                <span className="font-semibold text-teal-700 min-w-[120px]">{t.term}</span>
                <span className="text-gray-600 text-sm">{t.definition}</span>
              </div>
            ))}
            {(!localContent.terms?.length) && <p className="text-gray-400 italic text-sm">No terms added</p>}
          </div>
        );
      case "worked-example":
        return (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
            <p className="font-semibold text-blue-800">Question: {localContent.question || "..."}</p>
            {(localContent.steps || []).map((s: string, i: number) => (
              <div key={i} className="flex gap-2 text-sm text-blue-700">
                <span className="font-bold w-5">{i + 1}.</span><span>{s}</span>
              </div>
            ))}
          </div>
        );
      case "numbered-list":
        return (
          <ol className="list-decimal list-inside space-y-1">
            {(localContent.items || []).map((item: string, i: number) => <li key={i} className="text-gray-700">{item}</li>)}
            {(!localContent.items?.length) && <li className="text-gray-400 italic">No items</li>}
          </ol>
        );
      case "bullet-list":
        return (
          <ul className="list-disc list-inside space-y-1">
            {(localContent.items || []).map((item: string, i: number) => <li key={i} className="text-gray-700">{item}</li>)}
          </ul>
        );
      case "image":
        return (
          <div className="text-center">
            {localContent.url ? <img src={localContent.url} alt={localContent.caption || ""} className="max-w-full rounded-lg mx-auto" /> : <div className="h-32 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400"><Image size={32} /></div>}
            {localContent.caption && <p className="text-sm text-gray-500 mt-1 italic">{localContent.caption}</p>}
          </div>
        );
      case "video": {
        const ytId = localContent.url ? getYouTubeId(localContent.url) : null;
        return (
          <div className="rounded-lg overflow-hidden bg-gray-900">
            {ytId ? (
              <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
                <iframe className="absolute inset-0 w-full h-full" src={`https://www.youtube.com/embed/${ytId}`} allowFullScreen title={localContent.title || "Video"} />
              </div>
            ) : localContent.url ? (
              <video src={localContent.url} controls className="w-full rounded-lg" />
            ) : (
              <div className="h-40 flex items-center justify-center text-gray-400 gap-2">
                <Video size={28} /><span className="text-sm">No video URL set</span>
              </div>
            )}
            {localContent.caption && <p className="text-sm text-gray-400 p-2 text-center">{localContent.caption}</p>}
          </div>
        );
      }
      case "quiz":
        return (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-2">
              <HelpCircle size={16} className="text-purple-600 mt-0.5 shrink-0" />
              <p className="font-semibold text-purple-800 text-sm">{localContent.question || "Quiz question..."}</p>
            </div>
            <div className="space-y-1.5">
              {(localContent.options || []).map((opt: string, i: number) => {
                const letter = String.fromCharCode(65 + i);
                const isCorrect = localContent.correct === i;
                return (
                  <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all ${quizRevealed && isCorrect ? "bg-green-100 border-green-400 text-green-800 font-semibold" : "bg-card border-border text-foreground"}`}>
                    <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center shrink-0">{letter}</span>
                    {opt || `Option ${letter}`}
                    {quizRevealed && isCorrect && <span className="ml-auto text-green-600 text-xs font-bold">✓ Correct</span>}
                  </div>
                );
              })}
            </div>
            <button onClick={() => setQuizRevealed(!quizRevealed)} className="text-xs text-purple-600 font-semibold hover:underline">
              {quizRevealed ? "Hide answer" : "Reveal answer"}
            </button>
          </div>
        );
      case "flashcard":
        return (
          <div className="flex justify-center">
            <motion.div
              className="relative w-full max-w-sm h-36 cursor-pointer"
              onClick={() => setFlipped(!flipped)}
              style={{ perspective: 800 }}
            >
              <motion.div
                className="absolute inset-0"
                style={{ transformStyle: "preserve-3d" }}
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={{ duration: 0.45, ease: "easeInOut" }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl flex flex-col items-center justify-center p-4 text-white" style={{ backfaceVisibility: "hidden" }}>
                  <p className="text-[10px] uppercase tracking-widest opacity-70 mb-1">Front</p>
                  <p className="font-bold text-center">{localContent.front || "Front side"}</p>
                  <p className="text-xs opacity-60 mt-3">Click to flip</p>
                </div>
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex flex-col items-center justify-center p-4 text-white" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                  <p className="text-[10px] uppercase tracking-widest opacity-70 mb-1">Back</p>
                  <p className="text-center text-sm">{localContent.back || "Back side"}</p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        );
      case "equation":
        return (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 text-center">
            <p className="font-mono text-lg text-gray-800 tracking-wide">{localContent.formula || "Enter equation..."}</p>
            {localContent.label && <p className="text-xs text-gray-400 mt-2">{localContent.label}</p>}
          </div>
        );
      case "timeline":
        return (
          <div className="relative pl-6 space-y-4">
            <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-teal-200" />
            {(localContent.events || []).map((ev: any, i: number) => (
              <div key={i} className="relative">
                <div className="absolute -left-4 top-1 w-3 h-3 rounded-full bg-teal-500 border-2 border-white shadow" />
                <p className="text-xs font-bold text-teal-700 mb-0.5">{ev.date || "Date"}</p>
                <p className="text-sm font-semibold text-gray-800">{ev.title || "Event"}</p>
                {ev.desc && <p className="text-xs text-gray-500 mt-0.5">{ev.desc}</p>}
              </div>
            ))}
            {(!localContent.events?.length) && <p className="text-gray-400 italic text-sm">No events added</p>}
          </div>
        );
      default:
        return <p className="text-gray-400 italic text-sm">Block: {block.block_type}</p>;
    }
  };

  const renderEditor = () => {
    switch (block.block_type) {
      case "heading":
        return (
          <div className="space-y-3">
            <Select value={String(localContent.level || 1)} onValueChange={v => setLocalContent((p: any) => ({ ...p, level: parseInt(v) }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">H1 — Large</SelectItem>
                <SelectItem value="2">H2 — Medium</SelectItem>
                <SelectItem value="3">H3 — Small</SelectItem>
              </SelectContent>
            </Select>
            <Input value={localContent.text || ""} onChange={e => setLocalContent((p: any) => ({ ...p, text: e.target.value }))} placeholder="Heading text..." className="text-lg font-bold" />
          </div>
        );
      case "text":
        return <Textarea value={localContent.text || ""} onChange={e => setLocalContent((p: any) => ({ ...p, text: e.target.value }))} rows={5} placeholder="Write your content here..." className="resize-none" />;
      case "callout":
        return (
          <div className="space-y-3">
            <Select value={localContent.variant || "info"} onValueChange={v => setLocalContent((p: any) => ({ ...p, variant: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["info","warning","success","danger"].map(v => <SelectItem key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Textarea value={localContent.text || ""} onChange={e => setLocalContent((p: any) => ({ ...p, text: e.target.value }))} rows={3} placeholder="Callout text..." className="resize-none" />
          </div>
        );
      case "code":
        return (
          <div className="space-y-3">
            <Input value={localContent.language || ""} onChange={e => setLocalContent((p: any) => ({ ...p, language: e.target.value }))} placeholder="Language (python, js, ...)" />
            <Textarea value={localContent.code || ""} onChange={e => setLocalContent((p: any) => ({ ...p, code: e.target.value }))} rows={6} className="font-mono text-sm resize-none" placeholder="Code here..." />
          </div>
        );
      case "key-terms":
        return (
          <div className="space-y-3">
            {(localContent.terms || []).map((t: any, i: number) => (
              <div key={i} className="flex gap-2">
                <Input value={t.term} onChange={e => { const terms = [...(localContent.terms || [])]; terms[i] = { ...terms[i], term: e.target.value }; setLocalContent((p: any) => ({ ...p, terms })); }} placeholder="Term" className="w-1/3" />
                <Input value={t.definition} onChange={e => { const terms = [...(localContent.terms || [])]; terms[i] = { ...terms[i], definition: e.target.value }; setLocalContent((p: any) => ({ ...p, terms })); }} placeholder="Definition" className="flex-1" />
                <Button variant="ghost" size="icon" onClick={() => { const terms = (localContent.terms || []).filter((_: any, j: number) => j !== i); setLocalContent((p: any) => ({ ...p, terms })); }}><Trash2 size={14} /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setLocalContent((p: any) => ({ ...p, terms: [...(p.terms || []), { term: "", definition: "" }] }))}><Plus size={14} className="mr-1" /> Add Term</Button>
          </div>
        );
      case "worked-example":
        return (
          <div className="space-y-3">
            <Textarea value={localContent.question || ""} onChange={e => setLocalContent((p: any) => ({ ...p, question: e.target.value }))} rows={2} placeholder="Question text..." className="resize-none" />
            <div className="space-y-2">
              {(localContent.steps || []).map((s: string, i: number) => (
                <div key={i} className="flex gap-2">
                  <span className="w-6 text-sm font-bold text-gray-500 mt-2">{i + 1}.</span>
                  <Input value={s} onChange={e => { const steps = [...(localContent.steps || [])]; steps[i] = e.target.value; setLocalContent((p: any) => ({ ...p, steps })); }} placeholder={`Step ${i + 1}...`} />
                  <Button variant="ghost" size="icon" onClick={() => { const steps = (localContent.steps || []).filter((_: any, j: number) => j !== i); setLocalContent((p: any) => ({ ...p, steps })); }}><Trash2 size={14} /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setLocalContent((p: any) => ({ ...p, steps: [...(p.steps || []), ""] }))}><Plus size={14} className="mr-1" /> Add Step</Button>
            </div>
          </div>
        );
      case "numbered-list":
      case "bullet-list":
        return (
          <div className="space-y-2">
            {(localContent.items || []).map((item: string, i: number) => (
              <div key={i} className="flex gap-2">
                <Input value={item} onChange={e => { const items = [...(localContent.items || [])]; items[i] = e.target.value; setLocalContent((p: any) => ({ ...p, items })); }} placeholder={`Item ${i + 1}...`} />
                <Button variant="ghost" size="icon" onClick={() => { const items = (localContent.items || []).filter((_: any, j: number) => j !== i); setLocalContent((p: any) => ({ ...p, items })); }}><Trash2 size={14} /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setLocalContent((p: any) => ({ ...p, items: [...(p.items || []), ""] }))}><Plus size={14} className="mr-1" /> Add Item</Button>
          </div>
        );
      case "image":
        return (
          <div className="space-y-3">
            <Input value={localContent.url || ""} onChange={e => setLocalContent((p: any) => ({ ...p, url: e.target.value }))} placeholder="Image URL..." />
            <Input value={localContent.caption || ""} onChange={e => setLocalContent((p: any) => ({ ...p, caption: e.target.value }))} placeholder="Caption (optional)" />
          </div>
        );
      case "video":
        return (
          <div className="space-y-3">
            <Input value={localContent.url || ""} onChange={e => setLocalContent((p: any) => ({ ...p, url: e.target.value }))} placeholder="YouTube URL or direct video link..." />
            <Input value={localContent.caption || ""} onChange={e => setLocalContent((p: any) => ({ ...p, caption: e.target.value }))} placeholder="Caption (optional)" />
          </div>
        );
      case "quiz":
        return (
          <div className="space-y-3">
            <Textarea value={localContent.question || ""} onChange={e => setLocalContent((p: any) => ({ ...p, question: e.target.value }))} rows={2} placeholder="Quiz question..." className="resize-none" />
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-600">Answer Options</p>
              {(localContent.options || ["","","",""]).map((opt: string, i: number) => (
                <div key={i} className="flex gap-2 items-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 cursor-pointer transition-all ${localContent.correct === i ? "bg-green-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                    onClick={() => setLocalContent((p: any) => ({ ...p, correct: i }))}>
                    {String.fromCharCode(65 + i)}
                  </div>
                  <Input value={opt} onChange={e => { const options = [...(localContent.options || ["","","",""])]; options[i] = e.target.value; setLocalContent((p: any) => ({ ...p, options })); }} placeholder={`Option ${String.fromCharCode(65 + i)}`} />
                </div>
              ))}
              <p className="text-xs text-gray-400">Click a letter to mark it as the correct answer</p>
            </div>
            <Input value={localContent.explanation || ""} onChange={e => setLocalContent((p: any) => ({ ...p, explanation: e.target.value }))} placeholder="Explanation (shown after reveal)..." />
          </div>
        );
      case "flashcard":
        return (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1">Front (Question / Term)</p>
              <Textarea value={localContent.front || ""} onChange={e => setLocalContent((p: any) => ({ ...p, front: e.target.value }))} rows={2} placeholder="Front of card..." className="resize-none" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1">Back (Answer / Definition)</p>
              <Textarea value={localContent.back || ""} onChange={e => setLocalContent((p: any) => ({ ...p, back: e.target.value }))} rows={2} placeholder="Back of card..." className="resize-none" />
            </div>
          </div>
        );
      case "equation":
        return (
          <div className="space-y-3">
            <Input value={localContent.formula || ""} onChange={e => setLocalContent((p: any) => ({ ...p, formula: e.target.value }))} placeholder="e.g. E = mc², ax² + bx + c = 0" className="font-mono" />
            <Input value={localContent.label || ""} onChange={e => setLocalContent((p: any) => ({ ...p, label: e.target.value }))} placeholder="Label / description (optional)" />
          </div>
        );
      case "timeline":
        return (
          <div className="space-y-3">
            {(localContent.events || []).map((ev: any, i: number) => (
              <div key={i} className="flex gap-2 items-start border border-gray-200 rounded-lg p-2">
                <div className="space-y-1 flex-1">
                  <Input value={ev.date} onChange={e => { const events = [...(localContent.events || [])]; events[i] = { ...events[i], date: e.target.value }; setLocalContent((p: any) => ({ ...p, events })); }} placeholder="Date / period" className="text-xs h-8" />
                  <Input value={ev.title} onChange={e => { const events = [...(localContent.events || [])]; events[i] = { ...events[i], title: e.target.value }; setLocalContent((p: any) => ({ ...p, events })); }} placeholder="Event title" className="text-xs h-8" />
                  <Input value={ev.desc || ""} onChange={e => { const events = [...(localContent.events || [])]; events[i] = { ...events[i], desc: e.target.value }; setLocalContent((p: any) => ({ ...p, events })); }} placeholder="Details (optional)" className="text-xs h-8" />
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 mt-1" onClick={() => { const events = (localContent.events || []).filter((_: any, j: number) => j !== i); setLocalContent((p: any) => ({ ...p, events })); }}><Trash2 size={12} /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setLocalContent((p: any) => ({ ...p, events: [...(p.events || []), { date: "", title: "", desc: "" }] }))}><Plus size={14} className="mr-1" /> Add Event</Button>
          </div>
        );
      default:
        return <Textarea value={JSON.stringify(localContent, null, 2)} onChange={e => { try { setLocalContent(JSON.parse(e.target.value)); } catch {} }} rows={5} className="font-mono text-sm resize-none" />;
    }
  };

  const bt = BLOCK_TYPES.find(b => b.id === block.block_type);
  const categoryColor = bt?.category === "education" ? "bg-teal-100 text-teal-600" : bt?.category === "media" ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`group relative bg-card rounded-xl border-2 transition-all duration-200 ${selected ? "border-teal-400 shadow-md" : "border-gray-100 hover:border-gray-200"}`}
      onClick={() => onSelect(block.id)}
    >
      {bt && (
        <div className={`absolute -top-2.5 left-4 px-2 py-0.5 rounded-full text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity ${categoryColor}`}>
          {bt.label}
        </div>
      )}
      <div className="flex items-start gap-3 p-4">
        <div className="cursor-grab text-gray-300 hover:text-gray-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical size={16} />
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-3">
              {renderEditor()}
              <div className="flex gap-2">
                <Button size="sm" onClick={save} className="bg-teal-600 hover:bg-teal-700 text-white"><Save size={14} className="mr-1" /> Save</Button>
                <Button size="sm" variant="ghost" onClick={() => { setLocalContent(block.content || {}); setEditing(false); }}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="cursor-text" onDoubleClick={() => setEditing(true)}>
              {renderPreview()}
              {selected && <p className="text-xs text-gray-400 mt-2">Double-click to edit</p>}
            </div>
          )}
        </div>
        <div className={`flex flex-col gap-1 transition-opacity ${selected || editing ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
          {!editing && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(true)}><Type size={13} /></Button>}
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDuplicate(block.id)}><Copy size={13} /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => onDelete(block.id)}><Trash2 size={13} /></Button>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Main Component ────────────────────────────────────────────────────── */
export default function ContentCraftStudio() {
  const [, params] = useRoute("/teacher/contentcraft/:pageId");
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const pageId = params?.pageId ? parseInt(params.pageId) : null;
  const [selectedBlock, setSelectedBlock] = useState<number | null>(null);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashSearch, setSlashSearch] = useState("");
  const [slashIndex, setSlashIndex] = useState(0);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [saved, setSaved] = useState(true);
  const slashInputRef = useRef<HTMLInputElement>(null);
  const addAreaRef = useRef<HTMLDivElement>(null);

  const openSlashMenu = useCallback(() => {
    setSlashSearch("");
    setSlashIndex(0);
    setShowSlashMenu(true);
    setTimeout(() => slashInputRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!pageId) return;
      if (e.key === "/" && !showSlashMenu && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        openSlashMenu();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [pageId, showSlashMenu, openSlashMenu]);

  const { data: pages, isLoading: pagesLoading } = useQuery({
    queryKey: ["contentcraft-pages"],
    queryFn: () => fetchJSON("/contentcraft/pages"),
    enabled: !pageId,
  });

  const { data: page, isLoading: pageLoading } = useQuery({
    queryKey: ["contentcraft-page", pageId],
    queryFn: () => fetchJSON(`/contentcraft/pages/${pageId}`),
    enabled: !!pageId,
    refetchOnWindowFocus: false,
  });

  const { data: templates } = useQuery({
    queryKey: ["contentcraft-templates"],
    queryFn: () => fetchJSON("/contentcraft/templates"),
    enabled: !pageId,
  });

  const createPage = useMutation({
    mutationFn: (data: any) => fetchJSON("/contentcraft/pages", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (p) => { qc.invalidateQueries({ queryKey: ["contentcraft-pages"] }); navigate(`/teacher/contentcraft/${p.id}`); },
  });

  const addBlock = useMutation({
    mutationFn: ({ pageId: pid, ...data }: any) => fetchJSON(`/contentcraft/pages/${pid}/blocks`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contentcraft-page", pageId] }); setShowSlashMenu(false); setSaved(false); setTimeout(() => setSaved(true), 2000); },
  });

  const updateBlock = useMutation({
    mutationFn: ({ id, ...data }: any) => fetchJSON(`/contentcraft/blocks/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contentcraft-page", pageId] }); setSaved(false); setTimeout(() => setSaved(true), 2000); },
  });

  const deleteBlock = useMutation({
    mutationFn: (id: number) => fetchJSON(`/contentcraft/blocks/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contentcraft-page", pageId] }); },
  });

  const duplicateBlock = useMutation({
    mutationFn: (id: number) => fetchJSON(`/contentcraft/blocks/${id}/duplicate`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contentcraft-page", pageId] }); },
  });

  const generateFromTemplate = useMutation({
    mutationFn: (data: any) => fetchJSON("/contentcraft/generate-from-template", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (p) => { navigate(`/teacher/contentcraft/${p.id}`); qc.invalidateQueries({ queryKey: ["contentcraft-pages"] }); },
  });

  const handleAiGenerateBlock = async (blockType: string) => {
    if (!pageId) return;
    setAiLoading(true);
    try {
      const resp = await fetchJSON("/ai-studio/generate", {
        method: "POST",
        body: JSON.stringify({ contentType: blockType === "key-terms" ? "flashcards" : "lesson", topic: page?.title || "topic", subject: "" }),
      });
      const content = blockType === "key-terms"
        ? { terms: (resp.generated || []).slice(0, 5).map((f: any) => ({ term: f.front, definition: f.back })) }
        : { text: resp.generated?.introduction || resp.generated?.mainContent || "AI-generated content" };
      addBlock.mutate({ pageId, blockType, content });
    } catch {}
    setAiLoading(false);
  };

  const handleSlashSelect = (blockType: string) => {
    if (!pageId) return;
    addBlock.mutate({ pageId, blockType, content: {} });
    setShowSlashMenu(false);
    setSlashSearch("");
  };

  /* ── Pages list ── */
  if (!pageId) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3"><Layout className="text-teal-600" size={28} /> ContentCraft Studio</h1>
              <p className="text-gray-500 mt-1">Block-based lesson & content page editor · Press <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">/</kbd> in editor to add blocks</p>
            </div>
            <Button onClick={() => createPage.mutate({ title: "New Page", template: "blank" })} className="bg-teal-600 hover:bg-teal-700 text-white">
              <Plus size={16} className="mr-2" /> New Page
            </Button>
          </motion.div>

          {templates && (
            <Card>
              <CardHeader><CardTitle className="text-base">Start from a Template</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(templates.builtin || []).map((t: any) => (
                    <motion.button key={t.id} whileHover={{ scale: 1.02 }} onClick={() => generateFromTemplate.mutate({ templateId: t.id, title: `New ${t.name}` })}
                      className="p-4 border-2 border-gray-200 hover:border-teal-400 rounded-xl text-left transition-all">
                      <Layout size={20} className="text-teal-600 mb-2" />
                      <p className="font-semibold text-sm">{t.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{t.description}</p>
                    </motion.button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Your Pages</CardTitle></CardHeader>
            <CardContent>
              {pagesLoading ? (
                <div className="space-y-3">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
              ) : (pages || []).length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <FileText size={40} className="mx-auto mb-3 opacity-50" />
                  <p>No pages yet. Create your first page above.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(pages || []).map((p: any) => (
                    <motion.div key={p.id} whileHover={{ y: -2 }} onClick={() => navigate(`/teacher/contentcraft/${p.id}`)}
                      className="p-4 border border-gray-200 rounded-xl cursor-pointer hover:border-teal-400 hover:shadow-sm transition-all">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-gray-800 text-sm line-clamp-2">{p.title}</h3>
                        <Badge variant="outline" className="text-xs shrink-0 ml-2">{p.block_count || 0} blocks</Badge>
                      </div>
                      {p.description && <p className="text-xs text-gray-500 line-clamp-2 mb-2">{p.description}</p>}
                      <div className="flex items-center gap-2 flex-wrap">
                        {p.board && <Badge className="text-xs bg-teal-100 text-teal-700">{p.board}</Badge>}
                        {p.subject && <Badge className="text-xs bg-blue-100 text-blue-700">{p.subject}</Badge>}
                        {p.topic && <Badge className="text-xs bg-purple-100 text-purple-700">{p.topic}</Badge>}
                      </div>
                      <p className="text-xs text-gray-400 mt-2">{new Date(p.updated_at).toLocaleDateString()}</p>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const blocks: any[] = page?.blocks || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-card border-b border-border px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/teacher/contentcraft")}><ArrowLeft size={16} /></Button>
          <div>
            <h1 className="font-bold text-gray-900 text-sm">{page?.title || "Loading..."}</h1>
            <p className="text-xs text-gray-500">{blocks.length} block{blocks.length !== 1 ? "s" : ""} · press <kbd className="px-1 py-0.5 bg-gray-100 rounded font-mono text-[10px]">/</kbd> to add</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <motion.div animate={{ opacity: saved ? 0 : 1 }} className="text-xs text-gray-400 flex items-center gap-1">
            <Save size={12} /> Saving...
          </motion.div>
          <Button variant="outline" size="sm" onClick={() => setShowVersionHistory(true)}><History size={14} className="mr-1" /> History</Button>
          <Button variant="outline" size="sm"><Eye size={14} className="mr-1" /> Preview</Button>
          <Button variant="outline" size="sm"><Share2 size={14} className="mr-1" /> Share</Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-4">
        {pageLoading ? (
          <div className="space-y-4">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
        ) : (
          <>
            <AnimatePresence>
              {blocks.map((block: any) => (
                <BlockRenderer
                  key={block.id}
                  block={block}
                  selected={selectedBlock === block.id}
                  onSelect={setSelectedBlock}
                  onUpdate={(id, content) => updateBlock.mutate({ id, content })}
                  onDelete={(id) => { deleteBlock.mutate(id); if (selectedBlock === id) setSelectedBlock(null); }}
                  onDuplicate={(id) => duplicateBlock.mutate(id)}
                />
              ))}
            </AnimatePresence>

            {/* Slash Command Add Area */}
            <div className="relative" ref={addAreaRef}>
              <motion.button
                whileHover={{ scale: 1.005 }}
                onClick={openSlashMenu}
                className="w-full border-2 border-dashed border-gray-200 hover:border-teal-400 rounded-xl py-4 flex items-center justify-center gap-2 text-gray-400 hover:text-teal-600 transition-all group"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-gray-100 group-hover:bg-teal-100 flex items-center justify-center transition-colors">
                    <Plus size={14} className="group-hover:text-teal-600 transition-colors" />
                  </div>
                  <span className="text-sm font-medium">Add Block</span>
                  <span className="text-xs opacity-60">or press <kbd className="px-1 bg-gray-100 rounded font-mono">/</kbd></span>
                </div>
              </motion.button>

              <AnimatePresence>
                {showSlashMenu && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowSlashMenu(false)} />
                    <div className="relative z-40">
                      <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl z-40 overflow-hidden">
                        {/* Search Input */}
                        <div className="p-3 border-b border-gray-100 flex items-center gap-2">
                          <Search size={14} className="text-gray-400 shrink-0" />
                          <input
                            ref={slashInputRef}
                            value={slashSearch}
                            onChange={e => { setSlashSearch(e.target.value); setSlashIndex(0); }}
                            placeholder="Search blocks…"
                            className="flex-1 text-sm outline-none bg-transparent text-gray-700 placeholder-gray-400"
                          />
                          <div className="flex items-center gap-1 text-[10px] text-gray-400">
                            <kbd className="px-1 py-0.5 bg-gray-100 rounded">↑↓</kbd>
                            <kbd className="px-1 py-0.5 bg-gray-100 rounded">↵</kbd>
                            <kbd className="px-1 py-0.5 bg-gray-100 rounded">Esc</kbd>
                          </div>
                        </div>
                        <div className="max-h-72 overflow-y-auto p-2">
                          {BLOCK_CATEGORIES.map(cat => {
                            const items = BLOCK_TYPES.filter(bt => bt.category === cat.id && (!slashSearch || bt.label.toLowerCase().includes(slashSearch.toLowerCase()) || bt.slash.includes(slashSearch.toLowerCase())));
                            if (!items.length) return null;
                            const flatAll = BLOCK_TYPES.filter(bt => !slashSearch || bt.label.toLowerCase().includes(slashSearch.toLowerCase()) || bt.slash.includes(slashSearch.toLowerCase()));
                            return (
                              <div key={cat.id} className="mb-3">
                                <p className={`text-[10px] font-bold uppercase tracking-wider px-2 mb-1 ${cat.color}`}>{cat.label}</p>
                                <div className="space-y-0.5">
                                  {items.map(bt => {
                                    const globalIdx = flatAll.indexOf(bt);
                                    return (
                                      <motion.button key={bt.id} whileHover={{ backgroundColor: "#f0fdfa" }}
                                        onClick={() => handleSlashSelect(bt.id)}
                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors ${globalIdx === slashIndex ? "bg-teal-50 border border-teal-200" : "hover:bg-gray-50"}`}>
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cat.id === "education" ? "bg-teal-100" : cat.id === "media" ? "bg-blue-100" : "bg-gray-100"}`}>
                                          <bt.icon size={14} className={cat.id === "education" ? "text-teal-600" : cat.id === "media" ? "text-blue-600" : "text-gray-600"} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-semibold text-gray-800">{bt.label}</p>
                                          <p className="text-xs text-gray-400">{bt.desc}</p>
                                        </div>
                                        <code className="text-[10px] text-gray-300 font-mono shrink-0">{bt.slash}</code>
                                      </motion.button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                          {BLOCK_TYPES.filter(bt => !slashSearch || bt.label.toLowerCase().includes(slashSearch.toLowerCase())).length === 0 && (
                            <p className="text-center text-sm text-gray-400 py-6">No blocks match "{slashSearch}"</p>
                          )}
                        </div>
                        <div className="border-t border-gray-100 p-2">
                          <Button size="sm" variant="ghost" className="w-full text-xs gap-1.5 text-teal-600 hover:text-teal-700" onClick={() => handleAiGenerateBlock("text")} disabled={aiLoading}>
                            <Sparkles size={13} /> {aiLoading ? "Generating..." : "AI Generate Block"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {blocks.length === 0 && !showSlashMenu && (
              <div className="text-center py-16 text-gray-400">
                <Layout size={48} className="mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">Start building your page</p>
                <p className="text-sm mt-1">Click "Add Block" or press <kbd className="px-1.5 py-0.5 bg-gray-200 rounded font-mono">/</kbd> to open the block menu</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Version History Dialog */}
      <Dialog open={showVersionHistory} onOpenChange={setShowVersionHistory}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Version History</DialogTitle></DialogHeader>
          <div className="py-4">
            {selectedBlock ? <VersionHistoryPanel blockId={selectedBlock} /> : <p className="text-sm text-gray-500 text-center py-4">Select a block first to view its version history</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VersionHistoryPanel({ blockId }: { blockId: number }) {
  const { data: history, isLoading } = useQuery({
    queryKey: ["block-history", blockId],
    queryFn: () => fetchJSON(`/contentcraft/blocks/${blockId}/version-history`),
  });
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {(history || []).map((v: any) => (
        <div key={v.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">Version {v.version}</p>
            <p className="text-xs text-gray-400">{new Date(v.created_at).toLocaleString()}</p>
          </div>
          {v.author_name && <p className="text-xs text-gray-500">by {v.author_name}</p>}
        </div>
      ))}
      {(!history?.length) && <p className="text-sm text-gray-400 text-center py-4">No version history yet</p>}
    </div>
  );
}
