import { apiFetch } from "@/lib/api";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FolderOpen, Plus, Pencil, Trash2, Link2, FileText, Video, Mic, BookOpen, Eye, EyeOff } from "lucide-react";

type Subject = { id: number; name: string };
type Resource = { id: number; title: string; description: string | null; type: string; url: string | null; content: string | null; topic: string | null; tags: string | null; subjectId: number | null; subjectName: string | null; isStudentVisible: boolean; viewCount: number; createdAt: string };

const TYPE_ICONS: Record<string, typeof Link2> = { link: Link2, note: FileText, video: Video, recording: Mic, pdf: BookOpen };
const TYPE_COLORS: Record<string, string> = { link: "text-blue-600 bg-blue-50", note: "text-emerald-600 bg-emerald-50", video: "text-purple-600 bg-purple-50", recording: "text-rose-600 bg-rose-50", pdf: "text-amber-600 bg-amber-50" };

function ResourceFormDialog({ mode, initial, subjects, onSave, trigger }: { mode: "create" | "edit"; initial?: Partial<Resource>; subjects: Subject[]; onSave: (d: any) => Promise<void>; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: initial?.title ?? "", description: initial?.description ?? "", type: initial?.type ?? "link", url: initial?.url ?? "", content: initial?.content ?? "", topic: initial?.topic ?? "", tags: initial?.tags ?? "", subjectId: initial?.subjectId?.toString() ?? "", isStudentVisible: initial?.isStudentVisible ?? true });
  const [saving, setSaving] = useState(false);
  const handleOpen = (v: boolean) => { setOpen(v); if (v && initial) setForm({ title: initial.title ?? "", description: initial.description ?? "", type: initial.type ?? "link", url: initial.url ?? "", content: initial.content ?? "", topic: initial.topic ?? "", tags: initial.tags ?? "", subjectId: initial.subjectId?.toString() ?? "", isStudentVisible: initial.isStudentVisible ?? true }); };
  const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); setSaving(true); try { await onSave({ ...form, subjectId: form.subjectId || null }); setOpen(false); } finally { setSaving(false); } };
  const needsUrl = ["link", "video", "recording"].includes(form.type);
  const needsContent = form.type === "note";
  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{mode === "create" ? "Add Resource" : "Edit Resource"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5"><Label>Title <span className="text-red-500">*</span></Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Type</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="link">Link</SelectItem><SelectItem value="note">Note</SelectItem><SelectItem value="video">Video</SelectItem><SelectItem value="recording">Recording</SelectItem><SelectItem value="pdf">PDF</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Subject</Label>
              <Select value={form.subjectId || "none"} onValueChange={v => setForm({ ...form, subjectId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent><SelectItem value="none">No subject</SelectItem>{subjects.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          {needsUrl && <div className="space-y-1.5"><Label>URL <span className="text-red-500">*</span></Label><Input type="url" placeholder="https://..." value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} required={needsUrl} /></div>}
          {needsContent && <div className="space-y-1.5"><Label>Content</Label><Textarea rows={4} placeholder="Write your note..." value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} /></div>}
          <div className="space-y-1.5"><Label>Description</Label><Textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Topic</Label><Input placeholder="e.g. Electricity" value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Tags</Label><Input placeholder="e.g. revision, IGCSE" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} /></div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.isStudentVisible} onChange={e => setForm({ ...form, isStudentVisible: e.target.checked })} className="rounded" /><span className="text-sm">Visible to students</span></label>
          <Button type="submit" className="w-full" disabled={saving}>{saving ? "Saving..." : mode === "create" ? "Add Resource" : "Save Changes"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ResourcesPage() {
  const { toast } = useToast();
  const [resources, setResources] = useState<Resource[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");

  const load = async () => { setLoading(true); const [r, s] = await Promise.all([apiFetch(`/api/resources${filterType ? `?type=${filterType}` : ""}`, { credentials: "include" }), apiFetch("/api/subjects", { credentials: "include" })]); if (r.ok) setResources(await r.json()); if (s.ok) setSubjects(await s.json()); setLoading(false); };
  useEffect(() => { load(); }, [filterType]);

  const handleCreate = async (d: any) => { const r = await apiFetch("/api/resources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }); if (!r.ok) throw new Error("Failed"); toast({ title: "Resource added" }); load(); };
  const handleEdit = async (id: number, d: any) => { await apiFetch(`/api/resources/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }); toast({ title: "Updated" }); load(); };
  const handleDelete = async (id: number) => { if (!confirm("Delete?")) return; await apiFetch(`/api/resources/${id}`, { method: "DELETE" }); toast({ title: "Deleted" }); load(); };
  const toggleVisibility = async (r: Resource) => { await apiFetch(`/api/resources/${r.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isStudentVisible: !r.isStudentVisible }) }); load(); };

  const stats = { total: resources.length, visible: resources.filter(r => r.isStudentVisible).length, views: resources.reduce((s, r) => s + r.viewCount, 0) };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><FolderOpen className="h-7 w-7 text-violet-600" />Resource Hub</h1><p className="text-muted-foreground mt-1">Share links, notes, videos, and recordings with your students.</p></div>
        <ResourceFormDialog mode="create" subjects={subjects} onSave={handleCreate} trigger={<Button className="gap-2"><Plus className="h-4 w-4" />Add Resource</Button>} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[{ l: "Total Resources", v: stats.total }, { l: "Student-Visible", v: stats.visible }, { l: "Total Views", v: stats.views }].map(s => <Card key={s.l} className="border-border/50"><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">{s.l}</p><p className="text-2xl font-bold mt-1">{s.v}</p></CardContent></Card>)}
      </div>

      <div className="flex gap-2 flex-wrap">
        {[{ v: "", l: "All" }, { v: "link", l: "Links" }, { v: "note", l: "Notes" }, { v: "video", l: "Videos" }, { v: "recording", l: "Recordings" }, { v: "pdf", l: "PDFs" }].map(t => (
          <button key={t.v} onClick={() => setFilterType(t.v)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterType === t.v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{t.l}</button>
        ))}
      </div>

      {loading ? <div className="text-center py-8 text-muted-foreground">Loading...</div> :
        resources.length === 0 ? <Card className="border-dashed"><CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-3"><FolderOpen className="h-10 w-10 opacity-20" /><p>No resources yet.</p></CardContent></Card> :
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {resources.map(r => {
            const Icon = TYPE_ICONS[r.type] || FolderOpen;
            const colorCls = TYPE_COLORS[r.type] || "text-gray-600 bg-gray-50";
            const [iconColor, iconBg] = colorCls.split(" ");
            return (
              <Card key={r.id} className="border-border/50 hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}><Icon className={`h-4 w-4 ${iconColor}`} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div><p className="font-semibold text-sm truncate">{r.title}</p><div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">{r.subjectName && <span className="text-primary font-medium">{r.subjectName}</span>}{r.topic && <span>{r.topic}</span>}<span>{r.viewCount} views</span></div></div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => toggleVisibility(r)} className={`p-1 rounded hover:bg-muted transition-colors ${r.isStudentVisible ? "text-emerald-600" : "text-muted-foreground"}`} title={r.isStudentVisible ? "Visible to students" : "Hidden from students"}>{r.isStudentVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}</button>
                          <ResourceFormDialog mode="edit" initial={r} subjects={subjects} onSave={(d) => handleEdit(r.id, d)} trigger={<button className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors"><Pencil className="h-3.5 w-3.5" /></button>} />
                          <button onClick={() => handleDelete(r.id)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                      {r.description && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1">{r.description}</p>}
                      {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-1.5 block truncate">{r.url}</a>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      }
    </div>
  );
}
