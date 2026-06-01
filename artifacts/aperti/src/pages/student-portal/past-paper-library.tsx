import { apiFetch } from "@/lib/api";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  BookOpen, Download, Search, FileText, Calendar,
  X, FlaskConical, Calculator, Atom, Globe, BookMarked,
  Cpu, DollarSign, Leaf, Languages, ChevronRight, ScanLine,
} from "lucide-react";

type Paper = {
  id: number; title: string; subject: string; year: number | null;
  session: string | null; variant: string | null; paper_number: string | null;
  file_url: string; mark_scheme_url: string | null; examiner_report_url: string | null;
  created_at: string;
};

/* ── Subject colour + icon system ── */
interface SubjectMeta { primary: string; light: string; icon: React.ComponentType<{ className?: string }> }
const SUBJECT_META: Record<string, SubjectMeta> = {
  Physics:            { primary: "#1565C0", light: "#EBF3FF", icon: Atom },
  Mathematics:        { primary: "#2E7D32", light: "#EBF5EC", icon: Calculator },
  Math:               { primary: "#2E7D32", light: "#EBF5EC", icon: Calculator },
  Chemistry:          { primary: "#6A1B9A", light: "#F5EBF9", icon: FlaskConical },
  Biology:            { primary: "#00838F", light: "#E0F7FA", icon: Leaf },
  English:            { primary: "#C62828", light: "#FEECEC", icon: BookMarked },
  History:            { primary: "#4E342E", light: "#F1ECEA", icon: Globe },
  Geography:          { primary: "#006064", light: "#E0F7FA", icon: Globe },
  Economics:          { primary: "#E65100", light: "#FEF0E8", icon: DollarSign },
  "Computer Science": { primary: "#4527A0", light: "#EEEBF9", icon: Cpu },
  CS:                 { primary: "#4527A0", light: "#EEEBF9", icon: Cpu },
  Arabic:             { primary: "#AD1457", light: "#FDEEF4", icon: Languages },
  Science:            { primary: "#00796B", light: "#E0F2F1", icon: FlaskConical },
};
const subjectMeta = (s: string): SubjectMeta =>
  SUBJECT_META[s] ?? { primary: "#00796B", light: "#E0F2F1", icon: FileText };

/* ── Session badge colours ── */
const SESSION_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  "May/June": { bg: "#FFF8E1", text: "#F57F17", dot: "#FBC02D" },
  "Oct/Nov":  { bg: "#E3F2FD", text: "#1565C0", dot: "#1976D2" },
  "Feb/Mar":  { bg: "#E8F5E9", text: "#2E7D32", dot: "#43A047" },
  "Jan":      { bg: "#EDE7F6", text: "#4527A0", dot: "#7E57C2" },
};
const sessionStyle = (s?: string | null) =>
  SESSION_STYLE[s ?? ""] ?? { bg: "#F5F5F5", text: "#616161", dot: "#9E9E9E" };

const SESSIONS = ["May/June", "Oct/Nov", "Feb/Mar", "Jan", "Other"];

/* ── Animations ── */
const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 18, scale: 0.97 },
  show:   { opacity: 1, y: 0,  scale: 1, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

/* ── Download button ── */
function DownloadBtn({
  href, label, icon: Icon, color, bg,
}: { href: string; label: string; icon: React.ComponentType<{className?: string}>; color: string; bg: string }) {
  return (
    <motion.a
      href={href} target="_blank" rel="noopener noreferrer"
      whileHover={{ scale: 1.06, y: -1 }}
      whileTap={{ scale: 0.96 }}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
      style={{ background: bg, color }}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </motion.a>
  );
}

/* ── Paper card ── */
function PaperCard({ paper, index }: { paper: Paper; index: number }) {
  const meta = subjectMeta(paper.subject);
  const sess = sessionStyle(paper.session);
  const SubjectIcon = meta.icon;

  return (
    <motion.div
      variants={itemVariants}
      layout
      whileHover={{ y: -4, boxShadow: "0 16px 40px rgba(0,0,0,0.10)", transition: { duration: 0.2 } }}
      className="bg-white rounded-2xl overflow-hidden border border-gray-100 flex flex-col"
      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
    >
      {/* Colour accent strip */}
      <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${meta.primary}, ${meta.primary}88)` }} />

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Top row: icon + title */}
        <div className="flex items-start gap-3">
          <motion.div
            whileHover={{ rotate: [0, -8, 8, 0], transition: { duration: 0.5 } }}
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: meta.light }}
          >
            <SubjectIcon className="h-5 w-5" style={{ color: meta.primary }} />
          </motion.div>

          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-gray-900 leading-snug line-clamp-2">{paper.title}</p>
            <p className="text-xs text-gray-400 mt-0.5 font-medium">{paper.subject}</p>
          </div>
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap gap-1.5">
          {paper.year && (
            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              <Calendar className="h-2.5 w-2.5" />{paper.year}
            </span>
          )}
          {paper.session && (
            <span
              className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: sess.bg, color: sess.text }}
            >
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: sess.dot }} />
              {paper.session}
            </span>
          )}
          {paper.variant && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-gray-200 text-gray-500 bg-white">
              Variant {paper.variant}
            </span>
          )}
          {paper.paper_number && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-gray-200 text-gray-500 bg-white">
              {paper.paper_number}
            </span>
          )}
        </div>

        {/* Download buttons */}
        <div className="flex flex-wrap gap-2 mt-auto pt-2 border-t border-gray-50">
          <DownloadBtn
            href={paper.file_url} label="Question Paper"
            icon={Download} color={meta.primary} bg={meta.light}
          />
          {paper.mark_scheme_url && (
            <DownloadBtn
              href={paper.mark_scheme_url} label="Mark Scheme"
              icon={ScanLine} color="#2E7D32" bg="#E8F5E9"
            />
          )}
          {paper.examiner_report_url && (
            <DownloadBtn
              href={paper.examiner_report_url} label="Examiner Report"
              icon={BookOpen} color="#5D4037" bg="#EFEBE9"
            />
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Skeleton loader ── */
function PaperSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 animate-pulse">
      <div className="h-1.5 w-full bg-gray-200" />
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-gray-100 rounded w-3/4" />
            <div className="h-2.5 bg-gray-100 rounded w-1/2" />
          </div>
        </div>
        <div className="flex gap-1.5">
          <div className="h-5 bg-gray-100 rounded-full w-14" />
          <div className="h-5 bg-gray-100 rounded-full w-20" />
        </div>
        <div className="flex gap-2 pt-2 border-t border-gray-50">
          <div className="h-7 bg-gray-100 rounded-lg w-28" />
          <div className="h-7 bg-gray-100 rounded-lg w-24" />
        </div>
      </div>
    </div>
  );
}

/* ── Main component ── */
export default function PastPaperLibrary() {
  const [papers, setPapers]           = useState<Paper[]>([]);
  const [subjects, setSubjects]       = useState<string[]>([]);
  const [loading, setLoading]         = useState(true);
  const [filterSubject, setFilterSubject] = useState("");
  const [filterYear, setFilterYear]   = useState("");
  const [filterSession, setFilterSession] = useState("");
  const [search, setSearch]           = useState("");
  const [searchInput, setSearchInput] = useState("");

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterSubject) params.set("subject", filterSubject);
    if (filterYear)    params.set("year", filterYear);
    if (filterSession) params.set("session", filterSession);
    if (search)        params.set("search", search);
    const [papersRes, subjectsRes] = await Promise.all([
      apiFetch(`/api/past-papers?${params}`, { credentials: "include" }),
      apiFetch("/api/past-papers/subjects", { credentials: "include" }),
    ]);
    if (papersRes.ok)    setPapers(await papersRes.json());
    if (subjectsRes.ok)  setSubjects(await subjectsRes.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterSubject, filterYear, filterSession, search]);

  /* Debounce search */
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const years      = [...new Set(papers.map(p => p.year).filter(Boolean))].sort((a, b) => (b as number) - (a as number));
  const hasFilters = filterSubject || filterYear || filterSession || search;
  const clearFilters = () => { setFilterSubject(""); setFilterYear(""); setFilterSession(""); setSearch(""); setSearchInput(""); };

  /* Group by subject for unfiltered view */
  const grouped = papers.reduce((acc, p) => {
    if (!acc[p.subject]) acc[p.subject] = [];
    acc[p.subject].push(p);
    return acc;
  }, {} as Record<string, Paper[]>);

  return (
    <div className="space-y-0 -mx-4 sm:-mx-6">
      {/* ── Hero header ── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden px-4 sm:px-6 pt-8 pb-10"
        style={{
          background: "linear-gradient(135deg, #004D40 0%, #00796B 50%, #009688 100%)",
        }}
      >
        {/* Background decorative circles */}
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-10 bg-white" />
        <div className="absolute -bottom-16 -left-6 w-36 h-36 rounded-full opacity-10 bg-white" />
        <div className="absolute top-4 right-32 w-6 h-6 rounded-full opacity-20 bg-white" />
        <div className="absolute bottom-6 right-8 w-10 h-10 rounded-full opacity-15 bg-white" />

        <div className="relative flex items-center justify-between gap-4">
          <div>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="flex items-center gap-2.5 mb-3"
            >
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <BookOpen className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black text-white tracking-tight">Past Paper Library</h1>
                <p className="text-xs text-white/70 mt-0.5">
                  {loading ? "Loading…" : `${papers.length} paper${papers.length !== 1 ? "s" : ""} available`}
                </p>
              </div>
            </motion.div>

            {/* Session pills */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="flex flex-wrap gap-2"
            >
              {Object.entries(SESSION_STYLE).map(([s, style]) => (
                <button
                  key={s}
                  onClick={() => setFilterSession(filterSession === s ? "" : s)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all"
                  style={{
                    background: filterSession === s ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.15)",
                    color: filterSession === s ? style.text : "white",
                    border: "1px solid rgba(255,255,255,0.25)",
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: filterSession === s ? style.dot : "white" }} />
                  {s}
                </button>
              ))}
            </motion.div>
          </div>

          {/* Decorative stacked papers */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="hidden sm:flex items-center justify-center relative w-24 h-24 flex-shrink-0"
          >
            {[12, 6, 0].map((rot, i) => (
              <div key={i} className="absolute w-16 h-20 bg-white/20 backdrop-blur-sm rounded-xl border border-white/30"
                style={{ transform: `rotate(${rot - 6}deg) translateY(${i * 2}px)` }}>
                <div className="p-2 space-y-1.5">
                  {[1, 2, 3, 4].map(j => (
                    <div key={j} className="h-1 rounded-full bg-white/40" style={{ width: `${60 + j * 8}%` }} />
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </motion.div>

      {/* ── Search & filters ── */}
      <div className="px-4 sm:px-6 py-5 bg-white border-b border-gray-100 space-y-4 sticky top-0 z-10 shadow-sm">
        {/* Search bar */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative"
        >
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search past papers…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all"
            style={{ "--tw-ring-color": "#00796B" } as React.CSSProperties}
          />
          <AnimatePresence>
            {searchInput && (
              <motion.button
                initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}
                onClick={() => { setSearchInput(""); setSearch(""); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 transition-colors"
              >
                <X className="h-3 w-3 text-gray-500" />
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Subject pills */}
        {subjects.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
            className="flex flex-wrap gap-1.5"
          >
            <button
              onClick={() => setFilterSubject("")}
              className="px-3 py-1 rounded-full text-xs font-bold transition-all"
              style={{
                background: !filterSubject ? "#00796B" : "#F5F5F5",
                color: !filterSubject ? "white" : "#616161",
              }}
            >
              All Subjects
            </button>
            {subjects.map(s => {
              const meta = subjectMeta(s);
              const active = filterSubject === s;
              return (
                <motion.button
                  key={s}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setFilterSubject(active ? "" : s)}
                  className="px-3 py-1 rounded-full text-xs font-bold transition-all"
                  style={{
                    background: active ? meta.primary : meta.light,
                    color: active ? "white" : meta.primary,
                  }}
                >
                  {s}
                </motion.button>
              );
            })}
          </motion.div>
        )}

        {/* Year select + clear */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filterYear}
            onChange={e => setFilterYear(e.target.value)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 focus:outline-none focus:ring-1 cursor-pointer"
          >
            <option value="">All years</option>
            {years.map(y => <option key={y} value={String(y)}>{y}</option>)}
          </select>

          <AnimatePresence>
            {hasFilters && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8, x: -8 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: -8 }}
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
              >
                <X className="h-3 w-3" />Clear filters
              </motion.button>
            )}
          </AnimatePresence>

          {!loading && (
            <span className="ml-auto text-xs text-gray-400 font-medium">
              {papers.length} result{papers.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* ── Content area ── */}
      <div className="px-4 sm:px-6 py-6">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => <PaperSkeleton key={i} />)}
          </div>
        ) : papers.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="text-center py-24"
          >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="w-20 h-20 rounded-3xl mx-auto mb-5 flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #E0F2F1, #B2DFDB)" }}
            >
              <BookOpen className="h-10 w-10 text-teal-600" />
            </motion.div>
            <p className="font-black text-gray-900 text-lg mb-2">No papers found</p>
            <p className="text-sm text-gray-400 max-w-xs mx-auto">
              {hasFilters
                ? "Try adjusting your filters or search terms"
                : "Past papers will appear here once uploaded by your teacher"}
            </p>
            {hasFilters && (
              <button onClick={clearFilters}
                className="mt-5 px-5 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: "#00796B" }}>
                Clear all filters
              </button>
            )}
          </motion.div>
        ) : hasFilters ? (
          /* Filtered — flat grid */
          <motion.div
            key="filtered"
            variants={containerVariants} initial="hidden" animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {papers.map((paper, i) => (
              <PaperCard key={paper.id} paper={paper} index={i} />
            ))}
          </motion.div>
        ) : (
          /* Unfiltered — grouped by subject */
          <div className="space-y-10">
            {Object.entries(grouped).map(([subject, subjectPapers], gi) => {
              const meta = subjectMeta(subject);
              const SubjectIcon = meta.icon;
              return (
                <motion.div
                  key={subject}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: gi * 0.08, ease: [0.22, 1, 0.36, 1] }}
                >
                  {/* Subject header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: meta.light }}>
                      <SubjectIcon className="h-4 w-4" style={{ color: meta.primary }} />
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <h2 className="font-black text-gray-900 text-sm">{subject}</h2>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: meta.light, color: meta.primary }}>
                        {subjectPapers.length}
                      </span>
                    </div>
                    <button
                      onClick={() => setFilterSubject(subject)}
                      className="flex items-center gap-1 text-xs font-semibold hover:opacity-70 transition-opacity"
                      style={{ color: meta.primary }}
                    >
                      View all <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Papers grid */}
                  <motion.div
                    variants={containerVariants} initial="hidden" animate="show"
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                  >
                    {subjectPapers.slice(0, 6).map((paper, i) => (
                      <PaperCard key={paper.id} paper={paper} index={i} />
                    ))}
                  </motion.div>

                  {subjectPapers.length > 6 && (
                    <motion.button
                      whileHover={{ x: 4 }}
                      onClick={() => setFilterSubject(subject)}
                      className="mt-3 flex items-center gap-1.5 text-xs font-semibold transition-all"
                      style={{ color: meta.primary }}
                    >
                      +{subjectPapers.length - 6} more {subject} papers
                      <ChevronRight className="h-3.5 w-3.5" />
                    </motion.button>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
