import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, Plus, Trash2, Pencil, Download, Search, Filter,
  FileText, ExternalLink, Upload, Calendar, Tag, ChevronDown, X
} from "lucide-react";

type Paper = {
  id: number; title: string; subject: string; year: number | null;
  session: string | null; variant: string | null; paper_number: string | null;
  file_url: string; mark_scheme_url: string | null; examiner_report_url: string | null;
  uploaded_by_name: string | null; is_public: boolean; created_at: string;
};

const SESSIONS = ["May/June", "Oct/Nov", "Feb/Mar", "Jan", "Other"];
const VARIANTS = ["1", "2", "3", "4"];

function PaperForm({ initial, onSave, onClose }: {
  initial?: Partial<Paper>; onSave: (data: any) => Promise<void>; onClose: () => void;
}) {
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    subject: initial?.subject ?? "",
    year: initial?.year?.toString() ?? "",
    session: initial?.session ?? "",
    variant: initial?.variant ?? "",
    paperNumber: initial?.paper_number ?? "",
    fileUrl: initial?.file_url ?? "",
    markSchemeUrl: initial?.mark_scheme_url ?? "",
    examinerReportUrl: initial?.examiner_report_url ?? "",
    isPublic: initial?.is_public !== false,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try { await onSave({ ...form, year: form.year ? parseInt(form.year, 10) : null }); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label>Paper Title *</Label>
          <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. Physics Paper 1 May/June 2023" required />
        </div>
        <div className="space-y-1.5">
          <Label>Subject *</Label>
          <Input value={form.subject} onChange={e => set("subject", e.target.value)} placeholder="e.g. Physics, Chemistry" required />
        </div>
        <div className="space-y-1.5">
          <Label>Year</Label>
          <Input type="number" value={form.year} onChange={e => set("year", e.target.value)} placeholder="e.g. 2023" min={1990} max={2099} />
        </div>
        <div className="space-y-1.5">
          <Label>Session</Label>
          <Select value={form.session} onValueChange={v => set("session", v)}>
            <SelectTrigger><SelectValue placeholder="Select session" /></SelectTrigger>
            <SelectContent>{SESSIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Variant</Label>
          <Select value={form.variant} onValueChange={v => set("variant", v)}>
            <SelectTrigger><SelectValue placeholder="Variant" /></SelectTrigger>
            <SelectContent>{VARIANTS.map(v => <SelectItem key={v} value={v}>Variant {v}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Paper Number</Label>
          <Input value={form.paperNumber} onChange={e => set("paperNumber", e.target.value)} placeholder="e.g. Paper 1, Paper 2" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Question Paper URL *</Label>
          <Input value={form.fileUrl} onChange={e => set("fileUrl", e.target.value)} placeholder="https://..." required />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Mark Scheme URL</Label>
          <Input value={form.markSchemeUrl} onChange={e => set("markSchemeUrl", e.target.value)} placeholder="https://..." />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Examiner Report URL</Label>
          <Input value={form.examinerReportUrl} onChange={e => set("examinerReportUrl", e.target.value)} placeholder="https://..." />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={saving} className="gap-2">
          <Upload className="h-4 w-4" />{saving ? "Saving..." : initial?.id ? "Save Changes" : "Upload Paper"}
        </Button>
      </div>
    </form>
  );
}

const DIFF_COLORS: Record<string, string> = {
  "May/June": "bg-amber-100 text-amber-700 border-amber-200",
  "Oct/Nov": "bg-blue-100 text-blue-700 border-blue-200",
  "Feb/Mar": "bg-green-100 text-green-700 border-green-200",
};

export default function PastPapersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";

  const [papers, setPapers] = useState<Paper[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editPaper, setEditPaper] = useState<Paper | null>(null);

  const [filterSubject, setFilterSubject] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterSession, setFilterSession] = useState("");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
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
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filterSubject, filterYear, filterSession, search]);

  const handleCreate = async (data: any) => {
    const res = await fetch("/api/past-papers", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    if (!res.ok) { const e = await res.json(); toast({ title: "Error", description: e.message, variant: "destructive" }); return; }
    toast({ title: "Paper uploaded" }); load();
  };

  const handleEdit = async (data: any) => {
    if (!editPaper) return;
    const res = await fetch(`/api/past-papers/${editPaper.id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    if (!res.ok) { const e = await res.json(); toast({ title: "Error", description: e.message, variant: "destructive" }); return; }
    toast({ title: "Paper updated" }); setEditPaper(null); load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this paper?")) return;
    const res = await fetch(`/api/past-papers/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) { toast({ title: "Error", variant: "destructive" }); return; }
    toast({ title: "Paper deleted" }); load();
  };

  const years = [...new Set(papers.map(p => p.year).filter(Boolean))].sort((a, b) => (b as number) - (a as number));
  const clearFilters = () => { setFilterSubject(""); setFilterYear(""); setFilterSession(""); setSearch(""); };
  const hasFilters = filterSubject || filterYear || filterSession || search;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-sm">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Past Paper Library</h1>
            <p className="text-xs text-muted-foreground">{papers.length} paper{papers.length !== 1 ? "s" : ""} available</p>
          </div>
        </div>
        {isAdmin && (
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 shadow-sm">
                <Plus className="h-4 w-4" />Upload Paper
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Upload Past Paper</DialogTitle></DialogHeader>
              <PaperForm onSave={handleCreate} onClose={() => setAddOpen(false)} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <Card className="border border-border/50">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[180px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search papers..." className="pl-9" />
            </div>
            <Select value={filterSubject} onValueChange={setFilterSubject}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Subject" /></SelectTrigger>
              <SelectContent>
                {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-[120px]"><SelectValue placeholder="Year" /></SelectTrigger>
              <SelectContent>
                {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterSession} onValueChange={setFilterSession}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Session" /></SelectTrigger>
              <SelectContent>
                {SESSIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground h-10">
                <X className="h-3.5 w-3.5" />Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Subject filter chips */}
      {subjects.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilterSubject("")}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${!filterSubject ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:border-primary/50"}`}>
            All Subjects
          </button>
          {subjects.map(s => (
            <button key={s} onClick={() => setFilterSubject(filterSubject === s ? "" : s)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${filterSubject === s ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:border-primary/50"}`}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Papers grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-48 rounded-2xl skeleton" />)}
        </div>
      ) : papers.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
            <BookOpen className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="text-foreground font-semibold mb-1">No past papers found</p>
          <p className="text-sm text-muted-foreground mb-4">
            {hasFilters ? "Try adjusting your filters" : isAdmin ? "Upload the first past paper to get started" : "No papers have been uploaded yet"}
          </p>
          {isAdmin && !hasFilters && (
            <Button onClick={() => setAddOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />Upload First Paper
            </Button>
          )}
        </div>
      ) : (
        <motion.div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          initial="hidden" animate="show"
          variants={{ show: { transition: { staggerChildren: 0.04 } } }}>
          {papers.map(paper => (
            <motion.div key={paper.id}
              variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
              <Card className="card-hover border border-border/50 overflow-hidden group h-full flex flex-col">
                <div className="h-1.5 bg-gradient-to-r from-sky-400 to-blue-600" />
                <CardContent className="p-4 flex flex-col flex-1 gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm text-foreground leading-snug line-clamp-2">{paper.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{paper.subject}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center flex-shrink-0 group-hover:bg-sky-200 transition-colors">
                      <FileText className="h-5 w-5 text-sky-600" />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {paper.year && <Badge variant="secondary" className="text-xs gap-1"><Calendar className="h-3 w-3" />{paper.year}</Badge>}
                    {paper.session && (
                      <Badge className={`text-xs border ${DIFF_COLORS[paper.session] || "bg-purple-100 text-purple-700 border-purple-200"}`}>
                        {paper.session}
                      </Badge>
                    )}
                    {paper.variant && <Badge variant="outline" className="text-xs">Variant {paper.variant}</Badge>}
                    {paper.paper_number && <Badge variant="outline" className="text-xs">{paper.paper_number}</Badge>}
                  </div>

                  <div className="flex-1" />

                  <div className="flex flex-wrap gap-2 pt-1 border-t border-border/30">
                    <a href={paper.file_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs font-medium text-sky-600 hover:text-sky-700 transition-colors">
                      <Download className="h-3.5 w-3.5" />Question Paper
                    </a>
                    {paper.mark_scheme_url && (
                      <a href={paper.mark_scheme_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors">
                        <Download className="h-3.5 w-3.5" />Mark Scheme
                      </a>
                    )}
                    {paper.examiner_report_url && (
                      <a href={paper.examiner_report_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-700 transition-colors">
                        <ExternalLink className="h-3.5 w-3.5" />Examiner Report
                      </a>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="flex gap-2 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 flex-1"
                        onClick={() => setEditPaper(paper)}>
                        <Pencil className="h-3 w-3" />Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 flex-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(paper.id)}>
                        <Trash2 className="h-3 w-3" />Delete
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editPaper} onOpenChange={v => !v && setEditPaper(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Paper</DialogTitle></DialogHeader>
          {editPaper && <PaperForm initial={editPaper} onSave={handleEdit} onClose={() => setEditPaper(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
