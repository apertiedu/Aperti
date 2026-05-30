import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Plus, GripVertical, Trash2, ArrowUp, ArrowDown, FileText,
  Video, HelpCircle, FlaskConical, Layers,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";
const token = () => localStorage.getItem("aperti_token");

async function fetchJSON(url: string, options?: RequestInit) {
  const res = await fetch(`${API}${url}`, {
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(options?.headers || {}) },
    ...options,
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

interface Section {
  type: "text" | "video" | "quiz" | "simulation" | "flashcards";
  title?: string;
  content?: string;
  quizQuestionIds?: number[];
  simulationId?: number;
  flashcardDeckId?: number;
}

interface Lesson {
  id: number;
  title: string;
  description: string | null;
  sections: Section[];
  updatedAt: string;
}

export default function ContentCraft() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);

  const { data: lessons, isLoading } = useQuery<Lesson[]>({
    queryKey: ["content-craft"],
    queryFn: () => fetchJSON("/content-craft"),
  });

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">ContentCraft<span className="text-primary">™</span></h1>
          <p className="text-muted-foreground">Build interactive lessons visually.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingLesson(null)}><Plus className="h-4 w-4 mr-2" />Create Lesson</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader><DialogTitle>{editingLesson ? "Edit Lesson" : "New Lesson"}</DialogTitle></DialogHeader>
            <LessonEditor
              lesson={editingLesson}
              onClose={() => { setDialogOpen(false); setEditingLesson(null); }}
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ["content-craft"] })}
            />
          </DialogContent>
        </Dialog>
      </motion.div>

      {isLoading ? (
        <div className="grid gap-4">{[1,2].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : lessons?.length === 0 ? (
        <Card className="card-hover">
          <CardContent className="p-8 text-center text-muted-foreground">No lessons yet. Create your first interactive lesson.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {lessons?.map((lesson) => (
            <Card key={lesson.id} className="card-hover">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{lesson.title}</p>
                  <p className="text-sm text-muted-foreground">{lesson.sections?.length || 0} sections · Updated {new Date(lesson.updatedAt).toLocaleDateString()}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => { setEditingLesson(lesson); setDialogOpen(true); }}>
                  Edit
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function LessonEditor({ lesson, onClose, onRefresh }: { lesson: Lesson | null; onClose: () => void; onRefresh: () => void }) {
  const [title, setTitle] = useState(lesson?.title || "");
  const [description, setDescription] = useState(lesson?.description || "");
  const [sections, setSections] = useState<Section[]>(lesson?.sections || []);
  const [newSectionType, setNewSectionType] = useState<"text" | "video" | "quiz" | "simulation" | "flashcards">("text");

  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (data: any) =>
      fetch(`${API}/content-craft${lesson ? `/${lesson.id}` : ""}`, {
        method: lesson ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-craft"] });
      onClose();
      onRefresh();
    },
  });

  const addSection = () => {
    const newSection: Section = { type: newSectionType, title: "", content: "", quizQuestionIds: [], simulationId: undefined, flashcardDeckId: undefined };
    setSections([...sections, newSection]);
  };

  const updateSection = (index: number, field: string, value: any) => {
    const updated = [...sections];
    (updated[index] as any)[field] = value;
    setSections(updated);
  };

  const removeSection = (index: number) => {
    setSections(sections.filter((_, i) => i !== index));
  };

  const moveSection = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sections.length) return;
    const updated = [...sections];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setSections(updated);
  };

  const handleSave = () => {
    mutation.mutate({ title, description, sections });
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label>Lesson Title</Label>
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Introduction to Electricity" />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief summary..." />
      </div>

      <div>
        <Label className="mb-2 block">Sections</Label>
        <div className="space-y-2">
          {sections.map((section, idx) => (
            <div key={idx} className="p-3 border rounded-lg bg-card">
              <div className="flex items-center justify-between mb-2">
                <Badge variant="secondary">{section.type}</Badge>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => moveSection(idx, "up")}><ArrowUp className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => moveSection(idx, "down")}><ArrowDown className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => removeSection(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
              <div className="space-y-2">
                <Input placeholder="Section title (optional)" value={section.title || ""} onChange={e => updateSection(idx, "title", e.target.value)} />
                {section.type === "text" && (
                  <Textarea placeholder="Write content here..." value={section.content || ""} onChange={e => updateSection(idx, "content", e.target.value)} />
                )}
                {section.type === "video" && (
                  <Input placeholder="YouTube or video URL" value={section.content || ""} onChange={e => updateSection(idx, "content", e.target.value)} />
                )}
                {section.type === "quiz" && (
                  <p className="text-sm text-muted-foreground">Select questions from QueryVault (feature coming soon)</p>
                )}
                {section.type === "simulation" && (
                  <p className="text-sm text-muted-foreground">Link to SimVerse simulation (feature coming soon)</p>
                )}
                {section.type === "flashcards" && (
                  <p className="text-sm text-muted-foreground">Select a flashcard deck (feature coming soon)</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-3">
          <Select value={newSectionType} onValueChange={(v: any) => setNewSectionType(v)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="text"><FileText className="h-4 w-4 inline mr-2" />Text</SelectItem>
              <SelectItem value="video"><Video className="h-4 w-4 inline mr-2" />Video</SelectItem>
              <SelectItem value="quiz"><HelpCircle className="h-4 w-4 inline mr-2" />Quiz</SelectItem>
              <SelectItem value="simulation"><FlaskConical className="h-4 w-4 inline mr-2" />Simulation</SelectItem>
              <SelectItem value="flashcards"><Layers className="h-4 w-4 inline mr-2" />Flashcards</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={addSection}>+ Add Section</Button>
        </div>
      </div>

      <Button className="w-full" onClick={handleSave} disabled={mutation.isPending}>
        {mutation.isPending ? "Saving…" : lesson ? "Update Lesson" : "Create Lesson"}
      </Button>
    </div>
  );
}
