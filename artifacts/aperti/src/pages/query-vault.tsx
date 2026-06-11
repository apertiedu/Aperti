import { useState, useRef } from "react";
import UpgradeModal from "@/components/upgrade-modal";
import PlanUsageBar from "@/components/plan-usage-bar";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card, CardContent,
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
import { Plus, Search, Pencil, Trash2, ImageIcon, X, Upload, Brain } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  imageUrl?: string | null;
}

export default function QueryVault() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [search, setSearch] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeMsg, setUpgradeMsg] = useState<string | undefined>(undefined);

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
      <div className="mb-6">
        <PlanUsageBar resource="questions" label="Question Bank Slots" />
      </div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">QueryVault</h1>
          <p className="text-muted-foreground">Your private question bank.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingQuestion(null)}><Plus className="h-4 w-4 mr-2" />Add Question</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingQuestion ? "Edit Question" : "New Question"}</DialogTitle></DialogHeader>
            <QuestionForm
              question={editingQuestion}
              onClose={() => { setDialogOpen(false); setEditingQuestion(null); }}
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ["question-bank"] })}
              onLimitExceeded={(msg) => { setDialogOpen(false); setUpgradeMsg(msg); setUpgradeOpen(true); }}
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
        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: "#0D948815" }}>
              <Brain className="w-6 h-6" style={{ color: "#0D9488" }} />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">Your question bank is empty</h3>
            <p className="text-sm text-muted-foreground max-w-xs mb-5">Build a library of questions to reuse across assessments and homework tasks.</p>
            <button
              onClick={() => setDialogOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ background: "#0D9488" }}
            >
              <Plus className="w-4 h-4" /> Add your first question
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {questions?.map((q) => (
            <motion.div key={q.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="card-hover">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-medium line-clamp-2">{q.questionText}</p>
                      {q.imageUrl && (
                        <div className="mt-2">
                          <img src={q.imageUrl} alt="Question diagram" className="max-h-32 rounded-lg border object-contain" />
                        </div>
                      )}
                      <div className="flex gap-2 mt-2 flex-wrap items-center">
                        {q.topic && <Badge variant="secondary">{q.topic}</Badge>}
                        <Badge variant="outline">{q.difficulty}</Badge>
                        <Badge variant="outline">{q.maxMarks} marks</Badge>
                        {q.timesUsed === 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-100">Never used</span>
                        ) : q.timesUsed >= 5 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100">★ Popular · {q.timesUsed}x</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Used {q.timesUsed}x</span>
                        )}
                        {q.imageUrl && <Badge variant="outline" className="gap-1"><ImageIcon className="h-3 w-3" />Diagram</Badge>}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
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

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        resource="questions"
        message={upgradeMsg}
      />
    </div>
  );
}

function QuestionForm({ question, onClose, onRefresh, onLimitExceeded }: {
  question: Question | null; onClose: () => void; onRefresh: () => void;
  onLimitExceeded?: (msg: string) => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    questionText: question?.questionText ?? "",
    topic: question?.topic ?? "",
    subtopic: question?.subtopic ?? "",
    difficulty: question?.difficulty ?? "medium",
    maxMarks: question?.maxMarks ?? "1",
    modelAnswer: "",
    tags: question?.tags ?? "",
    imageUrl: question?.imageUrl ?? "",
  });
  const [uploadingImage, setUploadingImage] = useState(false);

  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`${API}/question-bank${question ? `/${question.id}` : ""}`, {
        method: question ? "PUT" : "POST",
        headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 403 && json.code === "LIMIT_EXCEEDED") {
        onLimitExceeded?.(json.error);
        return null;
      }
      if (!res.ok) throw new Error(json.error || "Failed");
      return json;
    },
    onSuccess: (data) => {
      if (!data) return;
      queryClient.invalidateQueries({ queryKey: ["question-bank"] });
      onClose();
      onRefresh();
    },
  });

  const handleImageUpload = async (file: File) => {
    if (!["image/png", "image/jpeg", "image/jpg"].includes(file.type)) {
      toast({ title: "Only PNG or JPG images are allowed for diagrams", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image must be under 5 MB", variant: "destructive" });
      return;
    }
    setUploadingImage(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const fileData = e.target?.result as string;
      try {
        const res = await fetch("/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token()}`,
          },
          body: JSON.stringify({ fileName: file.name, fileType: file.type, fileData }),
        });
        if (!res.ok) throw new Error("Upload failed");
        const { url } = await res.json();
        setForm(f => ({ ...f, imageUrl: url }));
        toast({ title: "Diagram uploaded" });
      } catch {
        toast({ title: "Upload failed", variant: "destructive" });
      } finally {
        setUploadingImage(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }} className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label>Question Text *</Label>
        <Textarea rows={4} required value={form.questionText} onChange={e => setForm({...form, questionText: e.target.value})} />
      </div>

      {/* Diagram upload */}
      <div className="space-y-2">
        <Label>Diagram / Image (optional)</Label>
        {form.imageUrl ? (
          <div className="relative w-fit">
            <img src={form.imageUrl} alt="Diagram preview" className="max-h-36 rounded-lg border object-contain" />
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, imageUrl: "" }))}
              className="absolute -top-2 -right-2 bg-white border border-gray-200 rounded-full p-0.5 shadow text-gray-500 hover:text-red-500"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".png,.jpg,.jpeg"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ""; }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 border-dashed"
              disabled={uploadingImage}
              onClick={() => fileRef.current?.click()}
            >
              {uploadingImage ? (
                <><div className="h-3 w-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />Uploading…</>
              ) : (
                <><Upload className="h-3.5 w-3.5" />Upload diagram (PNG, JPG)</>
              )}
            </Button>
          </div>
        )}
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
