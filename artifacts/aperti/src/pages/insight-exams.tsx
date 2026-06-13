import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Clock, Eye, Trash2, FileText } from "lucide-react";
import { useQuery as useTanstackQuery } from "@tanstack/react-query";

const API = "/api";

async function fetchJSON(url: string, options?: RequestInit) {
  const res = await fetch(`${API}${url}`, {
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    ...options,
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

interface Exam {
  id: number;
  name: string;
  timeLimitMinutes: number | null;
  totalMarks: string | null;
  examDate: string | null;
  createdAt: string;
}

export default function InsightExams() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: exams, isLoading } = useQuery<Exam[]>({
    queryKey: ["exams"],
    queryFn: () => fetchJSON("/exams"),
  });

  const { data: questions } = useQuery({
    queryKey: ["question-bank"],
    queryFn: () => fetchJSON("/question-bank"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`${API}/exams/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["exams"] }),
  });

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Insight Exams<span className="text-primary"></span></h1>
          <p className="text-muted-foreground">Create assessments. Track performance.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Create Exam</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader><DialogTitle>New Exam</DialogTitle></DialogHeader>
            <ExamForm questions={questions || []} onClose={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </motion.div>

      {isLoading ? (
        <div className="grid gap-4">{Array.from({length:3}).map((_,i)=><Skeleton key={i} className="h-24 rounded-xl"/>)}</div>
      ) : exams?.length === 0 ? (
        <Card className="card-hover"><CardContent className="p-8 text-center text-muted-foreground">No exams yet.</CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {exams?.map((exam) => (
            <Card key={exam.id} className="card-hover">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{exam.name}</p>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                      {exam.timeLimitMinutes && <span><Clock className="h-3 w-3 inline mr-1" />{exam.timeLimitMinutes} min</span>}
                      {exam.totalMarks && <span>{exam.totalMarks} marks</span>}
                      {exam.examDate && <span>{exam.examDate}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/exams/${exam.id}/submissions`}><Eye className="h-4 w-4 mr-1" /> Submissions</a>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(exam.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ExamForm({ questions, onClose }: { questions: any[]; onClose: () => void }) {
  const [name, setName] = useState("");
  const [timeLimit, setTimeLimit] = useState(60);
  const [totalMarks, setTotalMarks] = useState(50);
  const [selectedQuestions, setSelectedQuestions] = useState<number[]>([]);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: any) =>
      fetchJSON("/exams", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      onClose();
    },
  });

  const toggleQuestion = (id: number) => {
    setSelectedQuestions(prev => prev.includes(id) ? prev.filter(q => q !== id) : [...prev, id]);
  };

  const handleSubmit = () => {
    const selected = questions.filter(q => selectedQuestions.includes(q.id));
    mutation.mutate({
      name,
      timeLimitMinutes: timeLimit,
      totalMarks,
      questions: selected.map(q => ({
        questionText: q.questionText,
        topic: q.topic,
        maxMarks: q.maxMarks,
        questionType: q.questionType || "written",
      })),
    });
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="space-y-2"><Label>Exam Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Time Limit (minutes)</Label><Input type="number" value={timeLimit} onChange={e => setTimeLimit(Number(e.target.value))} /></div>
        <div className="space-y-2"><Label>Total Marks</Label><Input type="number" value={totalMarks} onChange={e => setTotalMarks(Number(e.target.value))} /></div>
      </div>
      <div className="space-y-2">
        <Label>Select Questions ({selectedQuestions.length} selected)</Label>
        <div className="max-h-60 overflow-y-auto space-y-2 border rounded-lg p-3">
          {questions.map((q: any) => (
            <div key={q.id} className={`flex items-center gap-2 p-2 rounded cursor-pointer ${selectedQuestions.includes(q.id) ? "bg-primary/10 border-primary" : "hover:bg-muted"}`} onClick={() => toggleQuestion(q.id)}>
              <div className="flex-1 text-sm">{q.questionText}</div>
              <Badge variant="secondary">{q.maxMarks} marks</Badge>
            </div>
          ))}
        </div>
      </div>
      <Button className="w-full" onClick={handleSubmit} disabled={mutation.isPending}>
        {mutation.isPending ? "Creating…" : "Create Exam"}
      </Button>
    </div>
  );
}
