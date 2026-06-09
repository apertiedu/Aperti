import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { fetchJSON, postJSON, putJSON, deleteJSON } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Layout, Eye, Edit2, Trash2, ChevronUp, ChevronDown, Globe, ToggleLeft, ToggleRight } from "lucide-react";

const SECTION_TYPES = ["hero","features","testimonials","pricing","faq","statistics","roadmap","videos","waitlist","contact","custom"] as const;

const TYPE_ICONS: Record<string, string> = {
  hero: "🦸", features: "⚡", testimonials: "💬", pricing: "💰", faq: "❓",
  statistics: "📊", roadmap: "🗺️", videos: "🎥", waitlist: "📋", contact: "📬", custom: "🔧",
};

function SectionEditor({ section, onSave, onClose }: { section: any; onSave: (data: any) => void; onClose: () => void }) {
  const [content, setContent] = useState(() => {
    try { return JSON.stringify(section?.content || {}, null, 2); } catch { return "{}"; }
  });
  const [slug, setSlug] = useState(section?.slug || "");
  const [type, setType] = useState(section?.type || "custom");
  const [isPublished, setIsPublished] = useState(section?.is_published ?? true);
  const [jsonError, setJsonError] = useState("");

  function handleSave() {
    try {
      const parsed = JSON.parse(content);
      setJsonError("");
      onSave({ slug, type, content: parsed, is_published: isPublished });
    } catch (e: any) {
      setJsonError("Invalid JSON: " + e.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Slug (unique ID)</label>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="hero, features-1..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Section Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
            {SECTION_TYPES.map((t) => <option key={t} value={t}>{TYPE_ICONS[t]} {t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-gray-600">Content (JSON)</label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Published</span>
            <button onClick={() => setIsPublished(!isPublished)} className={`transition-colors ${isPublished ? "text-teal-600" : "text-gray-300"}`}>
              {isPublished ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
            </button>
          </div>
        </div>
        <textarea
          value={content}
          onChange={(e) => { setContent(e.target.value); setJsonError(""); }}
          rows={12}
          className={`w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none ${jsonError ? "border-red-300" : "border-gray-200"}`}
        />
        {jsonError && <p className="text-xs text-red-500 mt-1">{jsonError}</p>}
        <p className="text-xs text-gray-400 mt-1">All section content is stored as JSON. Each section type has its own content schema.</p>
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
        <button onClick={handleSave} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors">Save Section</button>
      </div>
    </div>
  );
}

export default function LandingCMSPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: sections = [], isLoading } = useQuery({
    queryKey: ["admin-landing-sections"],
    queryFn: () => fetchJSON("/api/admin/landing-sections"),
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      editing
        ? putJSON(`/api/admin/landing-sections/${editing.id}`, data)
        : postJSON("/api/admin/landing-sections", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-landing-sections"] }); toast.success("Section saved"); setShowModal(false); setEditing(null); },
    onError: () => toast.error("Save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteJSON(`/api/admin/landing-sections/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-landing-sections"] }); toast.success("Section removed"); },
  });

  const reorderMutation = useMutation({
    mutationFn: (ids: number[]) => putJSON("/api/admin/landing-sections/reorder", { ids }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-landing-sections"] }),
  });

  const togglePublish = useMutation({
    mutationFn: ({ id, val }: { id: number; val: boolean }) => putJSON(`/api/admin/landing-sections/${id}`, { is_published: val }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-landing-sections"] }); toast.success("Updated"); },
  });

  function moveSection(index: number, dir: -1 | 1) {
    const sorted = [...sections].sort((a: any, b: any) => a.order - b.order);
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= sorted.length) return;
    const reordered = [...sorted];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    reorderMutation.mutate(reordered.map((s: any) => s.id));
  }

  const sorted = [...sections].sort((a: any, b: any) => a.order - b.order);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Landing Page CMS</h1>
          <p className="text-sm text-gray-500 mt-0.5">Control every section of the public landing page — no code changes needed</p>
        </div>
        <div className="flex gap-3">
          <a href="/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors">
            <Eye className="w-4 h-4" /> Preview
          </a>
          <button onClick={() => { setEditing(null); setShowModal(true); }} className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors">
            <Plus className="w-4 h-4" /> Add Section
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-start gap-3">
        <Globe className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-teal-800">Live CMS — changes appear instantly on the landing page</p>
          <p className="text-xs text-teal-600 mt-0.5">The landing page reads all section content from this database. Toggle visibility or reorder sections without any code deployment.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center text-gray-400 py-12">Loading sections...</div>
      ) : (
        <div className="space-y-2">
          {sorted.map((section: any, i: number) => (
            <motion.div key={section.id} layout className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center gap-4 px-5 py-4">
                {/* Drag order */}
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => moveSection(i, -1)} disabled={i === 0} className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-30 transition-colors"><ChevronUp className="w-3.5 h-3.5" /></button>
                  <button onClick={() => moveSection(i, 1)} disabled={i === sorted.length - 1} className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-30 transition-colors"><ChevronDown className="w-3.5 h-3.5" /></button>
                </div>

                {/* Type icon */}
                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-lg flex-shrink-0">
                  {TYPE_ICONS[section.type] || "🔧"}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900 text-sm">{section.slug}</p>
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">{section.type}</span>
                    {!section.is_published && <span className="px-2 py-0.5 bg-yellow-100 text-yellow-600 rounded-full text-xs">Hidden</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {Object.keys(section.content || {}).slice(0, 3).join(", ") || "No content keys"}
                  </p>
                </div>

                {/* Order badge */}
                <span className="text-xs text-gray-400 font-mono w-6 text-center">#{i + 1}</span>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => togglePublish.mutate({ id: section.id, val: !section.is_published })}
                    className={`transition-colors ${section.is_published ? "text-teal-600" : "text-gray-300"}`}
                    title={section.is_published ? "Hide section" : "Show section"}
                  >
                    {section.is_published ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                  <button onClick={() => { setEditing(section); setShowModal(true); }} className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => deleteMutation.mutate(section.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </motion.div>
          ))}
          {sorted.length === 0 && (
            <div className="bg-white rounded-xl p-12 text-center border border-gray-100 shadow-sm">
              <Layout className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No sections yet. Add your first landing page section.</p>
            </div>
          )}
        </div>
      )}

      {/* Edit/Create Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900">{editing ? `Edit Section: ${editing.slug}` : "Add Landing Section"}</h2>
              </div>
              <div className="px-6 py-4 max-h-[75vh] overflow-y-auto">
                <SectionEditor
                  section={editing}
                  onSave={(data) => saveMutation.mutate(data)}
                  onClose={() => { setShowModal(false); setEditing(null); }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
