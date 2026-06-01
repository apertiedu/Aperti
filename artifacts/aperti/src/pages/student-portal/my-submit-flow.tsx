import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Upload, CheckCircle, Clock, AlertCircle,
} from "lucide-react";

const API = "/api";
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
  description: string;
  dueDate: string | null;
  totalMarks: string | null;
}

interface Submission {
  id: number;
  content: string | null;
  status: string;
  marksAwarded: string | null;
  teacherFeedback: string | null;
}

export default function MySubmitFlow() {
  const { data: homeworkList, isLoading } = useQuery<Homework[]>({
    queryKey: ["homework", "student"],
    queryFn: () => fetchJSON("/homework/student"),
  });

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold">My Homework</h1>
        <p className="text-muted-foreground">Submit your work and track feedback.</p>
      </motion.div>

      {isLoading ? (
        <div className="grid gap-4">
          {[1,2].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      ) : homeworkList?.length === 0 ? (
        <Card className="card-hover">
          <CardContent className="p-8 text-center text-muted-foreground">
            No homework assigned yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {homeworkList?.map((hw) => (
            <StudentHomeworkCard key={hw.id} homework={hw} />
          ))}
        </div>
      )}
    </div>
  );
}

function StudentHomeworkCard({ homework }: { homework: Homework }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: submission, isLoading: subLoading } = useQuery<Submission | null>({
    queryKey: ["submission", homework.id],
    queryFn: () => fetchJSON(`/homework/${homework.id}/my-submission`).catch(() => null),
  });

  const submitMutation = useMutation({
    mutationFn: (content: string) =>
      fetch(`${API}/homework/${homework.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ content }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submission", homework.id] });
      setDialogOpen(false);
    },
  });

  const statusBadge = !submission ? (
    <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" /> Not submitted</Badge>
  ) : submission.status === "submitted" ? (
    <Badge><Clock className="h-3 w-3 mr-1" /> Submitted</Badge>
  ) : submission.status === "graded" ? (
    <Badge className="bg-primary text-primary-foreground"><CheckCircle className="h-3 w-3 mr-1" /> Graded</Badge>
  ) : (
    <Badge variant="secondary">{submission.status}</Badge>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="card-hover">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle>{homework.title}</CardTitle>
            {statusBadge}
          </div>
          <CardDescription>{homework.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 text-sm text-muted-foreground mb-4">
            {homework.dueDate && <span>Due: {homework.dueDate}</span>}
            {homework.totalMarks && <span>Marks: {homework.totalMarks}</span>}
          </div>
          {submission && submission.marksAwarded && (
            <p className="text-sm font-medium">Score: {submission.marksAwarded}/{homework.totalMarks}</p>
          )}
          {submission?.teacherFeedback && (
            <p className="text-sm text-muted-foreground mt-1">Feedback: {submission.teacherFeedback}</p>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="mt-3">
                <Upload className="h-4 w-4 mr-1" /> {submission ? "Resubmit" : "Submit"}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader><DialogTitle>Submit Homework</DialogTitle></DialogHeader>
              <SubmitForm
                onSubmit={(content) => submitMutation.mutate(content)}
                isLoading={submitMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function SubmitForm({ onSubmit, isLoading }: { onSubmit: (content: string) => void; isLoading: boolean }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // For now, send text content; file upload will be added later
    onSubmit(text);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label>Your answer</Label>
        <Textarea rows={5} value={text} onChange={e => setText(e.target.value)} placeholder="Type or paste your answer..." />
      </div>
      <div className="space-y-2">
        <Label>Or upload a file</Label>
        <Input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e => setFile(e.target.files?.[0] || null)} />
        {file && <p className="text-xs text-muted-foreground">{file.name}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Submitting…" : "Submit"}
      </Button>
    </form>
  );
}
