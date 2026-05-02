import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, Layers, Trophy, Flame, ChevronRight, RotateCcw, CheckCircle, Clock } from "lucide-react";

type FlashcardWithProgress = {
  id: number; front: string; back: string; deck_name: string; topic: string | null;
  difficulty: string; ease_factor: string; interval_days: number; reps: number;
  next_review_at: string | null; last_quality: number | null;
};

type Stats = { total: number; mastered: number; due: number; streakDays: number };
type Deck = { deck_name: string; card_count: number };

export default function MyFlashcards() {
  const [stats, setStats] = useState<Stats>({ total: 0, mastered: 0, due: 0, streakDays: 0 });
  const [decks, setDecks] = useState<Deck[]>([]);
  const [reviewCards, setReviewCards] = useState<FlashcardWithProgress[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [mode, setMode] = useState<"home" | "review" | "done">("home");
  const [selectedDeck, setSelectedDeck] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);

  const loadStats = async () => {
    const r = await fetch("/api/flashcards/stats", { credentials: "include" });
    if (r.ok) setStats(await r.json());
  };
  const loadDecks = async () => {
    const r = await fetch("/api/flashcards/decks", { credentials: "include" });
    if (r.ok) setDecks(await r.json());
    setLoading(false);
  };
  useEffect(() => { loadStats(); loadDecks(); }, []);

  const startReview = async (deck?: string) => {
    setReviewLoading(true);
    const params = deck ? `?deck=${encodeURIComponent(deck)}` : "";
    const r = await fetch(`/api/flashcards/review${params}`, { credentials: "include" });
    if (r.ok) {
      const cards = await r.json();
      if (!cards.length) { setMode("done"); setReviewLoading(false); return; }
      setReviewCards(cards); setCurrentIdx(0); setFlipped(false);
      setSessionCorrect(0); setSessionTotal(0);
      setMode("review");
    }
    setReviewLoading(false);
  };

  const handleRate = async (quality: number) => {
    const card = reviewCards[currentIdx];
    await fetch(`/api/flashcards/${card.id}/review`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quality }),
    });
    if (quality >= 3) setSessionCorrect(c => c + 1);
    setSessionTotal(t => t + 1);
    const next = currentIdx + 1;
    if (next >= reviewCards.length) { setMode("done"); loadStats(); }
    else { setCurrentIdx(next); setFlipped(false); }
  };

  const currentCard = reviewCards[currentIdx];
  const progress = reviewCards.length > 0 ? ((currentIdx) / reviewCards.length) * 100 : 0;

  if (mode === "review" && currentCard) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setMode("home")} className="text-muted-foreground">← Exit</Button>
          <div className="text-sm text-muted-foreground">{currentIdx + 1} / {reviewCards.length}</div>
          <div className="text-sm font-medium text-emerald-600">{sessionCorrect} correct</div>
        </div>
        {/* Progress bar */}
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <motion.div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full"
            animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
        </div>
        {/* Card */}
        <div className="flex justify-center">
          <div className="w-full max-w-xl">
            <motion.div
              key={`${currentCard.id}-${flipped}`}
              initial={{ rotateY: flipped ? -90 : 90, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <Card className={`min-h-56 cursor-pointer transition-all ${flipped ? "border-violet-300 bg-violet-50/50 shadow-md shadow-violet-100" : "border-border/60 hover:shadow-md"}`}
                onClick={() => !flipped && setFlipped(true)}>
                <CardContent className="p-8 flex flex-col items-center justify-center min-h-56 gap-4">
                  <div className="flex gap-2 flex-wrap justify-center">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">{currentCard.deck_name}</span>
                    {currentCard.topic && <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 font-medium">{currentCard.topic}</span>}
                  </div>
                  {!flipped ? (
                    <>
                      <p className="text-xl font-semibold text-center">{currentCard.front}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1"><RotateCcw className="h-3.5 w-3.5" />Tap to reveal answer</p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs font-semibold text-violet-500 uppercase tracking-wide">Answer</p>
                      <p className="text-xl text-center font-medium text-violet-800">{currentCard.back}</p>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            <AnimatePresence>
              {flipped && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="mt-4 space-y-3">
                  <p className="text-center text-sm text-muted-foreground font-medium">How well did you know this?</p>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "Again", color: "bg-red-100 text-red-700 hover:bg-red-200 border-red-200", quality: 0 },
                      { label: "Hard", color: "bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200", quality: 2 },
                      { label: "Good", color: "bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200", quality: 4 },
                      { label: "Easy", color: "bg-green-100 text-green-700 hover:bg-green-200 border-green-200", quality: 5 },
                    ].map(b => (
                      <button key={b.label} onClick={() => handleRate(b.quality)}
                        className={`py-2.5 px-2 rounded-xl text-sm font-semibold border transition-all ${b.color}`}>
                        {b.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "done") {
    const pct = sessionTotal > 0 ? Math.round((sessionCorrect / sessionTotal) * 100) : 0;
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-6">
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", duration: 0.6 }}>
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center shadow-xl shadow-violet-200">
            <Trophy className="h-12 w-12 text-white" />
          </div>
        </motion.div>
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold">Session Complete!</h2>
          <p className="text-muted-foreground">You reviewed {sessionTotal} cards</p>
        </div>
        <div className="flex gap-6 text-center">
          <div><p className="text-3xl font-black text-emerald-600">{sessionCorrect}</p><p className="text-xs text-muted-foreground">Correct</p></div>
          <div><p className="text-3xl font-black text-primary">{pct}%</p><p className="text-xs text-muted-foreground">Score</p></div>
          <div><p className="text-3xl font-black text-violet-600">{sessionTotal - sessionCorrect}</p><p className="text-xs text-muted-foreground">To Retry</p></div>
        </div>
        <Button onClick={() => setMode("home")} className="gap-2"><ChevronRight className="h-4 w-4" />Back to Decks</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Layers className="h-6 w-6 text-violet-600" />My Flashcards
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Spaced repetition helps you remember more with less effort.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Cards", value: stats.total, icon: Layers, color: "text-violet-600", bg: "bg-violet-50" },
          { label: "Mastered", value: stats.mastered, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Due Today", value: stats.due, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
        ].map(s => (
          <Card key={s.label} className={`border-border/50 ${s.bg}`}>
            <CardContent className="pt-4 pb-3 flex flex-col items-center text-center">
              <s.icon className={`h-5 w-5 mb-1 ${s.color}`} />
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Review all CTA */}
      {stats.due > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-violet-200 bg-gradient-to-r from-violet-50 to-indigo-50 shadow-sm">
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-violet-900">{stats.due} cards due for review</p>
                <p className="text-sm text-violet-600">Keep your streak going!</p>
              </div>
              <Button onClick={() => startReview()} disabled={reviewLoading}
                className="bg-violet-600 hover:bg-violet-700 gap-2 shrink-0">
                <Brain className="h-4 w-4" />{reviewLoading ? "Loading..." : "Review All"}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Decks */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Your Decks</h2>
        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />)}</div>
        ) : decks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            <Layers className="h-10 w-10 mx-auto mb-3 opacity-20" />
            No flashcard decks yet. Ask your teacher to add some!
          </div>
        ) : (
          <div className="space-y-2">
            {decks.map(deck => (
              <motion.div key={deck.deck_name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
                <button onClick={() => startReview(deck.deck_name)}
                  className="w-full flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card hover:bg-muted/30 hover:border-violet-200 transition-all group text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center group-hover:bg-violet-200 transition-colors">
                      <Layers className="h-5 w-5 text-violet-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{deck.deck_name}</p>
                      <p className="text-xs text-muted-foreground">{deck.card_count} cards</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-violet-600 transition-colors" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
