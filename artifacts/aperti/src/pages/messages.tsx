import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  MessageSquare, Send, Plus, Megaphone, Search, Users, Inbox,
} from "lucide-react";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const API = "/api";
const tok = () => localStorage.getItem("aperti_token");
async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(`${API}${url}`, {
    ...opts,
    headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

function timeAgo(ts: string) {
  const d = Date.now() - new Date(ts).getTime();
  if (d < 60000) return "just now";
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export default function Messages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("inbox");
  const [selectedConv, setSelectedConv] = useState<any | null>(null);
  const [reply, setReply] = useState("");
  const [search, setSearch] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [compose, setCompose] = useState({ to_account_id: "", subject: "", body: "" });
  const [annForm, setAnnForm] = useState({ title: "", body: "", audience: "all", subject_id: "" });
  const [annDialogOpen, setAnnDialogOpen] = useState(false);

  const { data: conversations, isLoading: convLoading } = useQuery<any[]>({
    queryKey: ["messages", "conversations"],
    queryFn: () => apiFetch("/messages/conversations"),
  });

  const { data: thread, isLoading: threadLoading } = useQuery<any[]>({
    queryKey: ["messages", "thread", selectedConv?.other_id],
    queryFn: () => apiFetch(`/messages/thread/${selectedConv.other_id}`),
    enabled: !!selectedConv,
    refetchInterval: 10000,
  });

  const { data: contacts } = useQuery<any[]>({
    queryKey: ["messages", "contacts"],
    queryFn: () => apiFetch("/messages/contacts"),
  });

  const { data: announcements } = useQuery<any[]>({
    queryKey: ["announcements"],
    queryFn: () => apiFetch("/announcements"),
  });

  const { data: subjects } = useQuery<any[]>({
    queryKey: ["subjects"],
    queryFn: () => apiFetch("/subjects"),
  });

  const convList: any[] = Array.isArray(conversations) ? conversations : [];
  const threadList: any[] = Array.isArray(thread) ? thread : [];
  const contactList: any[] = Array.isArray(contacts) ? contacts : [];
  const annList: any[] = Array.isArray(announcements) ? announcements : [];
  const subjectList: any[] = Array.isArray(subjects) ? subjects : [];

  const filtered = convList.filter(c =>
    c.other_name?.toLowerCase().includes(search.toLowerCase()),
  );

  const sendMsg = useMutation({
    mutationFn: (body: string) =>
      apiFetch("/messages", { method: "POST", body: JSON.stringify({ to_account_id: selectedConv.other_id, body }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", "thread", selectedConv?.other_id] });
      queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
      setReply("");
    },
  });

  const sendCompose = useMutation({
    mutationFn: () => apiFetch("/messages", { method: "POST", body: JSON.stringify({ to_account_id: parseInt(compose.to_account_id), subject: compose.subject, body: compose.body }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
      setComposeOpen(false);
      setCompose({ to_account_id: "", subject: "", body: "" });
      toast({ title: "Message sent!" });
    },
  });

  const sendAnn = useMutation({
    mutationFn: () => apiFetch("/announcements", { method: "POST", body: JSON.stringify({ ...annForm, subject_id: annForm.subject_id || null }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      setAnnDialogOpen(false);
      setAnnForm({ title: "", body: "", audience: "all", subject_id: "" });
      toast({ title: "Announcement sent!" });
    },
  });

  function handleReply(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey && reply.trim()) {
      e.preventDefault();
      sendMsg.mutate(reply.trim());
    }
  }

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Messages</h1>
          <p className="text-muted-foreground text-sm">Communicate with students, parents and colleagues.</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={annDialogOpen} onOpenChange={setAnnDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2"><Megaphone className="h-4 w-4" /> Announcement</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Send Announcement</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2">
                <div className="space-y-1.5"><Label>Title</Label><Input value={annForm.title} onChange={e => setAnnForm(f => ({ ...f, title: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label>Message</Label><Textarea rows={4} value={annForm.body} onChange={e => setAnnForm(f => ({ ...f, body: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Audience</Label>
                    <Select value={annForm.audience} onValueChange={v => setAnnForm(f => ({ ...f, audience: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All students</SelectItem>
                        <SelectItem value="parents">Parents only</SelectItem>
                        <SelectItem value="subject">By subject</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Subject (optional)</Label>
                    <Select value={annForm.subject_id} onValueChange={v => setAnnForm(f => ({ ...f, subject_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All</SelectItem>
                        {subjectList.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button className="w-full" disabled={!annForm.title || !annForm.body || sendAnn.isPending} onClick={() => sendAnn.mutate()}>
                  {sendAnn.isPending ? "Sending…" : "Send Announcement"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> New Message</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Compose Message</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2">
                <div className="space-y-1.5">
                  <Label>To</Label>
                  <Select value={compose.to_account_id} onValueChange={v => setCompose(f => ({ ...f, to_account_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select recipient…" /></SelectTrigger>
                    <SelectContent>
                      {contactList.map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.display_name} <span className="text-muted-foreground text-xs">({c.role})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Subject (optional)</Label><Input value={compose.subject} onChange={e => setCompose(f => ({ ...f, subject: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label>Message</Label><Textarea rows={4} value={compose.body} onChange={e => setCompose(f => ({ ...f, body: e.target.value }))} /></div>
                <Button className="w-full" disabled={!compose.to_account_id || !compose.body || sendCompose.isPending} onClick={() => sendCompose.mutate()}>
                  {sendCompose.isPending ? "Sending…" : "Send"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="inbox" className="gap-2"><Inbox className="h-4 w-4" /> Inbox</TabsTrigger>
          <TabsTrigger value="announcements" className="gap-2"><Megaphone className="h-4 w-4" /> Announcements</TabsTrigger>
        </TabsList>

        <TabsContent value="inbox">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-280px)] min-h-[500px]">
            {/* Conversation list */}
            <Card className="overflow-hidden">
              <CardHeader className="pb-2 border-b">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search…" className="pl-8 h-8 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
              </CardHeader>
              <ScrollArea className="h-full">
                {convLoading ? (
                  <div className="p-3 space-y-2">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
                ) : filtered.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No conversations yet
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {filtered.map((c: any) => (
                      <button
                        key={c.other_id}
                        onClick={() => setSelectedConv(c)}
                        className={cn(
                          "w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors",
                          selectedConv?.other_id === c.other_id ? "bg-primary/10" : "hover:bg-muted/50",
                        )}
                      >
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarFallback className="text-xs">{c.other_name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium truncate">{c.other_name}</p>
                            <span className="text-[10px] text-muted-foreground shrink-0 ml-1">{c.last_at ? timeAgo(c.last_at) : ""}</span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{c.last_body}</p>
                        </div>
                        {c.unread && <div className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </Card>

            {/* Thread */}
            <Card className="lg:col-span-2 flex flex-col overflow-hidden">
              {!selectedConv ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                  <div className="text-center">
                    <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p>Select a conversation</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="border-b px-4 py-3 flex items-center gap-3 shrink-0">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">{selectedConv.other_name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{selectedConv.other_name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{selectedConv.other_role}</p>
                    </div>
                  </div>
                  <ScrollArea className="flex-1 px-4 py-3">
                    <div className="space-y-3">
                      {threadLoading ? [1, 2].map(i => <Skeleton key={i} className="h-12 rounded-xl" />) :
                        threadList.map((m: any) => {
                          const isMe = m.from_account_id !== selectedConv.other_id;
                          return (
                            <div key={m.id} className={cn("flex gap-2", isMe ? "justify-end" : "justify-start")}>
                              <div className={cn("max-w-[70%] rounded-2xl px-3 py-2 text-sm", isMe ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted rounded-tl-sm")}>
                                <p className="whitespace-pre-wrap">{m.body}</p>
                                <p className={cn("text-[10px] mt-1", isMe ? "text-primary-foreground/60 text-right" : "text-muted-foreground")}>{timeAgo(m.created_at)}</p>
                              </div>
                            </div>
                          );
                        })
                      }
                    </div>
                  </ScrollArea>
                  <div className="border-t p-3 flex items-end gap-2 shrink-0">
                    <Textarea
                      rows={1}
                      placeholder="Type a message… Enter to send"
                      className="resize-none text-sm"
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      onKeyDown={handleReply}
                    />
                    <Button size="icon" className="h-9 w-9 shrink-0" disabled={!reply.trim() || sendMsg.isPending} onClick={() => sendMsg.mutate(reply.trim())}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="announcements">
          <div className="space-y-3">
            {annList.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center text-muted-foreground">
                  <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No announcements sent yet</p>
                  <p className="text-sm mt-1">Use the Announcement button to broadcast a message to all students or parents.</p>
                </CardContent>
              </Card>
            ) : (
              annList.map((a: any) => (
                <Card key={a.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{a.title}</p>
                        <p className="text-sm text-muted-foreground mt-1">{a.body}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary" className="text-xs capitalize">{a.audience}</Badge>
                          {a.subject_name && <Badge variant="outline" className="text-xs">{a.subject_name}</Badge>}
                          <span className="text-xs text-muted-foreground">{a.sent_at ? timeAgo(a.sent_at) : timeAgo(a.created_at)}</span>
                        </div>
                      </div>
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Megaphone className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
