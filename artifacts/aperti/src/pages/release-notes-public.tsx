import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useInView } from "framer-motion";
import { Link } from "wouter";
import { FileText, Shield, Zap, Megaphone, AlertCircle } from "lucide-react";

const TEAL = "#0D9488";

const TYPE_META: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  major:        { label: "Major Release", color: "#7C3AED", bg: "#F5F3FF", icon: Zap },
  minor:        { label: "Update",        color: "#2563EB", bg: "#EFF6FF", icon: FileText },
  bugfix:       { label: "Bug Fix",       color: "#D97706", bg: "#FFFBEB", icon: AlertCircle },
  security:     { label: "Security",      color: "#DC2626", bg: "#FEF2F2", icon: Shield },
  announcement: { label: "Announcement",  color: "#0D9488", bg: "#F0FDFA", icon: Megaphone },
};

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay }}>
      {children}
    </motion.div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  const html = content
    .replace(/^## (.+)$/gm, '<h2 class="text-base font-bold text-gray-900 mt-4 mb-2">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold text-gray-800 mt-3 mb-1">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li class="text-sm text-gray-600 ml-4 list-disc">$1</li>')
    .replace(/\n\n/g, '<br/>');
  return <div dangerouslySetInnerHTML={{ __html: html }} className="prose-sm text-gray-600" />;
}

export default function ReleaseNotesPublicPage() {
  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["public-release-notes"],
    queryFn: () => fetch("/api/release-notes").then((r) => r.json()),
  });

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "Inter, sans-serif" }}>
      <div className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-bold text-lg text-gray-900">Aperti<span style={{ color: TEAL }}>.</span></Link>
          <div className="flex items-center gap-4">
            <Link href="/features" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Features</Link>
            <Link href="/roadmap" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Roadmap</Link>
          </div>
        </div>
      </div>

      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-16 text-center">
          <Reveal>
            <div className="flex items-center justify-center gap-2 mb-6">
              <FileText className="w-5 h-5" style={{ color: TEAL }} />
              <span className="text-sm font-medium" style={{ color: TEAL }}>Changelog</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">What's New</h1>
            <p className="text-lg text-gray-500">Every update, improvement, and new feature — all in one place.</p>
          </Reveal>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 md:px-6 py-12 space-y-6">
        {isLoading ? (
          <div className="text-center text-gray-400 py-16">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: TEAL, borderTopColor: "transparent" }} />
            Loading...
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center text-gray-400 py-16">No release notes yet.</div>
        ) : (
          notes.map((note: any, i: number) => {
            const meta = TYPE_META[note.type] || TYPE_META.minor;
            const NoteIcon = meta.icon;
            return (
              <Reveal key={note.id} delay={i * 0.05}>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-6 py-5 border-b border-gray-50">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ color: meta.color, backgroundColor: meta.bg }}>
                            <NoteIcon className="w-3 h-3" />{meta.label}
                          </span>
                          {note.version && <span className="text-xs text-gray-400 font-mono bg-gray-100 px-2 py-0.5 rounded">v{note.version}</span>}
                        </div>
                        <h2 className="text-xl font-bold text-gray-900">{note.title}</h2>
                        {note.summary && <p className="text-sm text-gray-500 mt-1">{note.summary}</p>}
                      </div>
                      {note.published_at && (
                        <p className="text-xs text-gray-400 flex-shrink-0">{new Date(note.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
                      )}
                    </div>
                  </div>
                  {note.content && (
                    <div className="px-6 py-4">
                      <MarkdownContent content={note.content} />
                    </div>
                  )}
                </div>
              </Reveal>
            );
          })
        )}
      </div>
    </div>
  );
}
