import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Archive, Search, Plus, ExternalLink, FileText, BookOpen,
  BarChart2, Clock, Filter,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ArchiveItem {
  id: number;
  assessment_id: number;
  title: string;
  type: string;
  total_marks: number;
  paper_file_url: string | null;
  mark_scheme_file_url: string | null;
  report_file_url: string | null;
  archived_at: string;
  assessment_created: string;
}

export default function ExamArchives() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveForm, setArchiveForm] = useState({
    assessment_id: "",
    paper_file_url: "",
    mark_scheme_file_url: "",
    report_file_url: "",
  });

  // Assessments for selector
  const { data: assessments } = useQuery({
    queryKey: ["assessments-for-archive"],
    queryFn: async () => {
      const res = await apiFetch("/api/assessments");
      return (await res.json()).assessments ?? [];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["archives", search, filterType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (filterType !== "all") params.set("type", filterType);
      const res = await apiFetch(`/api/archives?${params}`);
      return (await res.json()).archives as ArchiveItem[];
    },
  });

  const archiveMut = useMutation({
    mutationFn: async () => {
      const { assessment_id, ...rest } = archiveForm;
      const res = await apiFetch(`/api/assessments/${assessment_id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rest),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["archives"] });
      setShowArchiveModal(false);
      setArchiveForm({ assessment_id: "", paper_file_url: "", mark_scheme_file_url: "", report_file_url: "" });
      toast({ title: "Assessment archived" });
    },
    onError: () => toast({ title: "Failed to archive", variant: "destructive" }),
  });

  const archives = data ?? [];
  const typeOptions = [...new Set(archives.map(a => a.type))];

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {showArchiveModal && (
          <motion.div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) setShowArchiveModal(false); }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
              <h3 className="font-bold text-lg flex items-center gap-2"><Archive className="w-4 h-4 text-primary" />Archive Assessment</h3>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Assessment *</label>
                <select
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  value={archiveForm.assessment_id}
                  onChange={e => setArchiveForm(f => ({ ...f, assessment_id: e.target.value }))}
                >
                  <option value="">Select assessment…</option>
                  {(assessments ?? []).map((a: any) => (
                    <option key={a.id} value={a.id}>{a.title}</option>
                  ))}
                </select>
              </div>
              {[
                { key: "paper_file_url", label: "Paper File URL", placeholder: "https://…/paper.pdf" },
                { key: "mark_scheme_file_url", label: "Mark Scheme URL", placeholder: "https://…/markscheme.pdf" },
                { key: "report_file_url", label: "Examiner's Report URL", placeholder: "https://…/report.pdf" },
              ].map(field => (
                <div key={field.key}>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">{field.label}</label>
                  <Input
                    placeholder={field.placeholder}
                    value={(archiveForm as any)[field.key]}
                    onChange={e => setArchiveForm(f => ({ ...f, [field.key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowArchiveModal(false)}>Cancel</Button>
                <Button className="flex-1" onClick={() => archiveMut.mutate()} disabled={!archiveForm.assessment_id || archiveMut.isPending}>
                  {archiveMut.isPending ? "Archiving…" : "Archive"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Archive className="w-6 h-6 text-primary" /> Exam Archives
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Searchable repository of past papers, mark schemes, and reports.</p>
        </div>
        <Button className="gap-2" onClick={() => setShowArchiveModal(true)}>
          <Plus className="w-4 h-4" /> Archive Assessment
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Search archives…" className="pl-8 h-9 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="rounded-lg border border-border bg-background px-3 py-2 text-sm" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="all">All Types</option>
          {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-muted/40 rounded-xl animate-pulse" />)}</div>
      ) : archives.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-2xl">
          <Archive className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-medium text-muted-foreground">No archives yet</p>
          <p className="text-xs text-muted-foreground mt-1">Archive an assessment to store its paper, mark scheme, and report.</p>
          <Button variant="outline" className="mt-4 gap-2" onClick={() => setShowArchiveModal(true)}>
            <Plus className="w-4 h-4" /> Create First Archive
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {archives.map(a => (
            <motion.div key={a.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-xl p-4 space-y-3 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{a.title}</span>
                    <Badge variant="secondary" className="text-[10px]">{a.type}</Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                    <span>{a.total_marks} marks</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Archived {new Date(a.archived_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {a.paper_file_url && (
                  <a href={a.paper_file_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs hover:bg-muted transition-colors">
                    <FileText className="w-3 h-3" />Paper <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                  </a>
                )}
                {a.mark_scheme_file_url && (
                  <a href={a.mark_scheme_file_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs hover:bg-muted transition-colors">
                    <BookOpen className="w-3 h-3" />Mark Scheme <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                  </a>
                )}
                {a.report_file_url && (
                  <a href={a.report_file_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs hover:bg-muted transition-colors">
                    <BarChart2 className="w-3 h-3" />Examiner's Report <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                  </a>
                )}
                {!a.paper_file_url && !a.mark_scheme_file_url && !a.report_file_url && (
                  <span className="text-xs text-muted-foreground">No files attached</span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
