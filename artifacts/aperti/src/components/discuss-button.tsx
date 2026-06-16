import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Send, Sparkles, ChevronRight, Loader2 } from "lucide-react";
import { useAuth } from "@/context/auth";

const fetchJSON = (url: string) =>
  fetch(url, { credentials: "include" }).then((r) => r.json());
const postJSON = (url: string, body: unknown) =>
  fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());

type Message = {
  id: number; sender_name: string; sender_id: number;
  content: string; created_at: string; ai_generated: boolean;
};

interface DiscussButtonProps {
  contextType: "assignment" | "exam" | "lesson" | "course" | "homework";
  contextId: number;
  contextTitle?: string;
  size?: "sm" | "md";
  variant?: "inline" | "compact";
}

export default function DiscussButton({
  contextType, contextId, contextTitle, size = "md", variant = "inline",
}: DiscussButtonProps) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [compose, setCompose] = useState("");
  const [threadId, setThreadId] = useState<number | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiHint, setAiHint] = useState("");

  // Look up an existing thread for this context
  const { data: existingThread, isLoading: lookingUp } = useQuery({
    queryKey: ["discuss-thread", contextType, contextId],
    queryFn: async () => {
      const threads = await fetchJSON("/api/messages/threads");
      if (!Array.isArray(threads)) return null;
      return threads.find(
        (t: any) => t.context_type === contextType && t.context_id === contextId,
      ) ?? null;
    },
    enabled: open && !!user,
    staleTime: 30000,
  });

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["discuss-msgs", threadId ?? existingThread?.id],
    queryFn: () => fetchJSON(`/api/messages/threads/${threadId ?? existingThread?.id}`).then((d) => d.messages ?? []),
    enabled: !!(threadId || existingThread?.id),
    refetchInterval: 5000,
  });

  const activeThreadId = threadId ?? existingThread?.id ?? null;

  const createMutation = useMutation({
    mutationFn: () =>
      postJSON("/api/messages/threads", {
        type: "class",
        title: contextTitle ? `Discuss: ${contextTitle}` : `Discuss ${contextType} #${contextId}`,
        context_type: contextType,
        context_id: contextId,
        recipient_ids: [],
      }),
    onSuccess: (thread) => {
      setThreadId(thread.id);
      qc.invalidateQueries({ queryKey: ["discuss-thread", contextType, contextId] });
    },
  });

  const sendMutation = useMutation({
    mutationFn: (tid: number) =>
      postJSON(`/api/messages/threads/${tid}/messages`, { content: compose }),
    onSuccess: () => {
      setCompose("");
      qc.invalidateQueries({ queryKey: ["discuss-msgs", activeThreadId] });
    },
  });

  async function handleOpen() {
    setOpen(true);
    if (!existingThread && !threadId) {
      const thread = await createMutation.mutateAsync();
      setThreadId(thread.id);
    }
  }

  async function handleSend() {
    if (!compose.trim() || !activeThreadId) return;
    await sendMutation.mutateAsync(activeThreadId);
  }

  async function handleAiHint() {
    setAiLoading(true);
    setAiHint("");
    try {
      const r = await fetch("/api/coremind/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Give me a helpful hint or explanation for ${contextType} "${contextTitle || contextId}". Keep it concise (2-3 sentences).`,
          context: `Context type: ${contextType}, ID: ${contextId}`,
        }),
      });
      if (r.ok) {
        const d = await r.json();
        setAiHint(d.reply ?? d.response ?? "");
      }
    } catch {
      setAiHint("AI hints are available when OpenAI is configured.");
    }
    setAiLoading(false);
  }

  const btnSize = size === "sm"
    ? "px-2.5 py-1.5 text-xs gap-1"
    : "px-3 py-2 text-xs gap-1.5";

  if (!user) return null;

  return (
    <>
      <button
        onClick={handleOpen}
        className={`inline-flex items-center ${btnSize} font-medium rounded-xl bg-primary/8 text-primary hover:bg-primary/15 border border-primary/20 transition-colors`}
      >
        <MessageSquare className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
        Discuss
        {variant === "inline" && messages.length > 0 && (
          <span className="bg-primary text-primary-foreground rounded-full text-[10px] px-1.5 py-0.5 leading-none">
            {messages.length}
          </span>
        )}
      </button>

      {/* Floating panel */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 bg-black/20 z-40"
            />
            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              className="fixed bottom-6 right-6 z-50 w-96 bg-card rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden font-[Inter,sans-serif]"
              style={{ maxHeight: "480px" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  <div>
                    <p className="text-sm font-semibold">
                      {contextTitle ? `Discuss: ${contextTitle}` : `Discuss ${contextType} #${contextId}`}
                    </p>
                    <p className="text-[10px] text-primary-foreground/70 capitalize">{contextType} thread</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setOpen(false); navigate("/inbox"); }}
                    className="text-[10px] text-primary-foreground/70 hover:text-primary-foreground flex items-center gap-0.5 transition-colors"
                  >
                    Open in Inbox <ChevronRight className="w-3 h-3" />
                  </button>
                  <button onClick={() => setOpen(false)} className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* AI Hint */}
              {aiHint && (
                <div className="px-4 py-2 bg-purple-50 border-b border-purple-100 flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-purple-800 leading-relaxed">{aiHint}</p>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {lookingUp || createMutation.isPending ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">No messages yet.</p>
                    <p className="text-xs text-muted-foreground">Start the discussion!</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.sender_id === user?.id;
                    return (
                      <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex-shrink-0 flex items-center justify-center">
                          {msg.ai_generated ? (
                            <Sparkles className="w-3 h-3 text-purple-600" />
                          ) : (
                            <span className="text-[9px] font-bold text-primary">{msg.sender_name[0]}</span>
                          )}
                        </div>
                        <div className={`max-w-[75%] flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}>
                          {!isMe && (
                            <span className="text-[10px] text-muted-foreground/60">{msg.sender_name}</span>
                          )}
                          <div className={`px-3 py-2 rounded-xl text-xs shadow-sm ${isMe ? "bg-primary text-primary-foreground" : msg.ai_generated ? "bg-purple-50 dark:bg-purple-950/30 text-purple-900 dark:text-purple-300 border border-purple-100 dark:border-purple-800" : "bg-muted text-foreground"}`}>
                            {msg.content}
                          </div>
                          <span className="text-[9px] text-muted-foreground/40">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Compose */}
              <div className="px-3 pb-3 pt-2 border-t border-border">
                <div className="flex gap-2 items-end">
                  <button
                    onClick={handleAiHint}
                    disabled={aiLoading}
                    title="Get AI hint"
                    className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors flex-shrink-0 disabled:opacity-50"
                  >
                    {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  </button>
                  <input
                    value={compose}
                    onChange={(e) => setCompose(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
                    placeholder="Ask a question or share a thought…"
                    className="flex-1 text-xs px-3 py-2 border border-border bg-background text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!compose.trim() || !activeThreadId || sendMutation.isPending}
                    className="p-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-all flex-shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
