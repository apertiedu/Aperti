import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, Check, X, RefreshCw } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";
const token = () => localStorage.getItem("aperti_token");

async function fetchJSON(url: string, options?: RequestInit) {
  const res = await fetch(`${API}${url}`, {
    headers: { Authorization: `Bearer ${token()}`, ...(options?.headers || {}) },
    ...options,
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

interface Deck { id: number; title: string; description: string | null; }
interface CardItem { id: number; front: string; back: string; difficulty: string; }

export default function MyCardStack() {
  const [selectedDeckId, setSelectedDeckId] = useState<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);

  const { data: decks, isLoading: decksLoading } = useQuery<Deck[]>({
    queryKey: ["flashcards", "student", "decks"],
    queryFn: () => fetchJSON("/flashcards/student/decks"),
  });

  const { data: cards, isLoading: cardsLoading } = useQuery<CardItem[]>({
    queryKey: ["flashcards", "decks", selectedDeckId, "cards"],
    queryFn: () => fetchJSON(`/flashcards/decks/${selectedDeckId}/cards`),
    enabled: !!selectedDeckId,
  });

  const queryClient = useQueryClient();
  const reviewMutation = useMutation({
    mutationFn: ({ cardId, quality }: { cardId: number; quality: number }) =>
      fetch(`${API}/flashcards/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ cardId, quality }),
      }),
  });

  const currentCard = cards?.[currentIndex];

  const handleReview = (quality: number) => {
    if (!currentCard) return;
    reviewMutation.mutate({ cardId: currentCard.id, quality });
    setShowBack(false);
    if (currentIndex < (cards?.length ?? 0) - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setCurrentIndex(0); // loop back
    }
  };

  if (!selectedDeckId) {
    return (
      <div className="min-h-screen bg-background p-6 page-transition">
        <h1 className="text-3xl font-bold mb-8">CardStack<span className="text-primary">™</span></h1>
        {decksLoading ? (
          <div className="grid grid-cols-2 gap-4">{[1,2].map(i=><Skeleton key={i} className="h-24 rounded-xl"/>)}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {decks?.map(deck => (
              <motion.div key={deck.id} whileHover={{ y: -2 }} onClick={() => setSelectedDeckId(deck.id)} className="cursor-pointer">
                <Card className="card-hover h-full">
                  <CardHeader><CardTitle>{deck.title}</CardTitle></CardHeader>
                  <CardContent><p className="text-sm text-muted-foreground">{deck.description || "No description"}</p></CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 page-transition flex flex-col items-center">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => { setSelectedDeckId(null); setCurrentIndex(0); setShowBack(false); }}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to decks
          </Button>
          <Badge variant="secondary">{currentIndex + 1} / {cards?.length ?? 0}</Badge>
        </div>

        <Progress value={cards ? ((currentIndex + 1) / cards.length) * 100 : 0} className="h-1 mb-6" />

        <AnimatePresence mode="wait">
          {cardsLoading ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : currentCard ? (
            <motion.div
              key={currentCard.id + (showBack ? "-back" : "-front")}
              initial={{ opacity: 0, rotateY: showBack ? -90 : 90 }}
              animate={{ opacity: 1, rotateY: 0 }}
              exit={{ opacity: 0, rotateY: showBack ? 90 : -90 }}
              transition={{ duration: 0.3 }}
              onClick={() => setShowBack(!showBack)}
              className="cursor-pointer"
            >
              <Card className="card-hover min-h-[300px] flex items-center justify-center p-8 text-center">
                <p className="text-xl font-medium">{showBack ? currentCard.back : currentCard.front}</p>
              </Card>
            </motion.div>
          ) : (
            <Card className="card-hover min-h-[300px] flex items-center justify-center">
              <p className="text-muted-foreground">No cards in this deck yet.</p>
            </Card>
          )}
        </AnimatePresence>

        <div className="flex justify-center gap-3 mt-6">
          <Button variant="outline" size="lg" onClick={() => handleReview(1)}><X className="h-5 w-5 text-destructive" /></Button>
          <Button variant="outline" size="lg" onClick={() => handleReview(3)}><RefreshCw className="h-5 w-5" /></Button>
          <Button variant="outline" size="lg" onClick={() => handleReview(5)}><Check className="h-5 w-5 text-primary" /></Button>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-3">Tap card to flip · Rate your recall</p>
      </div>
    </div>
  );
}
