import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus, Layers, Users, Eye, Pencil, Trash2, Globe, Lock,
  TrendingUp, BookOpen, ChevronLeft, ChevronRight, RotateCcw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const API = "/api";
const tok = () => localStorage.getItem("aperti_token");
async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(`${API}${url}`, {
    ...opts,
    headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

interface Flashcard { front: string; back: string; }
interface Deck {
  id: number; title: string; description?: string; subject_id?: number;
  subject_name?: string; is_public: boolean; card_count: number;
  cards: Flashcard[];
}

const EMPTY_FORM = { title: "", description: "", subject_id: "", is_public: false };

export default function CardStack() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("decks");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [cards, setCards] = useState<Flashcard[]>([{ front: "", back: "" }]);
  const [studyDeck, setStudyDeck] = useState<Deck | null>(null);
  const [studyIdx, setStudyIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const { data: decks, isLoading } = useQuery<Deck[]>({
    queryKey: ["flashcard-decks"],
    queryFn: () => apiFetch("/flashcards/decks"),
  });

  const { data: subjects } = useQuery<any[]>({
    queryKey: ["subjects"],
    queryFn: () => apiFetch("/subjects"),
  });

  const deckList: Deck[] = Array.isArray(decks) ? decks : (decks as any)?.decks ?? [];
  const subjectList: any[] = Array.isArray(subjects) ? subjects : [];

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      editingDeck
        ? apiFetch(`/flashcards/decks/${editingDeck.id}`, { method: "PUT", body: JSON.stringify(data) })
        : apiFetch("/flashcards/decks", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flashcard-decks"] });
      setDialogOpen(false);
      toast({ title: editingDeck ? "Deck updated" : "Deck created", description: form.title });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/flashcards/decks/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["flashcard-decks"] }),
  });

  function openCreate() {
    setEditingDeck(null);
    setForm({ ...EMPTY_FORM });
    setCards([{ front: "", back: "" }]);
    setDialogOpen(true);
  }

  function openEdit(deck: Deck) {
    setEditingDeck(deck);
    setForm({ title: deck.title, description: deck.description ?? "", subject_id: deck.subject_id ? String(deck.subject_id) : "", is_public: deck.is_public });
    setCards(deck.cards?.length ? deck.cards : [{ front: "", back: "" }]);
    setDialogOpen(true);
  }

  function handleSave() {
    saveMutation.mutate({
      title: form.title,
      description: form.description,
      subject_id: form.subject_id ? parseInt(form.subject_id) : null,
      is_public: form.is_public,
      cards: cards.filter(c => c.front.trim()),
    });
  }

  function updateCard(i: number, field: keyof Flashcard, val: string) {
    setCards(cs => cs.map((c, idx) => idx === i ? { ...c, [field]: val } : c));
  }

  function openStudy(deck: Deck) {
    setStudyDeck(deck);
    setStudyIdx(0);
    setFlipped(false);
    setTab("study");
  }

  const studyCards = studyDeck?.cards ?? [];
  const current = studyCards[studyIdx];

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-3xl font-bold">CardStack™</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-12">Create and manage flashcard decks for your students.</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> New Deck
        </Button>
      </motion.div>

      <Tabs value={tab} onValueChange={v => { setTab(v); if (v !== "study") setStudyDeck(null); }}>
        <TabsList className="mb-6">
          <TabsTrigger value="decks">My Decks</TabsTrigger>
          <TabsTrigger value="study" disabled={!studyDeck}>Study Mode</TabsTrigger>
        </TabsList>

        {/* DECKS TAB */}
        <TabsContent value="decks">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
            </div>
          ) : deckList.length === 0 ? (
            <Card>
              <CardContent className="p-16 text-center text-muted-foreground">
                <Layers className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No decks yet</p>
                <p className="text-sm mt-1">Create your first flashcard deck to boost student revision.</p>
                <Button onClick={openCreate} className="mt-4 gap-2"><Plus className="h-4 w-4" /> Create Deck</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {deckList.map(deck => (
                <motion.div key={deck.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="card-hover">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-sm truncate">{deck.title}</CardTitle>
                          <CardDescription className="text-xs">{deck.subject_name ?? "Any subject"}</CardDescription>
                        </div>
                        {deck.is_public ? (
                          <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {deck.description && <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{deck.description}</p>}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                        <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{deck.card_count ?? 0} cards</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 flex-1" onClick={() => openStudy(deck)}>
                          <Eye className="h-3 w-3" /> Study
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 flex-1" onClick={() => openEdit(deck)}>
                          <Pencil className="h-3 w-3" /> Edit
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(deck.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* STUDY TAB */}
        <TabsContent value="study">
          {studyDeck && (
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-semibold">{studyDeck.title}</p>
                  <p className="text-xs text-muted-foreground">{studyIdx + 1} of {studyCards.length} cards</p>
                </div>
                <Progress value={studyCards.length > 0 ? ((studyIdx + 1) / studyCards.length) * 100 : 0} className="w-32 h-2" />
              </div>

              {current ? (
                <div className="perspective-1000">
                  <motion.div
                    className={cn("relative h-64 cursor-pointer", flipped && "rotate-y-180")}
                    onClick={() => setFlipped(!flipped)}
                    animate={{ rotateY: flipped ? 180 : 0 }}
                    transition={{ duration: 0.4, type: "spring", stiffness: 200 }}
                    style={{ transformStyle: "preserve-3d" }}
                  >
                    {/* Front */}
                    <Card className="absolute inset-0 flex items-center justify-center p-8 backface-hidden">
                      <div className="text-center">
                        <Badge variant="secondary" className="mb-4 text-xs">Front</Badge>
                        <p className="text-lg font-semibold">{current.front}</p>
                      </div>
                    </Card>
                    {/* Back */}
                    <Card className="absolute inset-0 flex items-center justify-center p-8 bg-primary/5 border-primary/30"
                      style={{ transform: "rotateY(180deg)", backfaceVisibility: "hidden" }}>
                      <div className="text-center">
                        <Badge className="mb-4 text-xs">Back</Badge>
                        <p className="text-base">{current.back}</p>
                      </div>
                    </Card>
                  </motion.div>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">No cards in this deck</div>
              )}

              <div className="flex items-center justify-center gap-3 mt-4">
                <Button variant="outline" size="icon" disabled={studyIdx === 0} onClick={() => { setStudyIdx(i => i - 1); setFlipped(false); }}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="gap-2" onClick={() => { setStudyIdx(0); setFlipped(false); }}>
                  <RotateCcw className="h-3.5 w-3.5" /> Restart
                </Button>
                <Button variant="outline" size="icon" disabled={studyIdx === studyCards.length - 1} onClick={() => { setStudyIdx(i => i + 1); setFlipped(false); }}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-center text-xs text-muted-foreground mt-3">Click card to flip · Arrow buttons to navigate</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDeck ? "Edit Deck" : "New Flashcard Deck"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Deck Title</Label>
              <Input placeholder="e.g. Cell Biology Key Terms" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Subject</Label>
                <Select value={form.subject_id} onValueChange={v => setForm(f => ({ ...f, subject_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any</SelectItem>
                    {subjectList.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Visibility</Label>
                <div className="flex items-center gap-2 h-9">
                  <Switch checked={form.is_public} onCheckedChange={v => setForm(f => ({ ...f, is_public: v }))} />
                  <span className="text-sm">{form.is_public ? "Public" : "Private"}</span>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Input placeholder="Brief description of the deck" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            {/* Cards Editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Flashcards ({cards.length})</Label>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {cards.map((card, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-muted/40 border">
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">Front</p>
                      <Textarea rows={2} placeholder="Question / term" className="text-xs resize-none" value={card.front} onChange={e => updateCard(i, "front", e.target.value)} />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">Back</p>
                      <Textarea rows={2} placeholder="Answer / definition" className="text-xs resize-none" value={card.back} onChange={e => updateCard(i, "back", e.target.value)} />
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => setCards(cs => [...cs, { front: "", back: "" }])}>
                <Plus className="h-4 w-4" /> Add Card
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.title || saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : editingDeck ? "Update Deck" : "Create Deck"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
