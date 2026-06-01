import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, BookOpen, Eye, CheckCircle, Clock, FileText, Users,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";
const token = () => localStorage.getItem("aperti_token");

async function fetchJSON(url: string, options?: RequestInit) {
  const res = await fetch(`${API}${url}`, {
    headers: { Authorization: `Bearer ${token()}`, ...(options?.headers || {}) },
    ...options,
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

interface Homework {
  id: number;
  title: string;
  subjectId: number | null;
  dueDate: string | null;
  totalMarks: string | null;
  isPublished: boolean;
  allowLate: boolean;
  createdAt: string;
  description?: string;
  instructions?: string;
}

export default function SubmitFlow() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHw, setEditingHw] = useState<Homework | null>(null);
  const [activeTab, setActiveTab] = useState("active");

  const { data: homeworkList, isLoading } = useQuery<Homework[]>({
    queryKey: ["homework", "teacher"],
    queryFn: () => fetchJSON("/homework/teacher"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`${API}/homework/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token()}` } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["homework", "teacher"] }),
  });

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">SubmitFlow<span className="text-primary">™</span></h1>
          <p className="text-muted-foreground">Homework with intelligence.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingHw(null)}><Plus className="h-4 w-4 mr-2" />Create Homework</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>{editingHw ? "Edit Homework" : "New Homework"}</DialogTitle></DialogHeader>
            <HomeworkForm
              homework={editingHw}
              onClose={() => { setDialogOpen(false); setEditingHw(null); }}
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ["homework", "teacher"] })}
            />
          </DialogContent>
        </Dialog>
      </motion.div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="grid gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : homeworkList?.length === 0 ? (
        <Card className="card-hover">
          <CardContent className="p-8 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-2" />
            No homework yet. Create your first assignment.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {homeworkList?.map((hw) => (
            <HomeworkCard key={hw.id} homework={hw} onDelete={() => deleteMutation.mutate(hw.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function HomeworkCard({ homework, onDelete }: { homework: Homework; onDelete: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="card-hover">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">{homework.title}</p>
              <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                {homework.dueDate && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{homework.dueDate}</span>}
                {homework.totalMarks && <span>{homework.totalMarks} marks</span>}
                <Badge variant="secondary">{homework.isPublished ? "Published" : "Draft"}</Badge>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={`/submit-flow/${homework.id}/submissions`}><Eye className="h-4 w-4 mr-1" /> View Submissions</a>
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete}><TrashIcon className="h-4 w-4 text-destructive" /></Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function TrashIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function HomeworkForm({ homework, onClose, onRefresh }: { homework: Homework | null; onClose: () => void; onRefresh: () => void }) {
  const [form, setForm] = useState({
    title: homework?.title ?? "",
    description: homework?.description ?? "",
    instructions: homework?.instructions ?? "",
    dueDate: homework?.dueDate ?? "",
    totalMarks: homework?.totalMarks ?? "",
    allowLate: homework?.allowLate ?? false,
    subjectId: homework?.subjectId ?? null,
  });
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (data: any) =>
      fetch(`${API}/homework${homework ? `/${homework.id}` : ""}`, {
        method: homework ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homework", "teacher"] });
      onClose();
      onRefresh();
    },
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }} className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label>Title *</Label>
        <Input required value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Due Date</Label>
          <Input type="date" value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>Total Marks</Label>
          <Input type="number" value={form.totalMarks} onChange={e => setForm({...form, totalMarks: e.target.value})} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Instructions</Label>
        <Textarea rows={3} value={form.instructions} onChange={e => setForm({...form, instructions: e.target.value})} />
      </div>
      <div className="flex items-center gap-3">
        <Switch checked={form.allowLate} onCheckedChange={(v) => setForm({...form, allowLate: v})} />
        <Label>Allow late submissions</Label>
      </div>
      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        {mutation.isPending ? "Saving…" : homework ? "Update" : "Create"}
      </Button>
    </form>
  );
}
