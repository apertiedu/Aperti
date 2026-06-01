import { useState } from "react";
import { motion } from "framer-motion";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Pencil, Trash2, Filter } from "lucide-react";

const API = "/api";
const token = () => localStorage.getItem("aperti_token");

async function fetchJSON(url: string, options?: RequestInit) {
  const res = await fetch(`${API}${url}`, {
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(options?.headers || {}) },
    ...options,
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

interface Question {
  id: number;
  questionText: string;
  topic: string | null;
  subtopic: string | null;
  difficulty: string;
  maxMarks: string;
  tags: string | null;
  timesUsed: number;
}

export default function QueryVault() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [search, setSearch] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("all");

  const { data: questions, isLoading } = useQuery<Question[]>({
    queryKey: ["question-bank", search, difficultyFilter],
    queryFn: () => fetchJSON(`/question-bank?search=${search}&difficulty=${difficultyFilter === "all" ? "" : difficultyFilter}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`${API}/question-bank/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token()}` } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["question-bank"] }),
  });

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">QueryVault<span className="text-primary"></span></h1>
          <p className="text-muted-foreground">Your private question bank.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingQuestion(null)}><Plus className="h-4 w-4 mr-2" />Add Question</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>{editingQuestion ? "Edit Question" : "New Question"}</DialogTitle></DialogHeader>
            <QuestionForm
              question={editingQuestion}
              onClose={() => { setDialogOpen(false); setEditingQuestion(null); }}
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ["question-bank"] })}
            />
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Search & Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search questions..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Difficulties</SelectItem>
            <SelectItem value="easy">Easy</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="hard">Hard</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Questions List */}
      {isLoading ? (
        <div className="space-y-3">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-20 w-full rounded-xl"/>)}</div>
      ) : questions?.length === 0 ? (
        <Card className="card-hover"><CardContent className="p-8 text-center text-muted-foreground">No questions yet.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {questions?.map((q) => (
            <motion.div key={q.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="card-hover">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium line-clamp-2">{q.questionText}</p>
                      <div className="flex gap-2 mt-2">
                        {q.topic && <Badge variant="secondary">{q.topic}</Badge>}
                        <Badge variant="outline">{q.difficulty}</Badge>
                        <Badge variant="outline">{q.maxMarks} marks</Badge>
                        <span className="text-xs text-muted-foreground">Used {q.timesUsed}x</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => { setEditingQuestion(q); setDialogOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(q.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionForm({ question, onClose, onRefresh }: { question: Question | null; onClose: () => void; onRefresh: () => void }) {
  const [form, setForm] = useState({
    questionText: question?.questionText ?? "",
    topic: question?.topic ?? "",
    subtopic: question?.subtopic ?? "",
    difficulty: question?.difficulty ?? "medium",
    maxMarks: question?.maxMarks ?? "1",
    modelAnswer: "",
    tags: question?.tags ?? "",
  });

  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (data: any) =>
      fetch(`${API}/question-bank${question ? `/${question.id}` : ""}`, {
        method: question ? "PUT" : "POST",
        headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["question-bank"] }); onClose(); onRefresh(); },
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }} className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label>Question Text *</Label>
        <Textarea rows={4} required value={form.questionText} onChange={e => setForm({...form, questionText: e.target.value})} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Topic</Label><Input value={form.topic} onChange={e => setForm({...form, topic: e.target.value})} /></div>
        <div className="space-y-2"><Label>Subtopic</Label><Input value={form.subtopic} onChange={e => setForm({...form, subtopic: e.target.value})} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Difficulty</Label>
          <Select value={form.difficulty} onValueChange={v => setForm({...form, difficulty: v})}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>Max Marks</Label><Input type="number" value={form.maxMarks} onChange={e => setForm({...form, maxMarks: e.target.value})} /></div>
      </div>
      <div className="space-y-2"><Label>Tags (comma separated)</Label><Input value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} /></div>
      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        {mutation.isPending ? "Saving…" : question ? "Update" : "Create"}
      </Button>
    </form>
  );
}
