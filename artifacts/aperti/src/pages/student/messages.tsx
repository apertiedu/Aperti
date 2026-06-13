import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Send, Bell, Calendar, ChevronRight, Flag, Ban } from "lucide-react";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";
import { ReportModal } from "@/components/ReportModal";


async function fetchJSON(url: string) {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}
async function postJSON(url: string, body: object) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}
async function deleteReq(url: string) {
  const res = await fetch(url, {
    method: "DELETE",
    headers: {},
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

function ThreadView({ threadId, onBack }: { threadId: number; onBack: () => void }) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [report, setReport] = useState<{ id: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: threadData, isLoading } = useQuery({
    queryKey: ["messages", "thread", threadId],
    queryFn: () => fetchJSON(`/api/messages/threads/${threadId}`),
    refetchInterval: 5000,
    select: (d) => d.messages ?? [],
  });
  const messages = threadData ?? [];

  const { data: blockedIds = [] } = useQuery<number[]>({
    queryKey: ["safety", "blocked"],
    queryFn: () => fetchJSON("/api/safety/blocked"),
  });

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      postJSON(`/api/messages/threads/${threadId}/send`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", "thread", threadId] });
      setText("");
    },
    onError: () => toast({ title: "Failed to send message", variant: "destructive" }),
  });

  const blockMutation = useMutation({
    mutationFn: (userId: number) => postJSON(`/api/safety/block/${userId}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["safety", "blocked"] });
      toast({ title: "User blocked", description: "Their messages are now hidden." });
    },
    onError: () => toast({ title: "Failed to block user", variant: "destructive" }),
  });

  const unblockMutation = useMutation({
    mutationFn: (userId: number) => deleteReq(`/api/safety/block/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["safety", "blocked"] });
      toast({ title: "User unblocked" });
    },
    onError: () => toast({ title: "Failed to unblock user", variant: "destructive" }),
  });

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && text.trim()) {
      e.preventDefault();
      sendMutation.mutate(text.trim());
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      <div className="flex items-center gap-3 mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-1 text-muted-foreground"
          aria-label="Back to thread list"
        >
          ← Back
        </Button>
        <p className="font-semibold text-sm">Thread #{threadId}</p>
      </div>

      <Card className="flex-1 flex flex-col shadow-sm overflow-hidden">
        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
          <div
            className="flex-1 overflow-y-auto p-4 space-y-3"
            aria-live="polite"
            aria-label="Message thread"
            role="log"
          >
            {isLoading ? (
              <Skeleton className="h-20 rounded-xl" />
            ) : (
              (messages ?? []).map((msg: any) => {
                const isMe = msg.senderId === user?.id;
                const isBlocked = !isMe && blockedIds.includes(msg.senderId);
                if (isBlocked) return null;
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-2 group ${isMe ? "justify-end" : ""}`}
                  >
                    {!isMe && (
                      <Avatar className="h-7 w-7 shrink-0" aria-hidden="true">
                        <AvatarFallback className="text-[10px] bg-muted">U</AvatarFallback>
                      </Avatar>
                    )}
                    <div className={`rounded-2xl px-3 py-2 max-w-[75%] text-sm relative ${isMe ? "bg-primary text-white" : "bg-muted"}`}>
                      <p className="leading-relaxed">{msg.content}</p>
                      <p className={`text-[10px] mt-0.5 ${isMe ? "text-white/70" : "text-muted-foreground"}`}>
                        {msg.sentAt
                          ? new Date(msg.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : ""}
                      </p>
                    </div>
                    {!isMe && (
                      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setReport({ id: msg.id })}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                          aria-label="Report this message"
                          title="Report message"
                        >
                          <Flag className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            blockedIds.includes(msg.senderId)
                              ? unblockMutation.mutate(msg.senderId)
                              : blockMutation.mutate(msg.senderId)
                          }
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-orange-500 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                          aria-label={blockedIds.includes(msg.senderId) ? "Unblock sender" : "Block sender"}
                          title={blockedIds.includes(msg.senderId) ? "Unblock" : "Block"}
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    {isMe && (
                      <Avatar className="h-7 w-7 shrink-0" aria-hidden="true">
                        <AvatarFallback className="text-[10px] bg-primary text-white">ME</AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                );
              })
            )}
            <div ref={scrollRef} />
          </div>

          <div className="p-3 border-t flex gap-2" role="form" aria-label="Send message">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message…"
              onKeyDown={handleKey}
              className="flex-1 text-sm"
              aria-label="Message input"
            />
            <Button
              size="sm"
              onClick={() => text.trim() && sendMutation.mutate(text.trim())}
              disabled={!text.trim() || sendMutation.isPending}
              aria-label="Send message"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <ReportModal
        open={report !== null}
        onClose={() => setReport(null)}
        targetType="message"
        targetId={report?.id ?? ""}
      />
    </div>
  );
}

export default function StudentMessages() {
  const [selectedThread, setSelectedThread] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: threads, isLoading: threadsLoading } = useQuery({
    queryKey: ["messages", "threads"],
    queryFn: () => fetchJSON("/api/messages/threads"),
    refetchInterval: 10_000,
  });

  const { data: announcements, isLoading: announcementsLoading } = useQuery({
    queryKey: ["student", "announcements"],
    queryFn: () => fetchJSON("/api/student/announcements"),
  });

  const { data: calendar } = useQuery({
    queryKey: ["student", "calendar"],
    queryFn: () => fetchJSON("/api/student/calendar"),
  });

  const newThreadMutation = useMutation({
    mutationFn: ({ participantIds, subject }: { participantIds: number[]; subject: string }) =>
      postJSON("/api/messages/threads", { participantIds, subject }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["messages", "threads"] });
      setSelectedThread(data.id);
    },
    onError: () => toast({ title: "Failed to create conversation", variant: "destructive" }),
  });

  void newThreadMutation;

  if (selectedThread !== null) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] dark:bg-background p-4 md:p-6">
        <ThreadView threadId={selectedThread} onBack={() => setSelectedThread(null)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] dark:bg-background p-4 md:p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center" aria-hidden="true">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Communication Center</h1>
            <p className="text-muted-foreground text-sm">Messages, announcements, and your schedule.</p>
          </div>
        </div>
      </motion.div>

      <Tabs defaultValue="messages">
        <TabsList className="mb-5" aria-label="Communication tabs">
          <TabsTrigger value="messages" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" /> Messages
            {(threads ?? []).length > 0 && (
              <Badge className="h-4 min-w-4 text-[9px] p-0 flex items-center justify-center" aria-label={`${(threads ?? []).length} threads`}>
                {(threads ?? []).length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="announcements" className="gap-1.5">
            <Bell className="h-3.5 w-3.5" aria-hidden="true" /> Announcements
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1.5">
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" /> Schedule
          </TabsTrigger>
        </TabsList>

        <TabsContent value="messages">
          <div className="space-y-3" role="list" aria-label="Message threads">
            {threadsLoading ? (
              [1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)
            ) : (threads ?? []).length === 0 ? (
              <Card className="shadow-sm">
                <CardContent className="p-8 text-center">
                  <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3" aria-hidden="true" />
                  <p className="font-medium mb-1">No conversations yet</p>
                  <p className="text-sm text-muted-foreground">Your teacher can send you messages here.</p>
                </CardContent>
              </Card>
            ) : (
              (threads ?? []).map((thread: any) => (
                <motion.div key={thread.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} role="listitem">
                  <Card
                    className="shadow-sm hover:shadow-md transition-shadow cursor-pointer focus-within:ring-2 focus-within:ring-primary"
                    onClick={() => setSelectedThread(thread.id)}
                  >
                    <CardContent className="p-4 flex items-center gap-4">
                      <Avatar className="h-10 w-10 shrink-0" aria-hidden="true">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                          {thread.subject?.slice(0, 2).toUpperCase() ?? "??"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{thread.subject ?? "Conversation"}</p>
                        <p className="text-xs text-muted-foreground">
                          {thread.lastMessageAt
                            ? new Date(thread.lastMessageAt).toLocaleDateString()
                            : "No messages"}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="announcements">
          <div className="space-y-3" aria-live="polite">
            {announcementsLoading ? (
              [1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)
            ) : (announcements ?? []).length === 0 ? (
              <Card className="shadow-sm">
                <CardContent className="p-8 text-center text-muted-foreground text-sm">
                  No announcements yet.
                </CardContent>
              </Card>
            ) : (
              (announcements ?? []).map((a: any) => (
                <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <p className="font-semibold text-sm">{a.title}</p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {a.subject_name && (
                            <Badge variant="secondary" className="text-[10px]">{a.subject_name}</Badge>
                          )}
                          <Badge variant="outline" className="text-[10px] capitalize">{a.audience}</Badge>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{a.body}</p>
                      <p className="text-[11px] text-muted-foreground mt-2">
                        {a.sent_at
                          ? new Date(a.sent_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
                          : "Not yet sent"}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="calendar">
          <div className="space-y-3">
            {(calendar?.events ?? []).length === 0 ? (
              <Card className="shadow-sm">
                <CardContent className="p-8 text-center text-muted-foreground text-sm">
                  No upcoming events.
                </CardContent>
              </Card>
            ) : (
              (calendar?.events ?? []).map((event: any, i: number) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Card className="shadow-sm">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex flex-col items-center justify-center shrink-0" aria-hidden="true">
                        <p className="text-[10px] font-bold text-primary">
                          {event.date ? new Date(event.date).toLocaleDateString("en-US", { month: "short" }) : ""}
                        </p>
                        <p className="text-sm font-extrabold text-primary leading-none">
                          {event.date ? new Date(event.date).getDate() : ""}
                        </p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{event.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {event.time ?? ""} {event.type ? `· ${event.type}` : ""}
                        </p>
                      </div>
                      {event.type && (
                        <Badge variant="secondary" className="text-[10px] capitalize shrink-0">
                          {event.type}
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
