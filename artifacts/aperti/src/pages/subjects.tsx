import { apiFetch } from "@/lib/api";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookOpen, Plus, Pencil, Trash2 } from "lucide-react";
import { AppEmptyState } from "@/components/app-empty-state";
import { useAuth } from "@/context/auth";

type Subject = { id: number; name: string; teacherAccountId: number; createdAt: string };

export default function Subjects() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editSubject, setEditSubject] = useState<Subject | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/subjects", { credentials: "include" });
      if (res.ok) setSubjects(await res.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch("/api/subjects", {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message); }
      toast({ title: "Subject added" });
      setIsAddOpen(false);
      setName("");
      load();
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSubject) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/subjects/${editSubject.id}`, {
        method: "PATCH", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Update failed");
      toast({ title: "Subject updated" });
      setEditSubject(null);
      setName("");
      load();
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this subject? This may affect exams linked to it.")) return;
    await apiFetch(`/api/subjects/${id}`, { method: "DELETE" });
    toast({ title: "Subject deleted" });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-blue-600" />
            Subjects
          </h1>
          <p className="text-muted-foreground mt-1">Manage the subjects you teach.</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={v => { setIsAddOpen(v); setName(""); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" />Add Subject</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Subject</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Subject Name</Label>
                <Input placeholder="e.g. Physics, Mathematics, Chemistry" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={saving || !name.trim()}>{saving ? "Adding..." : "Add Subject"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editSubject} onOpenChange={v => { if (!v) { setEditSubject(null); setName(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Subject</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Subject Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">{[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-muted/40 rounded-lg animate-pulse" />)}</div>
          ) : subjects.length === 0 ? (
            <div className="border-2 border-dashed border-border m-2 rounded-xl">
              <AppEmptyState type="courses" title="No subjects yet" description="Add your first subject to start organising your curriculum." size="md" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Subject Name</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjects.map((subject, i) => (
                  <TableRow key={subject.id}>
                    <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                    <TableCell className="font-medium">{subject.name}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => { setEditSubject(subject); setName(subject.name); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(subject.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
