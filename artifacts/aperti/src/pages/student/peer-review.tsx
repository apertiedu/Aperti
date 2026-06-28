import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Star, Send, CheckCircle2, MessageSquare, Users, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

function StarRating({ rating, onRate }: { rating: number; onRate: (r: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Star rating">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onRate(s)}
          className="transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary rounded"
          aria-label={`${s} star${s > 1 ? "s" : ""}`}
          aria-pressed={(hover || rating) >= s}
        >
          <Star
            className={`h-6 w-6 ${(hover || rating) >= s ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"} transition-colors`}
          />
        </button>
      ))}
    </div>
  );
}

export default function PeerReview() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeReview, setActiveReview] = useState<number | null>(null);
  const [ratings, setRatings] = useState<Record<number, number>>({});
  const [comments, setComments] = useState<Record<number, string>>({});

  const { data: pending = [], isLoading: pendingLoading } = useQuery<any[]>({
    queryKey: ["peer-reviews", "available"],
    queryFn: () => apiFetch("/api/peer-reviews/available").then((r) => r.json()),
  });

  const { data: received = [], isLoading: receivedLoading } = useQuery<any[]>({
    queryKey: ["peer-reviews", "received"],
    queryFn: () => apiFetch("/api/peer-reviews/received").then((r) => r.json()),
  });

  const submitMutation = useMutation({
    mutationFn: ({ submissionId, rating, comment }: { submissionId: number; rating: number; comment: string }) =>
      apiFetch("/api/peer-review/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, rating, comment }),
      }).then((r) => r.json()),
    onSuccess: () => {
      toast({ title: "Review submitted", description: "Your feedback has been submitted." });
      queryClient.invalidateQueries({ queryKey: ["peer-reviews"] });
      setActiveReview(null);
    },
    onError: () => {
      toast({ title: "Failed to submit", description: "Please try again.", variant: "destructive" });
    },
  });

  const pendingCount = pending.length;

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">Peer Review</h1>
          {pendingCount > 0 && (
            <Badge variant="default">{pendingCount} pending</Badge>
          )}
        </div>
        <p className="text-muted-foreground mt-1">Review your peers' work and see feedback on yours.</p>
      </motion.div>

      <Tabs defaultValue="pending">
        <TabsList className="mb-6">
          <TabsTrigger value="pending">
            <Clock className="h-4 w-4 mr-2" />
            To Review
            {pendingCount > 0 && (
              <Badge className="ml-2 h-4 w-4 p-0 flex items-center justify-center text-[10px]" aria-label={`${pendingCount} pending`}>
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="received">
            <MessageSquare className="h-4 w-4 mr-2" />
            Received
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {pendingLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Card key={i} className="animate-pulse h-32" />
              ))}
            </div>
          ) : pending.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
                <p className="font-medium text-lg">All caught up!</p>
                <p className="text-muted-foreground text-sm">No pending peer reviews right now.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {pending.map((sub: any) => (
                <Card key={sub.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base">Submission #{sub.id}</CardTitle>
                        <CardDescription>
                          Submitted {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : "recently"}
                        </CardDescription>
                      </div>
                      <Badge variant="outline">Awaiting your review</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {activeReview === sub.id ? (
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm font-medium mb-2">Your rating</p>
                          <StarRating
                            rating={ratings[sub.id] ?? 0}
                            onRate={(r) => setRatings((prev) => ({ ...prev, [sub.id]: r }))}
                          />
                        </div>
                        <Textarea
                          placeholder="Write constructive feedback..."
                          value={comments[sub.id] ?? ""}
                          onChange={(e) => setComments((prev) => ({ ...prev, [sub.id]: e.target.value }))}
                          rows={4}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              submitMutation.mutate({
                                submissionId: sub.id,
                                rating: ratings[sub.id] ?? 0,
                                comment: comments[sub.id] ?? "",
                              })
                            }
                            disabled={!ratings[sub.id] || !comments[sub.id]?.trim() || submitMutation.isPending}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Submit
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setActiveReview(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="sm" onClick={() => setActiveReview(sub.id)}>
                        Start Review
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="received">
          {receivedLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Card key={i} className="animate-pulse h-28" />
              ))}
            </div>
          ) : received.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <Users className="h-12 w-12 text-muted-foreground" />
                <p className="font-medium text-lg">No feedback yet</p>
                <p className="text-muted-foreground text-sm">Peer reviews of your work will appear here.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {received.map((review: any) => (
                <Card key={review.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>P</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <p className="font-medium text-sm">Anonymous</p>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`h-4 w-4 ${s <= (review.rating ?? 0) ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"}`}
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">
                          {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : ""}
                        </p>
                        <p className="text-sm text-foreground">{review.comment}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
