import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Layers, Plus, Pencil, Trash2, ChevronRight, Search, Filter,
  Brain, RotateCcw, BookOpen, Tag, Sparkles
} from "lucide-react";

type Flashcard = {
  id: number; deck_name: string; front: string; back: string;
  difficulty: string; topic: string | null; tags: string | null;
  ai_generated: boolean; created_at: string;
};

type Deck = { deck_name: string; card_count: number };

const DIFF_COLORS: Record<string, string> = {
  easy: "bg-green-100 text-green-700",
  medium: "bg-amber-100 text-amber-700",
  hard: "bg-red-100 text-red-700",
};

function CardDialog({ card, decks, onSave, trigger }: {
  card?: Flashcard; decks: string[]; onSave: (d: any) => Promise<void>; trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    front: card?.front || "", back: card?.back || "",
    deckName: card?.deck_name || "General", topic: card?.topic || "",
    difficulty: card?.difficulty || "medium", tags: card?.tags || "",
  });
  const { toast } = useToast();
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const handleSave = async () => {
    setLoading(true);
    try { await onSave(form); setOpen(false); }
    catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
    finally { setLoading(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{card ? "Edit Flashcard" : "New Flashcard"}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Deck Name</Label>
            <Input placeholder="e.g. Chapter 3, Organic Chemistry" value={form.deckName} onChange={e => set("deckName", e.target.value)} list="deck-list" />
            <datalist id="deck-list">{decks.map(d => <option key={d} value={d} />)}</datalist>
          </div>
          <div className="space-y-1.5">
            <Label>Front (Question / Term) *</Label>
            <Textarea rows={3} placeholder="What is the powerhouse of the cell?" value={form.front} onChange={e => set("front", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Back (Answer / Definition) *</Label>
            <Textarea rows={3} placeholder="The mitochondria" value={form.back} onChange={e => set("back", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Topic</Label>
              <Input placeholder="e.g. Cell Biology" value={form.topic} onChange={e => set("topic", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Difficulty</Label>
              <Select value={form.difficulty} onValueChange={v => set("difficulty", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Tags (comma separated)</Label>
            <Input placeholder="e.g. biology, exam2024" value={form.tags} onChange={e => set("tags", e.target.value)} />
          </div>
          <Button className="w-full" onClick={handleSave} disabled={loading || !form.front.trim() || !form.back.trim()}>
            {loading ? "Saving..." : card ? "Save Changes" : "Add Flashcard"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BulkDialog({ decks, onBulkSave, trigger }: { decks: string[]; onBulkSave: (d: any) => Promise<void>; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deckName, setDeckName] = useState("Quick Import");
  const [raw, setRaw] = useState("");
  const { toast } = useToast();
  const handleSave = async () => {
    const lines = raw.trim().split("\n").filter(l => l.includes("|"));
    const cards = lines.map(l => { const [front, back, topic] = l.split("|").map(s => s.trim()); return { front, back, topic }; });
    if (!cards.length) { toast({ title: "No valid lines found", variant: "destructive" }); return; }
    setLoading(true);
    try { await onBulkSave({ cards, deckName }); setOpen(false); setRaw(""); }
    catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
    finally { setLoading(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-violet-500" />Bulk Import Cards</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Deck Name</Label>
            <Input value={deckName} onChange={e => setDeckName(e.target.value)} list="bulk-deck-list" />
            <datalist id="bulk-deck-list">{decks.map(d => <option key={d} value={d} />)}</datalist>
          </div>
          <div className="space-y-1.5">
            <Label>Cards (one per line: Front | Back | Topic)</Label>
            <Textarea rows={10} placeholder={"Mitosis | Cell division process | Biology\nNewton's 1st law | An object at rest stays at rest... | Physics"} value={raw} onChange={e => setRaw(e.target.value)} className="font-mono text-sm" />
          </div>
          <p className="text-xs text-muted-foreground">Format: <code className="bg-muted px-1 rounded">Question | Answer | Topic (optional)</code></p>
          <Button className="w-full" onClick={handleSave} disabled={loading || !raw.trim()}>
            {loading ? "Importing..." : "Import Cards"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function FlashcardsPage() {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeck, setSelectedDeck] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [diffFilter, setDiffFilter] = useState("");
  const { toast } = useToast();

  const loadDecks = async () => {
    const r = await fetch("/api/flashcards/decks", { credentials: "include" });
    if (r.ok) setDecks(await r.json());
  };

  const loadCards = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedDeck) params.set("deck", selectedDeck);
      if (diffFilter) params.set("difficulty", diffFilter);
      if (search) params.set("search", search);
      const r = await fetch(`/api/flashcards?${params}`, { credentials: "include" });
      if (r.ok) setCards(await r.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { loadDecks(); }, []);
  useEffect(() => { loadCards(); }, [selectedDeck, diffFilter, search]);

  const deckNames = decks.map(d => d.deck_name);

  const handleCreate = async (data: any) => {
    const r = await fetch("/api/flashcards", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || "Failed"); }
    loadDecks(); loadCards(); toast({ title: "Card added!" });
  };

  const handleEdit = (card: Flashcard) => async (data: any) => {
    const r = await fetch(`/api/flashcards/${card.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || "Failed"); }
    loadDecks(); loadCards(); toast({ title: "Updated!" });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this card?")) return;
    await fetch(`/api/flashcards/${id}`, { method: "DELETE", credentials: "include" });
    loadDecks(); loadCards(); toast({ title: "Card deleted" });
  };

  const handleBulk = async (data: any) => {
    const r = await fetch("/api/flashcards/bulk", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || "Failed"); }
    const created = await r.json();
    loadDecks(); loadCards(); toast({ title: `${created.length} cards imported!` });
  };

  const totalCards = decks.reduce((a, d) => a + d.card_count, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Layers className="h-7 w-7 text-violet-600" />Flashcards
          </h1>
          <p className="text-muted-foreground mt-1">Build spaced-repetition flashcard decks for your students.</p>
        </div>
        <div className="flex gap-2">
          <BulkDialog decks={deckNames} onBulkSave={handleBulk}
            trigger={<Button variant="outline" className="gap-2"><Sparkles className="h-4 w-4 text-violet-500" />Bulk Import</Button>} />
          <CardDialog decks={deckNames} onSave={handleCreate}
            trigger={<Button className="gap-2"><Plus className="h-4 w-4" />New Card</Button>} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Cards", value: totalCards, color: "text-violet-600", bg: "bg-violet-50" },
          { label: "Decks", value: decks.length, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Easy", value: cards.filter(c => c.difficulty === "easy").length, color: "text-green-600", bg: "bg-green-50" },
          { label: "Hard", value: cards.filter(c => c.difficulty === "hard").length, color: "text-red-600", bg: "bg-red-50" },
        ].map(s => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Deck pills */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setSelectedDeck(null)}
          className={`text-sm px-3 py-1.5 rounded-full font-medium transition-all ${!selectedDeck ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/60 text-muted-foreground hover:bg-muted"}`}>
          All Cards ({totalCards})
        </button>
        {decks.map(d => (
          <button key={d.deck_name} onClick={() => setSelectedDeck(d.deck_name)}
            className={`text-sm px-3 py-1.5 rounded-full font-medium transition-all ${selectedDeck === d.deck_name ? "bg-violet-600 text-white shadow-sm" : "bg-muted/60 text-muted-foreground hover:bg-muted"}`}>
            {d.deck_name} ({d.card_count})
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search cards..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={diffFilter || "all"} onValueChange={v => setDiffFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-32 h-9"><SelectValue placeholder="Difficulty" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="easy">Easy</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="hard">Hard</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cards grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-36 rounded-xl bg-muted/40 animate-pulse" />)}
        </div>
      ) : cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-full bg-violet-50 flex items-center justify-center">
            <Layers className="h-8 w-8 text-violet-300" />
          </div>
          <p className="text-muted-foreground text-sm">No flashcards yet. Add your first card to get started.</p>
          <CardDialog decks={deckNames} onSave={handleCreate}
            trigger={<Button className="gap-2"><Plus className="h-4 w-4" />Add First Card</Button>} />
        </div>
      ) : (
        <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.04 } } }}>
          {cards.map((card) => (
            <motion.div key={card.id} variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
              <Card className="border-border/50 shadow-sm h-full hover:shadow-md transition-all group">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium">{card.deck_name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${DIFF_COLORS[card.difficulty] || "bg-muted text-muted-foreground"}`}>{card.difficulty}</span>
                      {card.ai_generated && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium flex items-center gap-0.5"><Sparkles className="h-2.5 w-2.5" />AI</span>}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <CardDialog card={card} decks={deckNames} onSave={handleEdit(card)}
                        trigger={<button className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>} />
                      <button className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600" onClick={() => handleDelete(card.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <div className="p-2.5 rounded-lg bg-muted/30 border border-border/30">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Q</p>
                    <p className="text-sm font-medium line-clamp-2">{card.front}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-violet-50/60 border border-violet-100/50">
                    <p className="text-[10px] font-semibold text-violet-500 uppercase tracking-wide mb-1">A</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{card.back}</p>
                  </div>
                  {card.topic && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Tag className="h-3 w-3" />{card.topic}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
