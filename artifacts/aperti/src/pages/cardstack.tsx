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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, ChevronLeft, ChevronRight, Layers } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";
const token = () => localStorage.getItem("aperti_token");
async function fetchJSON(url: string, opts?: RequestInit) {
  const res = await fetch(`${API}${url}`, {
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) },
    ...opts,
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

interface Card_ { id?: number; front: string; back: string; difficulty: string; }
interface Deck { id: number; title: string; description?: string; subjectId?: number; }

export default function Cardstack() {
  const queryClient = useQueryClient();
  const [newDeck, setNewDeck] = useState({ title: "", description: "" });
  const [deckDialogOpen, setDeckDialogOpen] = useState(false);
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const [newCard, setNewCard] = useState<Card_>({ front: "", back: "", difficulty: "medium" });
  const [cardDialogOpen, setCardDialogOpen] = useState(false);

  const { data: decks, isLoading } = useQuery<Deck[]>({
    queryKey: ["flashcard-decks"],
    queryFn: () => fetchJSON("/flashcards/decks"),
  });

  const { data: cards } = useQuery<Card_[]>({
    queryKey: ["flashcard-cards", selectedDeck?.id],
    queryFn: () => fetchJSON(`/flashcards/decks/${selectedDeck!.id}/cards`),
    enabled: !!selectedDeck,
  });

  const createDeck = useMutation({
    mutationFn: (d: typeof newDeck) => fetchJSON("/flashcards/decks", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["flashcard-decks"] }); setNewDeck({ title: "", description: "" }); setDeckDialogOpen(false); },
  });

  const deleteDeck = useMutation({
    mutationFn: (id: number) => fetchJSON(`/flashcards/decks/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["flashcard-decks"] }); if (selectedDeck) setSelectedDeck(null); },
  });

  const createCard = useMutation({
    mutationFn: (c: Card_) => fetchJSON(`/flashcards/decks/${selectedDeck!.id}/cards`, { method: "POST", body: JSON.stringify(c) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["flashcard-cards", selectedDeck?.id] }); setNewCard({ front: "", back: "", difficulty: "medium" }); setCardDialogOpen(false); },
  });

  const cardList: Card_[] = Array.isArray(cards) ? cards : [];
  const currentCard = cardList[previewIdx];

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">CardStack<span className="text-primary">™</span></h1>
          <p className="text-muted-foreground">Create and manage flashcard decks for your students.</p>
        </div>
        <Dialog open={deckDialogOpen} onOpenChange={setDeckDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />New Deck</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Flashcard Deck</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input placeholder="e.g. Physics — Electricity" value={newDeck.title} onChange={e => setNewDeck(d => ({ ...d, title: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Description (optional)</Label>
                <Textarea placeholder="Brief description…" value={newDeck.description} onChange={e => setNewDeck(d => ({ ...d, description: e.target.value }))} />
              </div>
              <Button className="w-full" onClick={() => createDeck.mutate(newDeck)} disabled={!newDeck.title || createDeck.isPending}>
                {createDeck.isPending ? "Creating…" : "Create Deck"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-3">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Your Decks</h2>
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)
          ) : (decks ?? []).length === 0 ? (
            <Card><CardContent className="p-5 text-center text-muted-foreground text-sm">No decks yet. Create one to get started.</CardContent></Card>
          ) : (
            (decks ?? []).map(deck => (
              <motion.div key={deck.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
                <Card
                  className={`card-hover cursor-pointer border-2 transition-colors ${selectedDeck?.id === deck.id ? "border-primary" : "border-transparent"}`}
                  onClick={() => { setSelectedDeck(deck); setPreviewIdx(0); setFlipped(false); }}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                        <Layers className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{deck.title}</p>
                        <p className="text-xs text-muted-foreground">{deck.description || "No description"}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); deleteDeck.mutate(deck.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          {!selectedDeck ? (
            <Card className="h-64 flex items-center justify-center">
              <CardContent className="text-center text-muted-foreground">
                <Layers className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>Select a deck to view and manage its flashcards.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{selectedDeck.title} <Badge variant="secondary" className="ml-2">{cardList.length} cards</Badge></h2>
                <Dialog open={cardDialogOpen} onOpenChange={setCardDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Card</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add Flashcard</DialogTitle></DialogHeader>
                    <div className="space-y-4 mt-2">
                      <div className="space-y-1.5">
                        <Label>Front (Question)</Label>
                        <Textarea placeholder="What is Ohm's Law?" value={newCard.front} onChange={e => setNewCard(c => ({ ...c, front: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Back (Answer)</Label>
                        <Textarea placeholder="V = IR, where V is voltage, I is current, R is resistance." value={newCard.back} onChange={e => setNewCard(c => ({ ...c, back: e.target.value }))} />
                      </div>
                      <Button className="w-full" onClick={() => createCard.mutate(newCard)} disabled={!newCard.front || !newCard.back || createCard.isPending}>
                        {createCard.isPending ? "Adding…" : "Add Card"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {cardList.length === 0 ? (
                <Card className="h-56 flex items-center justify-center">
                  <CardContent className="text-center text-muted-foreground text-sm">
                    No cards yet. Click "Add Card" to create your first flashcard.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  <Card
                    className="h-52 cursor-pointer select-none card-hover"
                    onClick={() => setFlipped(f => !f)}
                  >
                    <CardContent className="h-full flex flex-col items-center justify-center gap-2 p-6 text-center">
                      <Badge variant="outline" className="text-xs">{flipped ? "Answer" : "Question"}</Badge>
                      <AnimatePresence mode="wait">
                        <motion.p
                          key={flipped ? "back" : "front"}
                          initial={{ opacity: 0, rotateX: -30 }}
                          animate={{ opacity: 1, rotateX: 0 }}
                          exit={{ opacity: 0, rotateX: 30 }}
                          className="text-lg font-medium"
                        >
                          {flipped ? currentCard?.back : currentCard?.front}
                        </motion.p>
                      </AnimatePresence>
                      <p className="text-xs text-muted-foreground mt-2">Click to flip</p>
                    </CardContent>
                  </Card>

                  <div className="flex items-center justify-between">
                    <Button variant="outline" size="icon" onClick={() => { setPreviewIdx(i => Math.max(0, i - 1)); setFlipped(false); }} disabled={previewIdx === 0}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">{previewIdx + 1} / {cardList.length}</span>
                    <Button variant="outline" size="icon" onClick={() => { setPreviewIdx(i => Math.min(cardList.length - 1, i + 1)); setFlipped(false); }} disabled={previewIdx === cardList.length - 1}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
