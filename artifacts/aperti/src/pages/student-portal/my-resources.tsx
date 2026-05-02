import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FolderOpen, Link2, FileText, Video, Mic, BookOpen, ExternalLink, Tag, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

type Resource = {
  id: number; title: string; description: string | null; type: string;
  url: string | null; content: string | null; topic: string | null;
  tags: string | null; subjectName: string | null; viewCount: number; createdAt: string;
};

const TYPE_CONFIG: Record<string, { icon: typeof Link2; color: string; bg: string; label: string }> = {
  link: { icon: Link2, color: "text-blue-600", bg: "bg-blue-50", label: "Link" },
  note: { icon: FileText, color: "text-emerald-600", bg: "bg-emerald-50", label: "Note" },
  video: { icon: Video, color: "text-purple-600", bg: "bg-purple-50", label: "Video" },
  recording: { icon: Mic, color: "text-rose-600", bg: "bg-rose-50", label: "Recording" },
  pdf: { icon: BookOpen, color: "text-amber-600", bg: "bg-amber-50", label: "PDF" },
  default: { icon: FolderOpen, color: "text-gray-600", bg: "bg-gray-50", label: "File" },
};

export default function MyResources() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/portal/resources", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(setResources)
      .finally(() => setLoading(false));
  }, []);

  const handleOpen = async (resource: Resource) => {
    await fetch(`/api/resources/${resource.id}/view`, { method: "POST", credentials: "include" });
    if (resource.url) window.open(resource.url, "_blank");
    else setExpandedId(expandedId === resource.id ? null : resource.id);
  };

  const filtered = resources.filter(r =>
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    (r.topic || "").toLowerCase().includes(search.toLowerCase()) ||
    (r.subjectName || "").toLowerCase().includes(search.toLowerCase())
  );

  const grouped: Record<string, Resource[]> = {};
  for (const r of filtered) {
    const key = r.subjectName || "General";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
          <FolderOpen className="h-6 w-6 text-indigo-500" />Resources
        </h1>
        <p className="text-gray-500 text-sm mt-1">Notes, videos, and materials shared by your teacher.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <Input className="pl-9 bg-white border-gray-200 rounded-xl" placeholder="Search resources..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{[...Array(6)].map((_, i) => <div key={i} className="h-28 bg-white animate-pulse rounded-2xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-gray-400 bg-white rounded-2xl">
          <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p>{search ? "No resources match your search." : "No resources shared yet."}</p>
        </div>
      ) : (
        Object.entries(grouped).map(([subject, items]) => (
          <div key={subject} className="space-y-2">
            <h2 className="text-xs font-bold text-indigo-500 uppercase tracking-wide px-1">{subject}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {items.map((r, i) => {
                const cfg = TYPE_CONFIG[r.type] || TYPE_CONFIG.default;
                const isExpanded = expandedId === r.id;
                return (
                  <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <button className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-50/50 transition-colors"
                      onClick={() => handleOpen(r)}>
                      <div className={`w-9 h-9 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                        <cfg.icon className={`h-4 w-4 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-gray-900 line-clamp-1">{r.title}</p>
                          {r.url && <ExternalLink className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 mt-0.5" />}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                          {r.topic && <span className="text-[10px] text-gray-400">{r.topic}</span>}
                        </div>
                        {r.description && <p className="text-xs text-gray-400 mt-1 line-clamp-1">{r.description}</p>}
                      </div>
                    </button>
                    {isExpanded && r.content && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="overflow-hidden border-t border-gray-50 px-4 pb-4 pt-3">
                        <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{r.content}</p>
                        {r.tags && (
                          <div className="flex items-center gap-1 mt-3 flex-wrap">
                            <Tag className="h-3 w-3 text-gray-400" />
                            {r.tags.split(",").map(t => t.trim()).filter(Boolean).map(t => (
                              <span key={t} className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded">{t}</span>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
