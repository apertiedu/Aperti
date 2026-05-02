import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, Download, Search, FileText, Calendar,
  ExternalLink, X, ChevronDown
} from "lucide-react";

type Paper = {
  id: number; title: string; subject: string; year: number | null;
  session: string | null; variant: string | null; paper_number: string | null;
  file_url: string; mark_scheme_url: string | null; examiner_report_url: string | null;
  created_at: string;
};

const SESSIONS = ["May/June", "Oct/Nov", "Feb/Mar", "Jan", "Other"];
const SESSION_COLORS: Record<string, string> = {
  "May/June": "bg-amber-100 text-amber-700 border-amber-200",
  "Oct/Nov": "bg-blue-100 text-blue-700 border-blue-200",
  "Feb/Mar": "bg-green-100 text-green-700 border-green-200",
};

export default function PastPaperLibrary() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSubject, setFilterSubject] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterSession, setFilterSession] = useState("");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterSubject) params.set("subject", filterSubject);
    if (filterYear) params.set("year", filterYear);
    if (filterSession) params.set("session", filterSession);
    if (search) params.set("search", search);
    const [papersRes, subjectsRes] = await Promise.all([
      fetch(`/api/past-papers?${params}`, { credentials: "include" }),
      fetch("/api/past-papers/subjects", { credentials: "include" }),
    ]);
    if (papersRes.ok) setPapers(await papersRes.json());
    if (subjectsRes.ok) setSubjects(await subjectsRes.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterSubject, filterYear, filterSession, search]);

  const years = [...new Set(papers.map(p => p.year).filter(Boolean))].sort((a, b) => (b as number) - (a as number));
  const hasFilters = filterSubject || filterYear || filterSession || search;
  const clearFilters = () => { setFilterSubject(""); setFilterYear(""); setFilterSession(""); setSearch(""); };

  const grouped = papers.reduce((acc, paper) => {
    const key = paper.subject;
    if (!acc[key]) acc[key] = [];
    acc[key].push(paper);
    return acc;
  }, {} as Record<string, Paper[]>);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-sm">
          <BookOpen className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Past Paper Library</h1>
          <p className="text-xs text-muted-foreground">{papers.length} paper{papers.length !== 1 ? "s" : ""} available for download</p>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search papers..." className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-[110px] h-9 text-xs"><SelectValue placeholder="Year" /></SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterSession} onValueChange={setFilterSession}>
            <SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue placeholder="Session" /></SelectTrigger>
            <SelectContent>
              {SESSIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1 text-xs text-muted-foreground">
              <X className="h-3 w-3" />Clear
            </Button>
          )}
        </div>

        {/* Subject chips */}
        {subjects.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setFilterSubject("")}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${!filterSubject ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:border-primary/50"}`}>
              All
            </button>
            {subjects.map(s => (
              <button key={s} onClick={() => setFilterSubject(filterSubject === s ? "" : s)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${filterSubject === s ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:border-primary/50"}`}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 rounded-xl skeleton" />)}
        </div>
      ) : papers.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
            <BookOpen className="h-8 w-8 text-muted-foreground/30" />
          </div>
          <p className="font-semibold text-foreground mb-1">No papers available</p>
          <p className="text-sm text-muted-foreground">
            {hasFilters ? "Try adjusting your filters" : "Past papers will appear here once uploaded by your teacher"}
          </p>
        </div>
      ) : filterSubject || search || filterYear || filterSession ? (
        // Flat list when filtered
        <motion.div className="space-y-3" initial="hidden" animate="show"
          variants={{ show: { transition: { staggerChildren: 0.04 } } }}>
          {papers.map(paper => (
            <motion.div key={paper.id} variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}>
              <PaperCard paper={paper} />
            </motion.div>
          ))}
        </motion.div>
      ) : (
        // Grouped by subject
        <div className="space-y-6">
          {Object.entries(grouped).map(([subject, subjectPapers]) => (
            <div key={subject}>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="font-bold text-foreground">{subject}</h2>
                <Badge variant="secondary" className="text-xs">{subjectPapers.length}</Badge>
              </div>
              <div className="space-y-2">
                {subjectPapers.map(paper => <PaperCard key={paper.id} paper={paper} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PaperCard({ paper }: { paper: Paper }) {
  return (
    <Card className="border border-border/50 card-hover overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-sky-400 to-blue-500" />
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <FileText className="h-5 w-5 text-sky-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground leading-snug">{paper.title}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {paper.year && (
                <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />{paper.year}
                </span>
              )}
              {paper.session && (
                <Badge className={`text-[10px] px-1.5 py-0 border h-4 ${SESSION_COLORS[paper.session] || "bg-purple-100 text-purple-700 border-purple-200"}`}>
                  {paper.session}
                </Badge>
              )}
              {paper.variant && <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">V{paper.variant}</Badge>}
              {paper.paper_number && <span className="text-xs text-muted-foreground">{paper.paper_number}</span>}
            </div>
          </div>
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            <a href={paper.file_url} target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="h-8 text-xs gap-1 bg-sky-600 hover:bg-sky-700">
                <Download className="h-3 w-3" />Paper
              </Button>
            </a>
            {paper.mark_scheme_url && (
              <a href={paper.mark_scheme_url} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                  <Download className="h-3 w-3" />MS
                </Button>
              </a>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
