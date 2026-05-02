import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import { Video, Plus, Pencil, Trash2, Search, ExternalLink, Copy, Check, Eye, Lock, Users, Unlock } from "lucide-react";
import { format } from "date-fns";

type Recording = {
  id: number;
  title: string;
  description: string | null;
  url: string;
  passcode: string | null;
  platform: string;
  accessType: string;
  accessUntil: string | null;
  isPublished: boolean;
  viewCount: number;
  duration: string | null;
  recordedAt: string | null;
  createdAt: string;
  subjectName: string | null;
  subjectId: number | null;
};

type Subject = { id: number; name: string };

const PLATFORM_STYLE: Record<string, { badge: string; label: string }> = {
  zoom: { badge: "bg-blue-100 text-blue-700 border-blue-200", label: "Zoom" },
  meet: { badge: "bg-green-100 text-green-700 border-green-200", label: "Google Meet" },
  teams: { badge: "bg-indigo-100 text-indigo-700 border-indigo-200", label: "MS Teams" },
  other: { badge: "bg-gray-100 text-gray-600 border-gray-200", label: "Other" },
};

const ACCESS_STYLE: Record<string, { badge: string; icon: React.ElementType; label: string }> = {
  free: { badge: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: Unlock, label: "Free Access" },
  students_only: { badge: "bg-amber-100 text-amber-700 border-amber-200", icon: Users, label: "Students Only" },
  paid: { badge: "bg-purple-100 text-purple-700 border-purple-200", icon: Lock, label: "Paid" },
};

function RecordingFormDialog({ mode, initial, subjects, onSave, trigger }: {
  mode: "create" | "edit";
  initial?: Recording;
  subjects: Subject[];
  onSave: (data: any) => Promise<void>;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    url: initial?.url ?? "",
    passcode: initial?.passcode ?? "",
    platform: initial?.platform ?? "zoom",
    accessType: initial?.accessType ?? "free",
    subjectId: initial?.subjectId?.toString() ?? "",
    duration: initial?.duration ?? "",
    isPublished: initial?.isPublished ?? true,
    recordedAt: initial?.recordedAt ? initial.recordedAt.split("T")[0] : "",
  });

  const handleOpen = (v: boolean) => {
    setOpen(v);
    if (v && initial) setForm({ title: initial.title, description: initial.description ?? "", url: initial.url, passcode: initial.passcode ?? "", platform: initial.platform, accessType: initial.accessType, subjectId: initial.subjectId?.toString() ?? "", duration: initial.duration ?? "", isPublished: initial.isPublished, recordedAt: initial.recordedAt ? initial.recordedAt.split("T")[0] : "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ ...form, subjectId: form.subjectId || null });
      setOpen(false);
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{mode === "create" ? "Add Recording" : "Edit Recording"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input placeholder="e.g. Lesson 12 — Quadratic Equations" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label>Recording URL</Label>
            <Input placeholder="https://zoom.us/rec/..." value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Platform</Label>
              <Select value={form.platform} onValueChange={v => setForm({ ...form, platform: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="zoom">Zoom</SelectItem>
                  <SelectItem value="meet">Google Meet</SelectItem>
                  <SelectItem value="teams">MS Teams</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Access</Label>
              <Select value={form.accessType} onValueChange={v => setForm({ ...form, accessType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="students_only">Students Only</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Passcode</Label>
              <Input placeholder="Optional passcode" value={form.passcode} onChange={e => setForm({ ...form, passcode: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Duration</Label>
              <Input placeholder="e.g. 1h 30m" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Select value={form.subjectId} onValueChange={v => setForm({ ...form, subjectId: v })}>
                <SelectTrigger><SelectValue placeholder="No subject" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No subject</SelectItem>
                  {subjects.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Recorded At</Label>
              <Input type="date" value={form.recordedAt} onChange={e => setForm({ ...form, recordedAt: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={2} placeholder="What was covered in this session..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex items-center justify-between py-1">
            <div>
              <Label className="text-sm">Published</Label>
              <p className="text-xs text-muted-foreground">Visible to students when active</p>
            </div>
            <Switch checked={form.isPublished} onCheckedChange={v => setForm({ ...form, isPublished: v })} />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>{saving ? "Saving..." : mode === "create" ? "Add Recording" : "Save Changes"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Recordings() {
  const { toast } = useToast();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [recRes, subRes] = await Promise.all([
        fetch("/api/recordings", { credentials: "include" }),
        fetch("/api/subjects", { credentials: "include" }),
      ]);
      if (recRes.ok) setRecordings(await recRes.json());
      if (subRes.ok) setSubjects(await subRes.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (data: any) => {
    const res = await fetch("/api/recordings", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || "Failed"); }
    toast({ title: "Recording added" });
    load();
  };

  const handleEdit = async (id: number, data: any) => {
    const res = await fetch(`/api/recordings/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || "Failed"); }
    toast({ title: "Recording updated" });
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this recording?")) return;
    const res = await fetch(`/api/recordings/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) { toast({ title: "Error", variant: "destructive" }); return; }
    toast({ title: "Recording deleted" });
    load();
  };

  const handleCopyLink = async (rec: Recording) => {
    const text = rec.passcode ? `${rec.url}\nPasscode: ${rec.passcode}` : rec.url;
    await navigator.clipboard.writeText(text);
    setCopiedId(rec.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Link copied!" });
  };

  const filtered = recordings.filter(r => {
    const matchSearch = !search || r.title.toLowerCase().includes(search.toLowerCase()) || (r.subjectName?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchPlatform = platformFilter === "all" || r.platform === platformFilter;
    return matchSearch && matchPlatform;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Video className="h-7 w-7 text-primary" />Recordings
          </h1>
          <p className="text-muted-foreground mt-1">Manage session recording links and access control.</p>
        </div>
        <RecordingFormDialog mode="create" subjects={subjects} onSave={handleCreate}
          trigger={<Button className="gap-2"><Plus className="h-4 w-4" />Add Recording</Button>} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Recordings", value: recordings.length, color: "text-primary", bg: "bg-primary/5" },
          { label: "Published", value: recordings.filter(r => r.isPublished).length, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Free Access", value: recordings.filter(r => r.accessType === "free").length, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Total Views", value: recordings.reduce((a, r) => a + r.viewCount, 0), color: "text-purple-600", bg: "bg-purple-50" },
        ].map(s => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <CardTitle className="text-base flex items-center gap-2 flex-1">
              <Video className="h-4 w-4 text-primary" />All Recordings
            </CardTitle>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-52">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Search..." className="pl-8 h-8 text-sm bg-muted/50 border-none" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger className="w-32 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  <SelectItem value="zoom">Zoom</SelectItem>
                  <SelectItem value="meet">Meet</SelectItem>
                  <SelectItem value="teams">Teams</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading recordings...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Video className="h-10 w-10 text-muted-foreground opacity-20 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">{search ? "No matching recordings." : "No recordings yet. Add your first recording above."}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Title</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Access</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {filtered.map((rec, i) => {
                      const plat = PLATFORM_STYLE[rec.platform] ?? PLATFORM_STYLE.other;
                      const acc = ACCESS_STYLE[rec.accessType] ?? ACCESS_STYLE.free;
                      const AccessIcon = acc.icon;
                      return (
                        <motion.tr key={rec.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                          className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                          <TableCell>
                            <p className="font-medium text-sm">{rec.title}</p>
                            {rec.duration && <p className="text-xs text-muted-foreground">{rec.duration}</p>}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{rec.subjectName ?? "—"}</TableCell>
                          <TableCell>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${plat.badge}`}>{plat.label}</span>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border ${acc.badge}`}>
                              <AccessIcon className="h-3 w-3" />{acc.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {rec.recordedAt ? format(new Date(rec.recordedAt), "dd MMM yyyy") : format(new Date(rec.createdAt), "dd MMM yyyy")}
                          </TableCell>
                          <TableCell>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${rec.isPublished ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                              {rec.isPublished ? "Published" : "Hidden"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => window.open(rec.url, "_blank")} title="Open link">
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => handleCopyLink(rec)} title="Copy link">
                                {copiedId === rec.id ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                              </Button>
                              <RecordingFormDialog mode="edit" initial={rec} subjects={subjects} onSave={(data) => handleEdit(rec.id, data)}
                                trigger={<Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary"><Pencil className="h-3 w-3" /></Button>} />
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(rec.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
