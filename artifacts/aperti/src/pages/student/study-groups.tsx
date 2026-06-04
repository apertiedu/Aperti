import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Users, Plus, ChevronRight, Trophy, Swords, UserPlus, Star, Flag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ReportModal } from "@/components/ReportModal";

const token = () => localStorage.getItem("aperti_token");
async function fetchJSON(url: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}
async function postJSON(url: string, body: object) {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 240, damping: 24 } } };

function CreateGroupDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () => postJSON("/api/study-groups", { name: name.trim(), description: description.trim() }),
    onSuccess: () => {
      toast({ title: "Group created!" });
      setOpen(false);
      setName(""); setDescription("");
      onCreated();
    },
    onError: () => toast({ title: "Failed to create group", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" aria-label="Create a new study group">
          <Plus className="h-4 w-4" aria-hidden="true" /> Create Group
        </Button>
      </DialogTrigger>
      <DialogContent aria-label="Create study group dialog">
        <DialogHeader>
          <DialogTitle>Create Study Group</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <Input
            placeholder="Group name (e.g. Physics Study Squad)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Group name"
          />
          <Textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            aria-label="Group description"
          />
          <Button
            className="w-full"
            onClick={() => mutation.mutate()}
            disabled={!name.trim() || mutation.isPending}
          >
            {mutation.isPending ? "Creating…" : "Create Group"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GroupDetail({ groupId, onBack }: { groupId: number; onBack: () => void }) {
  const { data: group, isLoading: gLoading } = useQuery({
    queryKey: ["study-groups", groupId],
    queryFn: () => fetchJSON(`/api/study-groups/${groupId}`),
  });
  const { data: members, isLoading: mLoading } = useQuery({
    queryKey: ["study-groups", groupId, "members"],
    queryFn: () => fetchJSON(`/api/study-groups/${groupId}/members`),
  });
  const { data: challenges } = useQuery({
    queryKey: ["study-groups", groupId, "challenges"],
    queryFn: () => fetchJSON(`/api/study-groups/${groupId}/challenges`),
  });

  const [reportTarget, setReportTarget] = useState<{ id: string; type: "user" | "group" } | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-1 text-muted-foreground hover:text-foreground"
          aria-label="Back to groups list"
        >
          ← Back
        </Button>
        <div>
          {gLoading ? (
            <Skeleton className="h-6 w-40" />
          ) : (
            <h2 className="text-lg font-bold">{group?.name}</h2>
          )}
          {group?.description && <p className="text-sm text-muted-foreground">{group.description}</p>}
        </div>
        {group && (
          <button
            onClick={() => setReportTarget({ id: String(groupId), type: "group" })}
            className="ml-auto p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Report this group"
            title="Report group"
          >
            <Flag className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" aria-hidden="true" /> Members ({(members ?? []).length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mLoading ? (
              <Skeleton className="h-20 rounded-xl" />
            ) : (members ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No members yet.</p>
            ) : (
              <div className="space-y-2">
                {(members ?? []).map((m: any) => (
                  <div key={m.id} className="flex items-center gap-3 group">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold" aria-hidden="true">
                      {String(m.studentId).slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Member #{m.studentId}</p>
                      <p className="text-[11px] text-muted-foreground capitalize">{m.role}</p>
                    </div>
                    {m.role === "admin" && <Badge variant="secondary" className="text-[10px]">Admin</Badge>}
                    <button
                      onClick={() => setReportTarget({ id: String(m.studentId), type: "user" })}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:opacity-100"
                      aria-label={`Report member #${m.studentId}`}
                      title="Report member"
                    >
                      <Flag className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Swords className="h-4 w-4 text-primary" aria-hidden="true" /> Challenges
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(challenges ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No challenges yet.</p>
            ) : (
              <div className="space-y-2">
                {(challenges ?? []).map((c: any) => (
                  <div key={c.id} className="p-3 rounded-xl bg-muted/50 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{c.title}</p>
                      <p className="text-[11px] text-muted-foreground capitalize">{c.type}</p>
                    </div>
                    <Badge
                      variant={c.status === "open" ? "default" : "secondary"}
                      className="text-[10px] capitalize"
                    >
                      {c.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ReportModal
        open={reportTarget !== null}
        onClose={() => setReportTarget(null)}
        targetType={reportTarget?.type === "group" ? "group" : "user"}
        targetId={reportTarget?.id ?? ""}
      />
    </div>
  );
}

export default function StudyGroups() {
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [reportTarget, setReportTarget] = useState<{ id: number } | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: groups, isLoading } = useQuery({
    queryKey: ["study-groups"],
    queryFn: () => fetchJSON("/api/study-groups"),
  });

  const { data: peerAssignments } = useQuery({
    queryKey: ["peer-review", "assignments"],
    queryFn: () => fetchJSON("/api/peer-review/assignments"),
  });

  const joinMutation = useMutation({
    mutationFn: (groupId: number) => postJSON(`/api/study-groups/${groupId}/join`, {}),
    onSuccess: () => {
      toast({ title: "Joined group!" });
      queryClient.invalidateQueries({ queryKey: ["study-groups"] });
      setJoinCode("");
    },
    onError: () => toast({ title: "Failed to join group", variant: "destructive" }),
  });

  const peerReviewMutation = useMutation({
    mutationFn: ({ submissionId, rating, comment }: { submissionId: number; rating: number; comment: string }) =>
      postJSON("/api/peer-review/submit", { submissionId, rating, comment }),
    onSuccess: () => {
      toast({ title: "Review submitted!" });
      queryClient.invalidateQueries({ queryKey: ["peer-review", "assignments"] });
    },
    onError: () => toast({ title: "Failed to submit review", variant: "destructive" }),
  });

  if (selectedGroup !== null) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] dark:bg-background p-4 md:p-6">
        <GroupDetail groupId={selectedGroup} onBack={() => setSelectedGroup(null)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] dark:bg-background p-4 md:p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center" aria-hidden="true">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Social Learning</h1>
              <p className="text-muted-foreground text-sm">Study groups, peer challenges, and collaborative reviews.</p>
            </div>
          </div>
          <CreateGroupDialog onCreated={() => queryClient.invalidateQueries({ queryKey: ["study-groups"] })} />
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div>
            <h2 className="font-semibold text-base mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" aria-hidden="true" /> My Study Groups
            </h2>
            {isLoading ? (
              <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
            ) : (groups ?? []).length === 0 ? (
              <Card className="shadow-sm">
                <CardContent className="p-8 text-center">
                  <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" aria-hidden="true" />
                  <p className="font-medium mb-1">No study groups yet</p>
                  <p className="text-sm text-muted-foreground">Create a group or join one with a code.</p>
                </CardContent>
              </Card>
            ) : (
              <motion.div variants={container} initial="hidden" animate="show" className="space-y-3" role="list">
                {(groups ?? []).map((g: any) => (
                  <motion.div key={g.id} variants={item} role="listitem">
                    <Card
                      className="shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                      onClick={() => setSelectedGroup(g.id)}
                    >
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0" aria-hidden="true">
                          {g.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{g.name}</p>
                          {g.description && <p className="text-xs text-muted-foreground truncate">{g.description}</p>}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setReportTarget({ id: g.id }); }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:opacity-100"
                          aria-label={`Report group ${g.name}`}
                          title="Report group"
                        >
                          <Flag className="h-3.5 w-3.5" />
                        </button>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>

          <div>
            <h2 className="font-semibold text-base mb-3 flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" aria-hidden="true" /> Peer Review Queue
            </h2>
            {(peerAssignments ?? []).length === 0 ? (
              <Card className="shadow-sm">
                <CardContent className="p-6 text-center text-muted-foreground text-sm">
                  No peer reviews available right now.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {(peerAssignments ?? []).slice(0, 5).map((a: any) => (
                  <PeerReviewCard
                    key={a.submissionId}
                    assignment={a}
                    onSubmit={(rating, comment) =>
                      peerReviewMutation.mutate({ submissionId: a.submissionId, rating, comment })
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-primary" aria-hidden="true" /> Join a Group
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Input
                placeholder="Enter group ID number"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                type="number"
                aria-label="Group ID to join"
              />
              <Button
                className="w-full"
                size="sm"
                onClick={() => joinCode && joinMutation.mutate(parseInt(joinCode))}
                disabled={!joinCode || joinMutation.isPending}
                aria-label="Join group"
              >
                {joinMutation.isPending ? "Joining…" : "Join Group"}
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" aria-hidden="true" /> Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">Top performers this week</p>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => (window.location.href = "/peak-rankings")}
                aria-label="View Peak Rankings leaderboard"
              >
                View Peak Rankings →
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <ReportModal
        open={reportTarget !== null}
        onClose={() => setReportTarget(null)}
        targetType="group"
        targetId={reportTarget?.id ?? ""}
      />
    </div>
  );
}

function PeerReviewCard({
  assignment,
  onSubmit,
}: {
  assignment: any;
  onSubmit: (rating: number, comment: string) => void;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-sm font-medium">Anonymous Submission</p>
            <p className="text-xs text-muted-foreground">
              {assignment.homeworkTitle ?? "Assignment"} · Submitted{" "}
              {assignment.submittedAt ? new Date(assignment.submittedAt).toLocaleDateString() : "recently"}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="text-xs h-7"
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse review form" : "Open review form"}
          >
            {expanded ? "Collapse" : "Review"}
          </Button>
        </div>
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              <div>
                <p className="text-xs font-medium mb-1" id="peer-rating-label">Rating</p>
                <div className="flex gap-1" role="radiogroup" aria-labelledby="peer-rating-label">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <button
                      key={i}
                      onClick={() => setRating(i)}
                      className={`text-lg focus:outline-none focus:ring-2 focus:ring-primary rounded ${i <= rating ? "text-yellow-500" : "text-muted-foreground"}`}
                      aria-label={`${i} star${i > 1 ? "s" : ""}`}
                      aria-pressed={i <= rating}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
              <Textarea
                placeholder="Write your feedback…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                className="text-sm"
                aria-label="Your feedback"
              />
              <Button
                size="sm"
                className="w-full text-xs"
                onClick={() => onSubmit(rating, comment)}
                disabled={!rating}
                aria-label="Submit peer review"
              >
                Submit Review
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
