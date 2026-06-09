import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Plus, Sparkles, Trash2, Edit2, Check, X,
  Loader2, BookOpen, ArrowRight, Search, ChevronDown, ChevronUp
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const token = () => localStorage.getItem("aperti_token") || "";
const authH = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token()}` });
async function fetchJSON(url: string) { const r = await fetch(url, { headers: authH() }); return r.json(); }
async function postJSON(url: string, body: unknown) { const r = await fetch(url, { method: "POST", headers: authH(), body: JSON.stringify(body) }); return r.json(); }
async function putJSON(url: string, body: unknown) { const r = await fetch(url, { method: "PUT", headers: authH(), body: JSON.stringify(body) }); return r.json(); }
async function deleteReq(url: string) { await fetch(url, { method: "DELETE", headers: authH() }); }

export default function RevisionNotesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [aiTopic, setAiTopic] = useState("");
  const [showAiForm, setShowAiForm] = useState(false);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["revision-notes"],
    queryFn: () => fetchJSON("/api/revision-notes"),
  });

  const createMut = useMutation({
    mutationFn: () => postJSON("/api/revision-notes", { title: "New Note", content: "# New Note\n\nStart writing here…" }),
    onSuccess: (note) => { qc.invalidateQueries({ queryKey: ["revision-notes"] }); setSelected(note); setEditing(true); setEditTitle(note.title); setEditContent(note.content); },
  });

  const aiMut = useMutation({
    mutationFn: () => postJSON("/api/revision-notes/generate", { topic: aiTopic }),
    onSuccess: (note) => { qc.invalidateQueries({ queryKey: ["revision-notes"] }); setSelected(note); setShowAiForm(false); setAiTopic(""); toast({ title: "AI revision note generated!" }); },
    onError: () => toast({ title: "Failed to generate note", variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: () => putJSON(`/api/revision-notes/${selected?.id}`, { title: editTitle, content: editContent }),
    onSuccess: (note) => { qc.invalidateQueries({ queryKey: ["revision-notes"] }); setSelected(note); setEditing(false); toast({ title: "Note saved" }); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteReq(`/api/revision-notes/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["revision-notes"] }); setSelected(null); toast({ title: "Note deleted" }); },
  });

  const filtered = (notes as any[]).filter((n: any) =>
    n.title?.toLowerCase().includes(search.toLowerCase()) ||
    n.content?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 border-r border-gray-100 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-teal-500" /> Revision Notes
            </h2>
            <button onClick={() => createMut.mutate()} disabled={createMut.isPending}
              className="w-7 h-7 bg-teal-500 text-white rounded-lg flex items-center justify-center hover:bg-teal-600 transition-colors">
              {createMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search notes…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-300"
            />
          </div>
          {/* AI generate */}
          <button onClick={() => setShowAiForm(v => !v)}
            className="w-full flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-100 text-teal-700 rounded-xl text-sm font-medium hover:border-teal-200 transition-colors">
            <Sparkles className="w-3.5 h-3.5" /> Generate with AI
            {showAiForm ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
          </button>
          <AnimatePresence>
            {showAiForm && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="space-y-2">
                  <input value={aiTopic} onChange={e => setAiTopic(e.target.value)} placeholder="Topic (e.g. Photosynthesis, WW2)"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-300"
                    onKeyDown={e => { if (e.key === "Enter" && aiTopic.trim()) aiMut.mutate(); }}
                  />
                  <button onClick={() => aiMut.mutate()} disabled={!aiTopic.trim() || aiMut.isPending}
                    className="w-full py-2 bg-teal-500 text-white rounded-xl text-sm font-semibold hover:bg-teal-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                    {aiMut.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</> : "Generate"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Note list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 px-4">
              <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">{search ? "No matching notes" : "No notes yet"}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map((note: any) => (
                <button key={note.id} onClick={() => { setSelected(note); setEditing(false); }}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${selected?.id === note.id ? "bg-teal-50" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium truncate ${selected?.id === note.id ? "text-teal-700" : "text-gray-800"}`}>
                        {note.title || "Untitled"}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{note.content?.substring(0, 60) || ""}</p>
                      <p className="text-[10px] text-gray-300 mt-0.5">{new Date(note.updated_at).toLocaleDateString("en-GB")}</p>
                    </div>
                    {note.ai_generated && <Sparkles className="w-3 h-3 text-teal-400 shrink-0 mt-0.5" />}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Editor / Viewer */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
        {selected ? (
          <>
            {/* Toolbar */}
            <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between gap-4">
              {editing ? (
                <input
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="flex-1 text-lg font-bold text-gray-900 bg-transparent focus:outline-none border-b-2 border-teal-300"
                />
              ) : (
                <h2 className="text-lg font-bold text-gray-900 truncate">{selected.title}</h2>
              )}
              <div className="flex items-center gap-2 shrink-0">
                {editing ? (
                  <>
                    <button onClick={() => updateMut.mutate()} disabled={updateMut.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-500 text-white rounded-lg text-sm font-semibold hover:bg-teal-600 disabled:opacity-50 transition-colors">
                      {updateMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
                    </button>
                    <button onClick={() => setEditing(false)} className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"><X className="w-4 h-4" /></button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setEditing(true); setEditTitle(selected.title); setEditContent(selected.content); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button onClick={() => { if (confirm("Delete this note?")) deleteMut.mutate(selected.id); }}
                      className="p-1.5 text-red-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {editing ? (
                <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  className="w-full h-full min-h-[400px] bg-white border border-gray-200 rounded-xl p-5 text-sm font-mono text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-300 resize-none shadow-sm"
                  placeholder="Write your revision notes in Markdown…"
                />
              ) : (
                <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
                  <div className="prose prose-sm prose-teal max-w-none text-gray-800 whitespace-pre-wrap">
                    {selected.content}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
            <FileText className="w-14 h-14 text-gray-200 mb-4" />
            <h3 className="text-lg font-bold text-gray-400 mb-2">Select a note</h3>
            <p className="text-sm text-gray-300 mb-6 max-w-xs">Pick a note from the sidebar or create a new one to get started.</p>
            <button onClick={() => createMut.mutate()} disabled={createMut.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-teal-500 text-white rounded-xl text-sm font-semibold hover:bg-teal-600 transition-colors">
              <Plus className="w-4 h-4" /> New Note
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
