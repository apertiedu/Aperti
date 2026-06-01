import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Star, Send, CheckCircle2, MessageSquare, Users, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PENDING_REVIEWS = [
  {
    id: "pr1",
    subject: "Physics 0625",
    assignment: "Lab Report: Measuring g",
    dueDate: "2026-06-05",
    wordCount: 420,
    excerpt: "In this experiment, I measured the acceleration due to gravity using a simple pendulum. My result of 9.76 m/s² is close to the accepted value…",
  },
  {
    id: "pr2",
    subject: "Math 0580",
    assignment: "Problem Set: Calculus",
    dueDate: "2026-06-07",
    wordCount: 180,
    excerpt: "For question 3, I used integration by substitution where u = x² + 1, giving du = 2x dx. The integral then becomes…",
  },
];

const RECEIVED_REVIEWS = [
  { id: "rr1", reviewer: "Anonymous", assignment: "Essay: Biodiversity", rating: 4, comment: "Well-structured argument. Your examples from the Amazon are compelling. Consider adding more quantitative data to support your claims.", date: "2026-05-30" },
  { id: "rr2", reviewer: "Anonymous", assignment: "Problem Set: Vectors", rating: 5, comment: "Clear working shown throughout. The diagram on question 4 was particularly helpful.", date: "2026-05-25" },
];

function StarRating({ rating, onRate }: { rating: number; onRate: (r: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onRate(s)}
          className="transition-transform hover:scale-110"
        >
          <Star
            className={`h-6 w-6 ${(hover || rating) >= s ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"} transition-colors`}
          />
        </button>
      ))}
    </div>
  );
}

function ReviewPanel({ review, onSubmit }: { review: (typeof PENDING_REVIEWS)[0]; onSubmit: () => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const { toast } = useToast();

  const handleSubmit = () => {
    if (rating === 0) { toast({ title: "Please add a rating", variant: "destructive" }); return; }
    if (comment.trim().length < 20) { toast({ title: "Add a comment (min 20 chars)", variant: "destructive" }); return; }
    toast({ title: "Review submitted!", description: "Your feedback has been sent anonymously." });
    onSubmit();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base">{review.assignment}</CardTitle>
              <CardDescription>{review.subject} · {review.wordCount} words</CardDescription>
            </div>
            <Badge variant="outline" className="text-[10px]">
              <Clock className="h-3 w-3 mr-1" />
              Due {new Date(review.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="p-4 rounded-xl bg-muted/40 border border-border text-sm text-muted-foreground italic leading-relaxed mb-4">
            "{review.excerpt}"
            <span className="text-primary ml-1 not-italic font-medium">[read more]</span>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Overall rating</p>
              <StarRating rating={rating} onRate={setRating} />
              {rating > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {["", "Needs improvement", "Below average", "Average", "Good", "Excellent!"][rating]}
                </p>
              )}
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Your feedback</p>
              <Textarea
                placeholder="Be constructive and specific. What worked well? What could be improved? (min 20 characters)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                className="resize-none text-sm"
              />
              <p className="text-[10px] text-muted-foreground mt-1">{comment.length} chars · Reviews are anonymous</p>
            </div>

            <Button className="w-full gap-2" onClick={handleSubmit}>
              <Send className="h-4 w-4" /> Submit Review
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function PeerReview() {
  const [activeReview, setActiveReview] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<Set<string>>(new Set());

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } };
  const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">PeerReview<span className="text-primary"></span></h1>
        </div>
        <p className="text-muted-foreground">Give and receive guided peer feedback — all anonymous.</p>
      </motion.div>

      <Tabs defaultValue="give">
        <TabsList className="mb-6">
          <TabsTrigger value="give" className="gap-2">
            <MessageSquare className="h-4 w-4" /> Reviews to Give
            {PENDING_REVIEWS.filter((r) => !submitted.has(r.id)).length > 0 && (
              <Badge className="ml-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                {PENDING_REVIEWS.filter((r) => !submitted.has(r.id)).length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="received" className="gap-2">
            <Star className="h-4 w-4" /> Feedback Received
          </TabsTrigger>
        </TabsList>

        <TabsContent value="give">
          {activeReview ? (
            <>
              <Button variant="ghost" size="sm" className="mb-4 gap-2 text-xs" onClick={() => setActiveReview(null)}>
                ← Back to list
              </Button>
              <ReviewPanel
                review={PENDING_REVIEWS.find((r) => r.id === activeReview)!}
                onSubmit={() => {
                  setSubmitted((prev) => new Set([...prev, activeReview]));
                  setActiveReview(null);
                }}
              />
            </>
          ) : (
            <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
              {PENDING_REVIEWS.map((review) => (
                <motion.div key={review.id} variants={item}>
                  <Card className={`card-hover ${submitted.has(review.id) ? "opacity-60" : ""}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{review.assignment}</p>
                          <p className="text-xs text-muted-foreground">{review.subject}</p>
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-2 italic">"{review.excerpt}"</p>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <Badge variant="outline" className="text-[10px]">
                            Due {new Date(review.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </Badge>
                          {submitted.has(review.id) ? (
                            <div className="flex items-center gap-1 text-emerald-600 text-xs">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Submitted
                            </div>
                          ) : (
                            <Button size="sm" className="h-7 text-xs" onClick={() => setActiveReview(review.id)}>
                              Review
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
              {PENDING_REVIEWS.every((r) => submitted.has(r.id)) && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-12"
                >
                  <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-3" />
                  <p className="font-semibold">All reviews complete!</p>
                  <p className="text-muted-foreground text-sm">+200 XP earned for your contributions.</p>
                </motion.div>
              )}
            </motion.div>
          )}
        </TabsContent>

        <TabsContent value="received">
          <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
            {RECEIVED_REVIEWS.map((review) => (
              <motion.div key={review.id} variants={item}>
                <Card className="card-hover">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback className="bg-muted text-xs">Anon</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-semibold text-muted-foreground">Anonymous Reviewer</p>
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star key={s} className={`h-3.5 w-3.5 ${s <= review.rating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"}`} />
                            ))}
                          </div>
                        </div>
                        <p className="text-xs font-medium text-primary mb-1">{review.assignment}</p>
                        <p className="text-sm text-foreground/80 leading-relaxed">{review.comment}</p>
                        <p className="text-[10px] text-muted-foreground mt-2">{new Date(review.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
