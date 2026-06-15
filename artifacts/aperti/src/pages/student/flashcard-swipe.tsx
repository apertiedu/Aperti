import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJSON, postJSON } from "@/lib/api";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { Check, X, Minus, RotateCcw, BookOpen, Flame, Layers } from "lucide-react";

type Confidence = "easy" | "medium" | "hard";
type Card = { id: number; front: string; back: string; subject?: string; tags?: string[] };

const CONFIDENCE_COLORS: Record<Confidence, string> = {
  easy: "#10B981",
  medium: "#F59E0B",
  hard: "#EF4444",
};

const CONFIDENCE_LABELS: Record<Confidence, string> = {
  easy: "Got it!",
  medium: "Almost",
  hard: "Again",
};

function SwipeCard({
  card,
  isTop,
  onSwipe,
}: {
  card: Card;
  isTop: boolean;
  onSwipe: (confidence: Confidence) => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-20, 0, 20]);
  const opacity = useTransform(x, [-200, -80, 0, 80, 200], [0, 1, 1, 1, 0]);

  const easyOpacity = useTransform(x, [0, 80, 150], [0, 0.8, 1]);
  const hardOpacity = useTransform(x, [-150, -80, 0], [1, 0.8, 0]);

  const handleDragEnd = (_: any, info: any) => {
    const threshold = 100;
    if (info.offset.x > threshold) {
      onSwipe("easy");
    } else if (info.offset.x < -threshold) {
      onSwipe("hard");
    } else {
      x.set(0);
    }
  };

  if (!isTop) {
    return (
      <div className="absolute inset-0 rounded-3xl bg-card border border-border/40 shadow-md scale-95 translate-y-2" />
    );
  }

  return (
    <motion.div
      style={{ x, rotate, opacity }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      className="absolute inset-0 cursor-grab active:cursor-grabbing select-none touch-none"
      whileTap={{ scale: 1.02 }}
    >
      {/* Confidence overlays */}
      <motion.div
        style={{ opacity: easyOpacity }}
        className="absolute top-6 right-6 z-10 bg-green-500 text-white px-4 py-2 rounded-xl text-sm font-bold rotate-12 pointer-events-none"
      >
        ✓ GOT IT
      </motion.div>
      <motion.div
        style={{ opacity: hardOpacity }}
        className="absolute top-6 left-6 z-10 bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-bold -rotate-12 pointer-events-none"
      >
        ✗ AGAIN
      </motion.div>

      {/* Card face */}
      <div
        onClick={() => setFlipped(!flipped)}
        className="w-full h-full bg-card border border-border/40 shadow-xl rounded-3xl p-8 flex flex-col items-center justify-center gap-4 overflow-hidden"
      >
        {card.subject && (
          <span className="text-xs font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full">
            {card.subject}
          </span>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={flipped ? "back" : "front"}
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: -90, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="text-center"
          >
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-3">
              {flipped ? "Answer" : "Question"}
            </p>
            <p className="text-lg font-semibold text-foreground leading-relaxed">
              {flipped ? card.back : card.front}
            </p>
          </motion.div>
        </AnimatePresence>

        <p className="text-xs text-muted-foreground/60 mt-4">
          {flipped ? "Swipe to rate" : "Tap to reveal answer"}
        </p>
      </div>
    </motion.div>
  );
}

// Visual confidence dots
function ConfidenceDots({ history }: { history: Confidence[] }) {
  const last12 = history.slice(-12);
  return (
    <div className="flex items-center gap-1.5 flex-wrap justify-center">
      {last12.map((c, i) => (
        <div
          key={i}
          style={{ background: CONFIDENCE_COLORS[c] }}
          className="w-2.5 h-2.5 rounded-full"
        />
      ))}
    </div>
  );
}

const LEARNING_MODES = [
  { value: "classic",           label: "Classic",           desc: "Review all cards in order" },
  { value: "exam",              label: "Exam Mode",         desc: "Timed — no peeking at hints" },
  { value: "rapid_review",      label: "Rapid Review",      desc: "Quick fire — 5s per card" },
  { value: "weakness_recovery", label: "Weakness Recovery", desc: "Focus on Hard-rated cards" },
  { value: "mastery_challenge", label: "Mastery Challenge", desc: "Only Mastered cards to confirm" },
] as const;
type LearningMode = typeof LEARNING_MODES[number]["value"];

export default function FlashcardSwipe() {
  const qc = useQueryClient();
  const [current, setCurrent] = useState(0);
  const [history, setHistory] = useState<Confidence[]>([]);
  const [session, setSession] = useState<{ card: Card; confidence: Confidence }[]>([]);
  const [finished, setFinished] = useState(false);
  const [learningMode, setLearningMode] = useState<LearningMode>("classic");
  const [showModeSelector, setShowModeSelector] = useState(false);

  const { data: cards = [], isLoading } = useQuery<Card[]>({
    queryKey: ["flashcards-swipe"],
    queryFn: () => fetchJSON("/flashcards?limit=20"),
  });

  const trackMutation = useMutation({
    mutationFn: ({ cardId, confidence }: { cardId: number; confidence: Confidence }) =>
      postJSON("/flashcards/track", { cardId, confidence }).catch(() => null),
  });

  const handleSwipe = (confidence: Confidence) => {
    const card = cards[current];
    if (!card) return;

    setHistory((h) => [...h, confidence]);
    setSession((s) => [...s, { card, confidence }]);
    trackMutation.mutate({ cardId: card.id, confidence });

    if (current + 1 >= cards.length) {
      setFinished(true);
    } else {
      setCurrent((c) => c + 1);
    }
  };

  const handleRating = (confidence: Confidence) => {
    handleSwipe(confidence);
  };

  const reset = () => {
    setCurrent(0);
    setHistory([]);
    setSession([]);
    setFinished(false);
    qc.invalidateQueries({ queryKey: ["flashcards-swipe"] });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6 text-center">
        <BookOpen className="w-14 h-14 text-primary/50" />
        <h2 className="text-xl font-bold text-foreground">No flashcards yet</h2>
        <p className="text-sm text-muted-foreground">Add cards from your CardStack to start reviewing.</p>
      </div>
    );
  }

  if (finished) {
    const easy = session.filter((s) => s.confidence === "easy").length;
    const medium = session.filter((s) => s.confidence === "medium").length;
    const hard = session.filter((s) => s.confidence === "hard").length;

    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 p-6 text-center pb-20">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center"
        >
          <Flame className="w-10 h-10 text-primary" />
        </motion.div>

        <div>
          <h2 className="text-2xl font-bold text-foreground">Session Complete!</h2>
          <p className="text-muted-foreground text-sm mt-1">{session.length} cards reviewed</p>
        </div>

        <div className="grid grid-cols-3 gap-4 w-full max-w-sm">
          {[
            { label: "Got it", value: easy, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/30" },
            { label: "Almost", value: medium, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30" },
            { label: "Again", value: hard, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/30" },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} rounded-2xl p-4 flex flex-col items-center gap-1`}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        <ConfidenceDots history={history} />

        <button
          onClick={reset}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-2xl font-semibold text-sm min-h-[44px]"
        >
          <RotateCcw className="w-4 h-4" />
          Study Again
        </button>
      </div>
    );
  }

  const remaining = cards.length - current;
  const progress = (current / cards.length) * 100;

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-foreground">Flashcards 3.0</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowModeSelector(v => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full hover:bg-primary/20 transition-colors">
              <Layers className="w-3 h-3" />
              {LEARNING_MODES.find(m => m.value === learningMode)?.label ?? "Classic"}
            </button>
            <span className="text-sm text-muted-foreground">
              {current + 1} / {cards.length}
            </span>
          </div>
        </div>

        {/* Learning mode selector */}
        <AnimatePresence>
          {showModeSelector && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              className="bg-card rounded-2xl border border-border/60 shadow-lg p-3 space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 pb-1">Learning Mode</p>
              {LEARNING_MODES.map(mode => (
                <button key={mode.value}
                  onClick={() => { setLearningMode(mode.value); setShowModeSelector(false); }}
                  className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                    learningMode === mode.value ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/40"
                  }`}>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{mode.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{mode.desc}</p>
                  </div>
                  {learningMode === mode.value && <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress bar */}
        <div className="bg-muted/40 rounded-full h-2 overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Confidence dots */}
        {history.length > 0 && <ConfidenceDots history={history} />}
      </div>

      {/* Card Stack */}
      <div className="flex-1 flex items-center justify-center px-5">
        <div className="relative w-full" style={{ height: "min(420px, 60vh)" }}>
          <AnimatePresence>
            {/* Show next card underneath */}
            {current + 1 < cards.length && (
              <SwipeCard
                key={`card-${current + 1}-behind`}
                card={cards[current + 1]}
                isTop={false}
                onSwipe={() => {}}
              />
            )}
            {/* Top card */}
            {current < cards.length && (
              <SwipeCard
                key={`card-${current}`}
                card={cards[current]}
                isTop={true}
                onSwipe={handleSwipe}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-5 pb-6 space-y-3">
        <p className="text-center text-xs text-muted-foreground">
          Swipe right = Got it · Swipe left = Again · Or tap below
        </p>
        <div className="grid grid-cols-3 gap-3">
          {(["hard", "medium", "easy"] as Confidence[]).map((c) => (
            <button
              key={c}
              onClick={() => handleRating(c)}
              className="flex flex-col items-center gap-1 py-3 rounded-2xl border-2 transition-all min-h-[64px]"
              style={{ borderColor: CONFIDENCE_COLORS[c], color: CONFIDENCE_COLORS[c] }}
            >
              {c === "easy" && <Check className="w-5 h-5" />}
              {c === "medium" && <Minus className="w-5 h-5" />}
              {c === "hard" && <X className="w-5 h-5" />}
              <span className="text-xs font-semibold">{CONFIDENCE_LABELS[c]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
