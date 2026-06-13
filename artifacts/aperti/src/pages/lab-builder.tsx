import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { FlaskConical, Plus, Eye, Pencil, Play, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = "/api";
async function apiFetch(url: string) {
  const res = await fetch(`${API}${url}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const LAB_TYPES = [
  { value: "physics", label: "Physics", icon: "⚛️", description: "Force, motion, waves, circuits" },
  { value: "chemistry", label: "Chemistry", icon: "🧪", description: "Reactions, titrations, models" },
  { value: "biology", label: "Biology", icon: "🔬", description: "Cell, genetics, ecology" },
  { value: "math", label: "Mathematics", icon: "📐", description: "Graphing, geometry, stats" },
  { value: "custom", label: "Custom", icon: "⚙️", description: "Any topic, custom config" },
];

const SAMPLE_LABS = [
  { id: 1, name: "Newton's Laws of Motion", subject: "Physics", type: "physics", difficulty: "intermediate", is_public: true, assigned_count: 14, description: "Interactive simulation demonstrating all three of Newton's laws with real-time force vectors." },
  { id: 2, name: "Acid-Base Titration", subject: "Chemistry", type: "chemistry", difficulty: "advanced", is_public: false, assigned_count: 7, description: "pH curve simulation with adjustable concentrations of acid and base solutions." },
  { id: 3, name: "DNA Replication", subject: "Biology", type: "biology", difficulty: "beginner", is_public: true, assigned_count: 22, description: "Step-by-step animation of DNA replication with enzyme labelling activity." },
  { id: 4, name: "Quadratic Functions Explorer", subject: "Mathematics", type: "math", difficulty: "intermediate", is_public: false, assigned_count: 11, description: "Dynamic graphing tool for exploring parabola transformations." },
];

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  intermediate: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  advanced: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
};

const EMPTY_FORM = {
  name: "", type: "physics", subject_id: "", description: "",
  difficulty: "intermediate", objectives: "", duration_min: "45",
  is_public: false, allow_student_modify: false,
  config: '{\n  "variables": [],\n  "constraints": {}\n}',
};

export default function LabBuilder() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLab, setEditingLab] = useState<any | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [previewLab, setPreviewLab] = useState<any | null>(null);
  const [tab, setTab] = useState("my-labs");
  const [jsonError, setJsonError] = useState("");

  const { data: subjects } = useQuery<any[]>({
    queryKey: ["subjects"],
    queryFn: () => apiFetch("/subjects"),
  });

  const subjectList: any[] = Array.isArray(subjects) ? subjects : [];

  function openCreate(labType = "physics") {
    setEditingLab(null);
    setForm({ ...EMPTY_FORM, type: labType });
    setJsonError("");
    setDialogOpen(true);
  }

  function openEdit(lab: any) {
    setEditingLab(lab);
    setForm({
      name: lab.name ?? "", type: lab.type ?? "physics",
      subject_id: lab.subject_id ? String(lab.subject_id) : "",
      description: lab.description ?? "", difficulty: lab.difficulty ?? "intermediate",
      objectives: lab.objectives ?? "", duration_min: String(lab.duration_min ?? 45),
      is_public: lab.is_public ?? false, allow_student_modify: false,
      config: '{\n  "variables": [],\n  "constraints": {}\n}',
    });
    setJsonError("");
    setDialogOpen(true);
  }

  function validateJson(val: string) {
    try { JSON.parse(val); setJsonError(""); return true; }
    catch (e: any) { setJsonError(e.message); return false; }
  }

  function handleSave() {
    if (!validateJson(form.config)) return;
    toast({ title: editingLab ? "Lab updated" : "Lab created", description: form.name });
    setDialogOpen(false);
  }

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <FlaskConical className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-3xl font-bold">LabBuilder™</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-12">Configure and assign interactive simulations to your students.</p>
        </div>
        <Button onClick={() => openCreate()} className="gap-2">
          <Plus className="h-4 w-4" /> New Lab
        </Button>
      </motion.div>

      {/* Lab Type Quick-Start */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {LAB_TYPES.map(lt => (
          <Card key={lt.value} className="card-hover cursor-pointer" onClick={() => openCreate(lt.value)}>
            <CardContent className="p-3 text-center">
              <div className="text-2xl mb-1">{lt.icon}</div>
              <p className="text-xs font-semibold">{lt.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{lt.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="my-labs">My Labs ({SAMPLE_LABS.length})</TabsTrigger>
          <TabsTrigger value="public">Public Library</TabsTrigger>
        </TabsList>

        <TabsContent value="my-labs">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {SAMPLE_LABS.map(lab => (
              <motion.div key={lab.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="card-hover">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-sm truncate">{lab.name}</CardTitle>
                        <CardDescription className="text-xs">{lab.subject}</CardDescription>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {lab.is_public && <Globe className="h-3.5 w-3.5 text-muted-foreground" />}
                        <Badge className={`text-[10px] capitalize border-0 ${DIFFICULTY_COLORS[lab.difficulty]}`}>
                          {lab.difficulty}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{lab.description}</p>
                    <p className="text-xs text-primary mb-3">{lab.assigned_count} students assigned</p>
                    <div className="flex items-center gap-1.5">
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1 flex-1" onClick={() => openEdit(lab)}>
                        <Pencil className="h-3 w-3" /> Edit
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1 flex-1" onClick={() => setPreviewLab(lab)}>
                        <Eye className="h-3 w-3" /> Preview
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="public">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {SAMPLE_LABS.filter(l => l.is_public).map(lab => (
              <Card key={lab.id} className="card-hover">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div><CardTitle className="text-sm">{lab.name}</CardTitle><CardDescription className="text-xs">{lab.subject}</CardDescription></div>
                    <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-3">{lab.description}</p>
                  <Button size="sm" className="w-full h-7 text-xs">Import to My Labs</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLab ? "Edit Lab" : "New Lab"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Lab Name</Label>
              <Input placeholder="e.g. Projectile Motion Simulator" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LAB_TYPES.map(lt => <SelectItem key={lt.value} value={lt.value}>{lt.icon} {lt.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Difficulty</Label>
                <Select value={form.difficulty} onValueChange={v => setForm(f => ({ ...f, difficulty: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Subject</Label>
                <Select value={form.subject_id} onValueChange={v => setForm(f => ({ ...f, subject_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>
                    {subjectList.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Duration (minutes)</Label>
                <Input type="number" min={5} max={180} value={form.duration_min} onChange={e => setForm(f => ({ ...f, duration_min: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={2} placeholder="What will students do in this lab?" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Learning Objectives</Label>
              <Textarea rows={2} placeholder="What will students learn? (one per line)" value={form.objectives} onChange={e => setForm(f => ({ ...f, objectives: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Lab Configuration (JSON)</Label>
                {jsonError && <span className="text-xs text-destructive">{jsonError}</span>}
              </div>
              <Textarea
                rows={5}
                className="font-mono text-xs"
                value={form.config}
                onChange={e => { setForm(f => ({ ...f, config: e.target.value })); validateJson(e.target.value); }}
              />
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={form.is_public} onCheckedChange={v => setForm(f => ({ ...f, is_public: v }))} />
                <Label className="text-sm">Public library</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.allow_student_modify} onCheckedChange={v => setForm(f => ({ ...f, allow_student_modify: v }))} />
                <Label className="text-sm">Allow student modifications</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name || !!jsonError}>
              {editingLab ? "Update Lab" : "Create Lab"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewLab} onOpenChange={() => setPreviewLab(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{previewLab?.name}</DialogTitle></DialogHeader>
          {previewLab && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{previewLab.description}</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="capitalize">{previewLab.type}</Badge>
                <Badge className={`capitalize border-0 ${DIFFICULTY_COLORS[previewLab.difficulty]}`}>{previewLab.difficulty}</Badge>
              </div>
              <div className="p-8 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 text-center">
                <FlaskConical className="h-12 w-12 mx-auto mb-3 text-primary opacity-60" />
                <p className="text-sm font-medium">Lab Preview</p>
                <p className="text-xs text-muted-foreground mt-1">Interactive lab player — Phase 3</p>
              </div>
              <Button className="w-full gap-2"><Play className="h-4 w-4" /> Assign to Students</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
