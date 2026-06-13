import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/context/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Send, MessageSquare, Calendar, CheckCheck, Clock, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

const TEAL = "#0D9488";
const authFetch = (url: string, opts?: RequestInit) =>
  fetch(url, { ...opts, credentials: "include", headers: { "Content-Type": "application/json", ...(opts?.headers || {}) } });

interface Conversation { other_id: number; other_name: string; last_msg: string; last_time: string; unread_count: number; }
interface Message { id: number; message: string; read: string; created_at: string; from_account_id: number; to_account_id: number; from_name: string; to_name: string; }

export default function GuardianLink() {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<{ id: number; name: string } | null>(null);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [], isLoading: loadingConvos } = useQuery<Conversation[]>({
    queryKey: ["parent-messages-list"],
    queryFn: () => authFetch("/api/parent/messages").then(r => r.json()),
    refetchInterval: 15000,
  });

  const { data: teachers = [] } = useQuery<any[]>({
    queryKey: ["parent-teachers"],
    queryFn: () => authFetch("/api/parent/teachers").then(r => r.json()),
  });

  const { data: thread = [], isLoading: loadingThread } = useQuery<Message[]>({
    queryKey: ["parent-messages-thread", selected?.id],
    queryFn: () => authFetch(`/api/parent/messages?teacherId=${selected!.id}`).then(r => r.json()),
    enabled: !!selected,
    refetchInterval: 8000,
  });

  const sendMutation = useMutation({
    mutationFn: (message: string) => authFetch("/api/parent/messages", { method: "POST", body: JSON.stringify({ toAccountId: selected!.id, message }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parent-messages-thread", selected?.id] });
      qc.invalidateQueries({ queryKey: ["parent-messages-list"] });
      setInput("");
    },
    onError: () => toast({ title: "Failed to send", variant: "destructive" }),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  // Merge conversations with teachers who haven't messaged yet
  const allTeachers = [...teachers].filter(t => !conversations.find(c => c.other_id === t.id));

  const myAccountId = user?.id ?? null;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto h-[calc(100vh-4rem)] flex flex-col gap-4">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${TEAL}15` }}>
          <MessageSquare className="h-5 w-5" style={{ color: TEAL }} />
        </div>
        <div>
          <h1 className="text-xl font-black text-gray-900">GuardianLink<span style={{ color: TEAL }}>.</span></h1>
          <p className="text-sm text-gray-500">Direct messaging with teachers</p>
        </div>
      </motion.div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 min-h-0">
        {/* Conversation list */}
        <div className={`md:col-span-1 flex flex-col gap-3 ${selected ? "hidden md:flex" : "flex"}`}>
          <Card className="border border-gray-100 shadow-sm flex-1 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Teachers</p>
            </div>
            <ScrollArea className="h-[calc(100%-56px)]">
              {loadingConvos ? (
                <div className="p-3 space-y-2">{[0,1,2].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
              ) : (
                <div>
                  {conversations.map(c => (
                    <button key={c.other_id} onClick={() => setSelected({ id: c.other_id, name: c.other_name })}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-gray-50 last:border-0 hover:bg-gray-50 ${selected?.id === c.other_id ? "bg-teal-50" : ""}`}>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: TEAL }}>
                        {(c.other_name || "T").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-gray-900 truncate">{c.other_name}</p>
                          {c.unread_count > 0 && <Badge className="h-4 w-4 p-0 flex items-center justify-center text-[9px] shrink-0 bg-teal-500 text-white">{c.unread_count}</Badge>}
                        </div>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{c.last_msg}</p>
                      </div>
                    </button>
                  ))}
                  {allTeachers.map(t => (
                    <button key={t.id} onClick={() => setSelected({ id: t.id, name: t.display_name })}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-gray-50 last:border-0 hover:bg-gray-50 ${selected?.id === t.id ? "bg-teal-50" : ""}`}>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: "#9ca3af" }}>
                        {(t.display_name || "T").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{t.display_name}</p>
                        <p className="text-[10px] text-gray-400">{t.subject_name || "Teacher"} · Start conversation</p>
                      </div>
                    </button>
                  ))}
                  {!conversations.length && !allTeachers.length && (
                    <div className="p-8 text-center text-gray-400 text-sm">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      No linked teachers yet
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </Card>
        </div>

        {/* Chat thread */}
        <div className={`md:col-span-2 flex flex-col min-h-0 ${!selected ? "hidden md:flex" : "flex"}`}>
          {selected ? (
            <Card className="flex-1 flex flex-col overflow-hidden border border-gray-100 shadow-sm">
              {/* Header */}
              <div className="flex items-center gap-3 p-4 border-b border-gray-100 shrink-0">
                <button onClick={() => setSelected(null)} className="md:hidden p-1 rounded-lg hover:bg-gray-100"><ArrowLeft className="h-4 w-4 text-gray-500" /></button>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: TEAL }}>
                  {(selected.name || "T").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{selected.name}</p>
                </div>
                <Link href="/parent/meetings">
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1 rounded-lg">
                    <Calendar className="h-3 w-3" /> Schedule
                  </Button>
                </Link>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                {loadingThread ? (
                  <div className="space-y-3">{[0,1,2].map(i => <Skeleton key={i} className="h-12 rounded-2xl w-3/4" />)}</div>
                ) : thread.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-12 text-gray-400">
                    <MessageSquare className="h-10 w-10 mb-3 opacity-20" />
                    <p className="text-sm">No messages yet. Start the conversation below.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {thread.map((msg) => {
                      const isMe = msg.from_account_id === myAccountId;
                      return (
                        <motion.div key={msg.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                          className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                          {!isMe && (
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold mr-2 shrink-0 mt-1" style={{ background: TEAL }}>
                              {(msg.from_name || "T").slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 ${isMe ? "text-white" : "bg-gray-100 text-gray-800"}`}
                            style={{ background: isMe ? TEAL : undefined }}>
                            <p className="text-sm leading-relaxed">{msg.message}</p>
                            <div className={`flex items-center gap-1 mt-1 text-[9px] ${isMe ? "text-white/70 justify-end" : "text-gray-400"}`}>
                              <Clock className="h-2.5 w-2.5" />
                              {new Date(msg.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                              {isMe && <CheckCheck className="h-2.5 w-2.5 ml-0.5" />}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Input */}
              <div className="p-3 border-t border-gray-100 shrink-0">
                <form onSubmit={(e) => { e.preventDefault(); if (input.trim()) sendMutation.mutate(input.trim()); }}
                  className="flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={`Message ${selected.name}…`}
                    className="flex-1 text-sm rounded-xl"
                    disabled={sendMutation.isPending}
                  />
                  <Button type="submit" disabled={!input.trim() || sendMutation.isPending} size="icon" className="rounded-xl" style={{ background: TEAL }}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </Card>
          ) : (
            <Card className="flex-1 flex items-center justify-center border border-gray-100 shadow-sm">
              <div className="text-center text-gray-400">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Select a teacher to start messaging</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
