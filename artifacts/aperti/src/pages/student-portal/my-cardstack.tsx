import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft, Check, X, RefreshCw, Layers, Clock, BarChart3,
  BookOpen, TrendingUp, ChevronRight, Zap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MathRenderer } from "@/components/math-renderer";

const tok = () => localStorage.getItem("aperti_token") || "";

interface Deck {
  id: number;
  title: string;
  description: string | null;
  createdAt: string;
}
interface CardItem {
  id: number;
  front: string;
  back: string;
  difficulty: string | null;
}
interface Progress2 {
  cardId: number;
  masteryLevel: string;
  nextReview: string;
  repetitions: number;
}

const MASTERY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  new:        { label: "New",        color: "#6B7280", bg: "#F3F4F6" },
  learning:   { label: "Learning",   color: "#2563EB", bg: "#EFF6FF" },
  mastered:   { label: "Mastered",   color: "#059669", bg: "#ECFDF5" },
  struggling: { label: "Struggling", color: "#DC2626", bg: "#FEF2F2" },
};

function DifficultyDot({ d }: { d: string | null }) {
  const colors: Record<string, string> = { easy: "#10B981", medium: "#F59E0B", hard: "#EF4444" };
  return (
    <span className="inline-block h-2 w-2 rounded-full ml-1.5"
      style={{ background: colors[d || "medium"] || colors.medium }} />
  );
}

export default function MyCardStack() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [reviewed, setReviewed] = useState<Record<number, number>>({});
  const [view, setView] = useState<"decks" | "study" | "analytics">("decks");

  const { data: decks, isLoading: decksLoading } = useQuery<Deck[]>({
    queryKey: ["flashcards", "student", "decks"],
    queryFn: async () => {
      const res = await fetch("/api/flashcards/student/decks", {
        headers: { Authorization: `Bearer ${tok()}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: smartStats } = useQuery({
    queryKey: ["flashcards", "smart-stats"],
    queryFn: async () => {
      const res = await fetch("/api/flashcards/smart-stats", {
        headers: { Authorization: `Bearer ${tok()}` },
      });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60_000,
  });

  const { data: cards, isLoading: cardsLoading } = useQuery<CardItem[]>({
    queryKey: ["flashcards", "decks", selectedDeck?.id, "cards"],
    queryFn: async () => {
      const res = await fetch(`/api/flashcards/decks/${selectedDeck!.id}/cards`, {
        headers: { Authorization: `Bearer ${tok()}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedDeck?.id,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ cardId, quality }: { cardId: number; quality: number }) =>
      fetch("/api/flashcards/review", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok()}` },
        body: JSON.stringify({ cardId, quality }),
      }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["flashcards"] }),
  });

  const handleReview = (quality: number) => {
    const card = cards?.[currentIndex];
    if (!card) return;
    reviewMutation.mutate({ cardId: card.id, quality });
    setReviewed((prev) => ({ ...prev, [card.id]: quality }));
    setShowBack(false);
    if (currentIndex < (cards?.length ?? 0) - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      toast({ title: "Deck complete! 🎉", description: "All cards reviewed." });
      setCurrentIndex(0);
    }
  };

  const openDeck = (deck: Deck) => {
    setSelectedDeck(deck);
    setCurrentIndex(0);
    setShowBack(false);
    setReviewed({});
    setView("study");
  };

  const goBack = () => {
    setSelectedDeck(null);
    setView("decks");
    setCurrentIndex(0);
    setShowBack(false);
  };

  const currentCard = cards?.[currentIndex];
  const reviewedCount = Object.keys(reviewed).length;
  const totalCards = cards?.length || 0;
  const masteredCount = Object.values(reviewed).filter((q) => q >= 4).length;
  const strugglingCount = Object.values(reviewed).filter((q) => q <= 1).length;

  if (view === "decks") {
    return (
      <div className="min-h-screen bg-[#F8FAFB] px-4 py-6 max-w-4xl mx-auto" style={{ fontFamily: "Inter, sans-serif" }}>
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <Layers className="h-4.5 w-4.5 text-blue-600" style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-900">Flashcard Hub</h1>
              <p className="text-xs text-gray-500">Spaced repetition for deep retention</p>
            </div>
          </div>
          {smartStats?.stats && (
            <div className="grid grid-cols-4 gap-2 mb-2">
              {[
                { label: "Total Cards", value: smartStats.stats.total_cards ?? 0, color: "#6366F1" },
                { label: "Mastery", value: `${smartStats.stats.mastery_pct ?? 0}%`, color: "#0D9488" },
                { label: "Due Review", value: smartStats.stats.due_review ?? 0, color: "#F59E0B" },
                { label: "Weak Cards", value: smartStats.stats.weak_cards ?? 0, color: "#EF4444" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
                  <p className="text-lg font-black" style={{ color }}>{value}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {decksLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
          </div>
        ) : !decks?.length ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <Layers className="h-10 w-10 mx-auto mb-3 text-gray-200" />
            <p className="font-bold text-gray-700">No flashcard decks yet</p>
            <p className="text-sm text-gray-400 mt-1">Your teacher will assign decks soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {decks.map((deck, i) => (
              <motion.div
                key={deck.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                whileHover={{ y: -3, boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}
                onClick={() => openDeck(deck)}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-blue-600" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-teal-600 transition-colors" />
                </div>
                <h3 className="font-bold text-gray-900 text-sm mb-1 line-clamp-1">{deck.title}</h3>
                <p className="text-xs text-gray-400 line-clamp-2 mb-3">{deck.description || "No description"}</p>
                <div className="flex items-center justify-between">
                  <Button size="sm" className="h-8 text-xs rounded-xl gap-1.5" style={{ background: "#0D9488" }}>
                    <Zap className="h-3 w-3" /> Study
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFB] px-4 py-6 max-w-lg mx-auto" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={goBack} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to decks
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => setView("analytics")}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700">
            <BarChart3 className="h-4 w-4" />
          </button>
          <Badge variant="secondary" className="text-xs">{currentIndex + 1} / {totalCards}</Badge>
        </div>
      </div>

      <h2 className="font-bold text-gray-900 text-base mb-4 text-center">{selectedDeck?.title}</h2>

      {/* Progress bar */}
      <div className="mb-5">
        <div className="flex justify-between text-xs text-gray-400 mb-1.5">
          <span>{reviewedCount} reviewed</span>
          <span>{masteredCount} mastered · {strugglingCount} to retry</span>
        </div>
        <Progress value={totalCards ? (reviewedCount / totalCards) * 100 : 0} className="h-2 rounded-full" />
      </div>

      {/* Card */}
      <AnimatePresence mode="wait">
        {cardsLoading ? (
          <Skeleton className="h-64 w-full rounded-2xl" />
        ) : currentCard ? (
          <motion.div
            key={currentCard.id + (showBack ? "-b" : "-f")}
            initial={{ opacity: 0, rotateY: showBack ? -60 : 60, scale: 0.95 }}
            animate={{ opacity: 1, rotateY: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={() => setShowBack(!showBack)}
            className="cursor-pointer"
            style={{ perspective: 1000 }}
          >
            <div className={`min-h-[260px] rounded-2xl border shadow-sm flex flex-col items-center justify-center p-8 text-center transition-colors ${
              showBack ? "bg-teal-50 border-teal-100" : "bg-white border-gray-100"
            }`}>
              <div className="mb-3">
                {showBack ? (
                  <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider px-2 py-0.5 bg-teal-100 rounded-full">Answer</span>
                ) : (
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 py-0.5 bg-gray-100 rounded-full">Question</span>
                )}
              </div>
              <div className={`text-lg font-bold leading-relaxed ${showBack ? "text-teal-800" : "text-gray-900"}`}>
                <MathRenderer content={showBack ? currentCard.back : currentCard.front} />
              </div>
              {currentCard.difficulty && (
                <div className="mt-4 flex items-center gap-1 text-xs text-gray-400">
                  Difficulty: <DifficultyDot d={currentCard.difficulty} />
                  <span className="capitalize ml-1">{currentCard.difficulty}</span>
                </div>
              )}
              {!showBack && (
                <p className="text-[11px] text-gray-300 mt-4">Tap to reveal answer</p>
              )}
            </div>
          </motion.div>
        ) : (
          <div className="min-h-[260px] bg-white rounded-2xl border border-gray-100 flex items-center justify-center">
            <p className="text-gray-400 text-sm">No cards in this deck yet.</p>
          </div>
        )}
      </AnimatePresence>

      {/* Rating buttons */}
      <AnimatePresence>
        {showBack && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-5 space-y-3">
            <p className="text-xs text-center text-gray-500 font-medium">How well did you know this?</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { quality: 1, label: "Again", icon: X, color: "border-red-200 hover:bg-red-50 text-red-600" },
                { quality: 3, label: "Hard", icon: RefreshCw, color: "border-amber-200 hover:bg-amber-50 text-amber-600" },
                { quality: 5, label: "Easy", icon: Check, color: "border-emerald-200 hover:bg-emerald-50 text-emerald-600" },
              ].map(({ quality, label, icon: Icon, color }) => (
                <button key={quality} onClick={() => handleReview(quality)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 bg-white transition-all ${color}`}>
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-semibold">{label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!showBack && currentCard && (
        <div className="flex justify-center mt-5">
          <Button onClick={() => setShowBack(true)} variant="outline" className="gap-2 rounded-xl text-sm">
            Show Answer
          </Button>
        </div>
      )}

      {/* Analytics overlay */}
      <AnimatePresence>
        {view === "analytics" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4"
            onClick={() => setView("study")}>
            <motion.div initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mb-16">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-teal-600" /> Session Analytics
                </h3>
                <button onClick={() => setView("study")} className="text-gray-400 hover:text-gray-700">✕</button>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { label: "Reviewed", value: reviewedCount, color: "#0D9488" },
                  { label: "Mastered", value: masteredCount, color: "#059669" },
                  { label: "Retry", value: strugglingCount, color: "#EF4444" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="text-center p-3 bg-gray-50 rounded-xl">
                    <p className="text-2xl font-black" style={{ color }}>{value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs mb-1 text-gray-500">
                  <span>Session progress</span>
                  <span>{totalCards > 0 ? Math.round((reviewedCount / totalCards) * 100) : 0}%</span>
                </div>
                <Progress value={totalCards ? (reviewedCount / totalCards) * 100 : 0} className="h-3 rounded-full" />
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-xl p-3">
                <TrendingUp className="h-4 w-4 text-teal-600 shrink-0" />
                <span>Spaced repetition schedules your next review automatically.</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
