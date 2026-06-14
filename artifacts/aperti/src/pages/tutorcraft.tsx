import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sparkles, Send, User, BookOpen,
  ClipboardList, MessageSquare, FileText, RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

const API = "/api";

interface Message {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

const QUICK_PROMPTS = [
  { icon: <BookOpen className="h-4 w-4" />, label: "Lesson plan", prompt: "Create a 60-minute lesson plan for A-Level Physics on Newton's Laws of Motion. Include starter, main activities, and a plenary." },
  { icon: <ClipboardList className="h-4 w-4" />, label: "Exam questions", prompt: "Write 5 CAIE-style exam questions on the Water Cycle for IGCSE Geography, ranging from 1-mark recall to 6-mark extended response." },
  { icon: <MessageSquare className="h-4 w-4" />, label: "Student feedback", prompt: "Help me write constructive feedback for a student who clearly understands the theory but makes careless arithmetic errors in calculations." },
  { icon: <FileText className="h-4 w-4" />, label: "Mark scheme", prompt: "Generate a mark scheme for this question: 'Explain how enzymes lower the activation energy of a reaction. [4 marks]'" },
];

function StreamingCursor() {
  return (
    <span
      className="inline-block w-0.5 h-4 bg-primary align-middle ml-0.5"
      style={{ animation: "tutorcraft-blink 0.8s step-end infinite" }}
    />
  );
}

export default function TutorCraft() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  async function send(text?: string) {
    const content = text ?? input.trim();
    if (!content || loading) return;
    setInput("");

    const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
    setMessages(prev => [
      ...prev,
      { role: "user", content },
      { role: "assistant", content: "", streaming: true },
    ]);
    setLoading(true);

    abortRef.current = new AbortController();

    try {
      const res = await fetch(`${API}/tutorcraft/stream`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, history }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const { content: chunk } = JSON.parse(data);
            if (chunk) {
              fullContent += chunk;
              setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = { role: "assistant", content: fullContent, streaming: true };
                return next;
              });
            }
          } catch { /* skip non-JSON */ }
        }
      }

      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: fullContent || "No response received.",
          streaming: false,
        };
        return next;
      });
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: "AI is temporarily unavailable. Please try again in a moment.",
          streaming: false,
        };
        return next;
      });
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  function newChat() {
    abortRef.current?.abort();
    setMessages([]);
    setLoading(false);
  }

  const isStreaming = messages[messages.length - 1]?.streaming === true;

  return (
    <div className="min-h-screen bg-background flex flex-col page-transition">
      <style>{`
        @keyframes tutorcraft-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>

      <div className="border-b bg-card/50 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">TutorCraft™ AI</h1>
            <p className="text-xs text-muted-foreground">Your expert teaching assistant</p>
          </div>
          <Badge variant="secondary" className="text-xs ml-2">NVIDIA NIM</Badge>
        </div>
        <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={newChat}>
          <RotateCcw className="h-3.5 w-3.5" /> New Chat
        </Button>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 px-6 py-4" ref={scrollRef as any}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-bold mb-2">How can I help you today?</h2>
              <p className="text-muted-foreground text-sm max-w-md mb-8">
                I can help with lesson planning, creating exam questions, writing student feedback, building mark schemes, and much more.
              </p>
              <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
                {QUICK_PROMPTS.map((p, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    className="h-auto py-3 flex-col gap-1.5 text-left items-start"
                    onClick={() => send(p.prompt)}
                  >
                    <div className="flex items-center gap-2 text-primary">
                      {p.icon}
                      <span className="text-xs font-semibold">{p.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground line-clamp-2">{p.prompt.slice(0, 70)}…</span>
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-w-3xl mx-auto">
              <AnimatePresence>
                {messages.map((m, i) => {
                  const isLastStreaming = m.streaming && i === messages.length - 1;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn("flex gap-3", m.role === "user" ? "justify-end" : "justify-start")}
                    >
                      {m.role === "assistant" && (
                        <div className={cn(
                          "h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 transition-all",
                          isLastStreaming && "ring-2 ring-primary/30",
                        )}>
                          <Sparkles className={cn("h-4 w-4 text-primary", isLastStreaming && "animate-pulse")} />
                        </div>
                      )}
                      <div className={cn(
                        "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                        m.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : "bg-muted rounded-tl-sm",
                      )}>
                        {m.role === "assistant" ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            {m.content ? (
                              <>
                                <ReactMarkdown>{m.content}</ReactMarkdown>
                                {isLastStreaming && <StreamingCursor />}
                              </>
                            ) : (
                              <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                                <span className="inline-flex gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                                  <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                                  <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                                </span>
                                Thinking…
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{m.content}</p>
                        )}
                      </div>
                      {m.role === "user" && (
                        <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                          <User className="h-4 w-4" />
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>

        <div className="border-t bg-card/50 px-6 py-4 shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="relative flex items-end gap-2 rounded-2xl border bg-background p-2">
              <Textarea
                ref={textareaRef}
                rows={1}
                placeholder="Ask TutorCraft anything — lesson plans, feedback, questions…"
                className="flex-1 border-0 shadow-none resize-none focus-visible:ring-0 text-sm py-1.5 max-h-32"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                disabled={loading}
              />
              <Button
                size="icon"
                className="h-9 w-9 shrink-0 rounded-xl"
                disabled={!input.trim() || loading}
                onClick={() => send()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              {isStreaming ? "Generating response…" : "Press Enter to send · Shift+Enter for new line · AI responses may not always be accurate"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
