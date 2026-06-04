import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Pencil, Plus, BookOpen, ChevronRight, Save, ArrowLeft, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const token = () => localStorage.getItem("aperti_token");
async function fetchJSON(url: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}
async function postJSON(url: string, body: object) {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 240, damping: 24 } } };

function PageEditor({ notebookId, onBack }: { notebookId: number; onBack: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(false);

  const { data: pages, isLoading } = useQuery({
    queryKey: ["inkspace", "notebooks", notebookId, "pages"],
    queryFn: () => fetchJSON(`/api/inkspace/notebooks/${notebookId}/pages`),
  });

  const saveMutation = useMutation({
    mutationFn: async (text: string) => {
      const pgRes = await postJSON(`/api/inkspace/notebooks/${notebookId}/pages`, { title: "Page" });
      return postJSON(`/api/inkspace/save`, { notebookId, pageId: pgRes.id, content: text });
    },
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      queryClient.invalidateQueries({ queryKey: ["inkspace", "notebooks", notebookId, "pages"] });
      toast({ title: "Saved!" });
    },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <h2 className="font-semibold text-base">Notebook Pages</h2>
      </div>

      {/* Existing pages */}
      {isLoading ? (
        <Skeleton className="h-24 rounded-xl" />
      ) : (pages ?? []).length > 0 ? (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {(pages ?? []).map((p: any, i: number) => (
            <Card key={p.id ?? i} className="shadow-sm">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground mb-1">Page {i + 1} · {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : ""}</p>
                <p className="text-sm line-clamp-2">{p.content ?? "Empty page"}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No pages yet. Start writing below!</p>
      )}

      {/* New page editor */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            New Page
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Start writing… markdown supported"
            rows={8}
            className="text-sm font-mono resize-none"
          />
          <Button
            className="w-full gap-2"
            onClick={() => saveMutation.mutate(content)}
            disabled={!content.trim() || saveMutation.isPending}
          >
            {saved ? <><Save className="h-4 w-4" /> Saved!</> : <><Save className="h-4 w-4" /> Save Page</>}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function CreateNotebookDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () => postJSON("/api/inkspace/notebooks", { title: title.trim(), subject: subject.trim() }),
    onSuccess: () => {
      toast({ title: "Notebook created!" });
      setOpen(false);
      setTitle(""); setSubject("");
      onCreated();
    },
    onError: () => toast({ title: "Failed to create notebook", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="h-4 w-4" /> New Notebook</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Notebook</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <Input placeholder="Notebook title (e.g. Physics Notes)" value={title} onChange={e => setTitle(e.target.value)} />
          <Input placeholder="Subject (optional)" value={subject} onChange={e => setSubject(e.target.value)} />
          <Button className="w-full" onClick={() => mutation.mutate()} disabled={!title.trim() || mutation.isPending}>
            {mutation.isPending ? "Creating…" : "Create Notebook"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function StudentInkSpace() {
  const [openNotebook, setOpenNotebook] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: notebooks, isLoading } = useQuery({
    queryKey: ["inkspace", "notebooks"],
    queryFn: () => fetchJSON("/api/inkspace/notebooks"),
  });

  if (openNotebook !== null) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] dark:bg-background p-4 md:p-6">
        <PageEditor notebookId={openNotebook} onBack={() => setOpenNotebook(null)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] dark:bg-background p-4 md:p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Pencil className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">InkSpace</h1>
              <p className="text-muted-foreground text-sm">Smart notebooks — write, organise, and revise your notes.</p>
            </div>
          </div>
          <CreateNotebookDialog onCreated={() => queryClient.invalidateQueries({ queryKey: ["inkspace", "notebooks"] })} />
        </div>
      </motion.div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : (notebooks ?? []).length === 0 ? (
        <Card className="shadow-sm max-w-md mx-auto mt-12">
          <CardContent className="p-10 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="font-semibold text-lg mb-2">No notebooks yet</p>
            <p className="text-muted-foreground text-sm mb-5">Create your first notebook to start taking smart notes.</p>
            <CreateNotebookDialog onCreated={() => queryClient.invalidateQueries({ queryKey: ["inkspace", "notebooks"] })} />
          </CardContent>
        </Card>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(notebooks ?? []).map((nb: any) => (
            <motion.div key={nb.id} variants={item} whileHover={{ y: -3 }}>
              <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full" onClick={() => setOpenNotebook(nb.id)}>
                <CardHeader>
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">{nb.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  {nb.subject && <Badge variant="secondary" className="text-[11px] mb-2">{nb.subject}</Badge>}
                  <p className="text-xs text-muted-foreground">
                    {nb.pageCount ?? 0} pages · Updated {nb.updatedAt ? new Date(nb.updatedAt).toLocaleDateString() : "—"}
                  </p>
                  <div className="flex items-center gap-1 text-primary text-xs mt-3 font-medium">
                    Open notebook <ChevronRight className="h-3 w-3" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
