import { apiFetch } from "@/lib/api";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Brain, Layers, Trophy, ChevronRight, RotateCcw,
  Clock, Star, TrendingUp, BookOpen, Zap,
  ThumbsUp, ThumbsDown, Minus, ArrowLeft
} from "lucide-react";

type FlashcardWithProgress = {
  id: number; front: string; back: string; deck_name: string; topic: string | null;
  difficulty: string; ease_factor: string; interval_days: number; reps: number;
  next_review_at: string | null; last_quality: number | null;
  image_url?: string | null; back_image_url?: string | null;
  exam_style?: boolean; hint?: string | null;
};

type Stats = { total: number; mastered: number; due: number; streakDays: number };
type Deck = { deck_name: string; card_count: number };

const QUALITY_BTNS = [
  { quality: 1, label: "Hard", icon: ThumbsDown, color: "border-red-200 text-red-600 hover:bg-red-50 hover:border-red-400" },
  { quality: 3, label: "OK",   icon: Minus,      color: "border-amber-200 text-amber-600 hover:bg-amber-50 hover:border-amber-400" },
  { quality: 5, label: "Easy", icon: ThumbsUp,   color: "border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-400" },
];

const DECK_COLORS = [
  "from-violet-500 to-purple-600",
  "from-sky-500 to-blue-600",
  "from-emerald-500 to-primary/80",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-indigo-500 to-blue-700",
];

export default function MyFlashcards() {
  const [stats, setStats]       = useState<Stats>({ total: 0, mastered: 0, due: 0, streakDays: 0 });
  const [decks, setDecks]       = useState<Deck[]>([]);
  const [reviewCards, setReviewCards] = useState<FlashcardWithProgress[]>([]);
  const [currentIdx, setCurrentIdx]   = useState(0);
  const [flipped, setFlipped]         = useState(false);
  const [mode, setMode]               = useState<"home" | "review" | "done">("home");
  const [selectedDeck, setSelectedDeck] = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionTotal, setSessionTotal]     = useState(0);
  const [rating, setRating] = useState(false);

  const loadStats = useCallback(async () => {
    const r = await apiFetch("/api/portal/flashcards/stats", { credentials: "include" });
    if (r.ok) setStats(await r.json());
  }, []);

  const loadDecks = useCallback(async () => {
    const r = await apiFetch("/api/portal/flashcards/decks", { credentials: "include" });
    if (r.ok) setDecks(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => { loadStats(); loadDecks(); }, [loadStats, loadDecks]);

  const startReview = async (deck?: string) => {
    setReviewLoading(true);
    setSelectedDeck(deck ?? null);
    const params = deck ? `?deck=${encodeURIComponent(deck)}` : "";
    const r = await apiFetch(`/api/portal/flashcards/review${params}`, { credentials: "include" });
    if (r.ok) {
      const cards = await r.json();
      if (!cards.length) { setMode("done"); setReviewLoading(false); return; }
      setReviewCards(cards);
      setCurrentIdx(0); setFlipped(false);
      setSessionCorrect(0); setSessionTotal(0);
      setMode("review");
    }
    setReviewLoading(false);
  };

  const handleRate = async (quality: number) => {
    if (rating) return;
    setRating(true);
    const card = reviewCards[currentIdx];
    await apiFetch(`/api/portal/flashcards/${card.id}/review`, {
      method: "POST", 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quality }),
    });
    if (quality >= 3) setSessionCorrect(c => c + 1);
    setSessionTotal(t => t + 1);
    await new Promise(res => setTimeout(res, 150));
    const next = currentIdx + 1;
    if (next >= reviewCards.length) { setMode("done"); loadStats(); }
    else { setCurrentIdx(next); setFlipped(false); }
    setRating(false);
  };

  const currentCard = reviewCards[currentIdx];
  const progress    = reviewCards.length > 0 ? (currentIdx / reviewCards.length) * 100 : 0;
  const masteryPct  = stats.total > 0 ? Math.round((stats.mastered / stats.total) * 100) : 0;

  // ── REVIEW MODE ──────────────────────────────────────────────────────────────
  if (mode === "review" && currentCard) {
    return (
      <div className="max-w-xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setMode("home")}
            className="gap-1.5 text-muted-foreground text-xs">
            <ArrowLeft className="h-3.5 w-3.5" />Exit
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{currentIdx + 1} / {reviewCards.length}</span>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
              {sessionCorrect} correct
            </span>
          </div>
        </div>

        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <motion.div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full"
            animate={{ width: `${progress}%` }} transition={{ duration: 0.4, ease: "easeOut" }} />
        </div>

        <div className="flex items-center gap-2">
          {currentCard.topic && <Badge variant="secondary" className="text-xs">{currentCard.topic}</Badge>}
          <Badge className={`text-xs ${currentCard.difficulty === "easy" ? "bg-emerald-100 text-emerald-700" : currentCard.difficulty === "hard" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
            {currentCard.difficulty}
          </Badge>
          {currentCard.reps > 0 && <span className="text-xs text-muted-foreground">Reviewed {currentCard.reps}×</span>}
        </div>

        {/* Flip card */}
        <AnimatePresence mode="wait">
          <motion.button
            key={currentIdx + (flipped ? "-back" : "-front")}
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: -90, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={() => setFlipped(f => !f)}
            className={`w-full min-h-[200px] rounded-2xl border-2 p-8 cursor-pointer transition-all active:scale-[0.98] flex flex-col justify-between text-left ${
              flipped
                ? "bg-gradient-to-br from-violet-50 to-indigo-50 border-violet-300 dark:from-violet-950/30 dark:to-indigo-950/30 dark:border-violet-700"
                : "bg-card border-border hover:border-primary/30 hover:shadow-md"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className={`text-xs font-bold uppercase tracking-widest ${flipped ? "text-violet-500" : "text-muted-foreground"}`}>
                {flipped ? "Answer" : "Question"}
              </span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${flipped ? "bg-violet-500 text-white" : "bg-muted text-muted-foreground"}`}>
                {flipped ? "A" : "Q"}
              </div>
            </div>
            {/* Image support */}
            {!flipped && currentCard.image_url && (
              <img
                src={currentCard.image_url}
                alt="Card image"
                className="mt-3 rounded-xl w-full max-h-40 object-contain border border-border/40"
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            )}
            {flipped && currentCard.back_image_url && (
              <img
                src={currentCard.back_image_url}
                alt="Answer image"
                className="mt-3 rounded-xl w-full max-h-40 object-contain border border-border/40"
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            )}
            <p className={`text-lg font-semibold leading-relaxed mt-4 ${flipped ? "text-violet-900 dark:text-violet-200" : "text-foreground"}`}>
              {flipped ? currentCard.back : currentCard.front}
            </p>
            {/* Exam-style hint */}
            {currentCard.exam_style && !flipped && (
              <div className="mt-3 flex items-center gap-1.5 text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1.5 rounded-lg w-fit">
                <span className="font-bold uppercase tracking-wide">Exam Style</span>
              </div>
            )}
            {!flipped && currentCard.hint && (
              <p className="text-xs text-muted-foreground/60 mt-2 italic">Hint: {currentCard.hint}</p>
            )}
            {!flipped && <p className="text-xs text-muted-foreground mt-6">Tap to reveal answer</p>}
          </motion.button>
        </AnimatePresence>

        <AnimatePresence>
          {flipped && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="space-y-3">
              <p className="text-xs text-center text-muted-foreground font-medium">How well did you know this?</p>
              <div className="grid grid-cols-3 gap-3">
                {QUALITY_BTNS.map(btn => (
                  <motion.button key={btn.quality} whileTap={{ scale: 0.95 }}
                    disabled={rating} onClick={() => handleRate(btn.quality)}
                    className={`flex flex-col items-center gap-1.5 py-4 rounded-xl border-2 font-medium text-sm transition-all disabled:opacity-50 ${btn.color}`}>
                    <btn.icon className="h-5 w-5" />{btn.label}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── DONE MODE ─────────────────────────────────────────────────────────────────
  if (mode === "done") {
    const accuracy = sessionTotal > 0 ? Math.round((sessionCorrect / sessionTotal) * 100) : 0;
    return (
      <div className="max-w-xl mx-auto space-y-5">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-5 shadow-lg">
            <Trophy className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-1">Session Complete!</h2>
          <p className="text-muted-foreground text-sm">
            {sessionTotal === 0 ? "No cards were due" : `You reviewed ${sessionTotal} card${sessionTotal !== 1 ? "s" : ""}`}
          </p>
        </motion.div>
        {sessionTotal > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Correct", val: sessionCorrect, color: "text-emerald-600" },
              { label: "Accuracy", val: `${accuracy}%`, color: "text-primary" },
              { label: "Reviewed", val: sessionTotal, color: "text-violet-600" },
            ].map(s => (
              <Card key={s.label} className="border border-border/50 text-center">
                <CardContent className="p-4">
                  <p className={`text-3xl font-bold ${s.color}`}>{s.val}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <div className="flex gap-3">
          <Button onClick={() => setMode("home")} variant="outline" className="flex-1 gap-2">
            <ArrowLeft className="h-4 w-4" />Back
          </Button>
          <Button onClick={() => startReview(selectedDeck ?? undefined)}
            className="flex-1 gap-2 bg-violet-600 hover:bg-violet-700">
            <RotateCcw className="h-4 w-4" />Review Again
          </Button>
        </div>
      </div>
    );
  }

  // ── HOME MODE ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
          <Brain className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Flashcards</h1>
          <p className="text-xs text-muted-foreground">Spaced repetition for maximum memory retention</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl skeleton" />)}</div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total", value: stats.total,   icon: Layers, bg: "bg-violet-100", color: "text-violet-600" },
            { label: "Mastered", value: stats.mastered, icon: Star, bg: "bg-amber-100", color: "text-amber-600" },
            { label: "Due Today", value: stats.due,  icon: Clock,  bg: "bg-sky-100", color: "text-sky-600" },
          ].map(s => (
            <Card key={s.label} className="border border-border/50">
              <CardContent className="p-3 flex flex-col items-center text-center gap-1.5">
                <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center`}>
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {stats.total > 0 && (
        <Card className="border border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-semibold">Overall Mastery</span>
              </div>
              <span className="text-sm font-bold text-emerald-600">{masteryPct}%</span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <motion.div className="h-full bg-gradient-to-r from-emerald-400 to-primary/80 rounded-full"
                initial={{ width: 0 }} animate={{ width: `${masteryPct}%` }}
                transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }} />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">{stats.mastered} of {stats.total} mastered</p>
          </CardContent>
        </Card>
      )}

      {stats.due > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-violet-200 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/20">
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500 flex items-center justify-center shadow-sm">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-violet-900 dark:text-violet-200">{stats.due} card{stats.due !== 1 ? "s" : ""} due</p>
                  <p className="text-xs text-violet-600 dark:text-violet-400">Review now to keep your streak!</p>
                </div>
              </div>
              <Button onClick={() => startReview()} disabled={reviewLoading}
                className="bg-violet-600 hover:bg-violet-700 gap-2 shrink-0">
                <Brain className="h-4 w-4" />{reviewLoading ? "Loading..." : "Start"}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div>
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Your Decks</h2>
        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl skeleton" />)}</div>
        ) : decks.length === 0 ? (
          <div className="text-center py-14">
            <Layers className="h-10 w-10 mx-auto mb-3 text-muted-foreground/20" />
            <p className="font-medium text-foreground mb-1">No flashcard decks yet</p>
            <p className="text-xs text-muted-foreground">Ask your teacher to add cards to get started</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {decks.map((deck, idx) => {
              const gradient = DECK_COLORS[idx % DECK_COLORS.length];
              return (
                <motion.div key={deck.deck_name}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.06 }}>
                  <button onClick={() => startReview(deck.deck_name)}
                    className="w-full group relative overflow-hidden rounded-2xl border border-border/50 bg-card hover:shadow-md transition-all text-left active:scale-[0.98]">
                    <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${gradient}`} />
                    <div className="p-4 flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm flex-shrink-0`}>
                        <BookOpen className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground truncate">{deck.deck_name}</p>
                        <p className="text-xs text-muted-foreground">{deck.card_count} card{deck.card_count !== 1 ? "s" : ""}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
