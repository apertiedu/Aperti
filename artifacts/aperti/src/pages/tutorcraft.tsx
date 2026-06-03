import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sparkles, Send, User, Loader2, Plus, BookOpen,
  ClipboardList, MessageSquare, FileText, RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

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

interface Message { role: "user" | "assistant"; content: string; }

const QUICK_PROMPTS = [
  { icon: <BookOpen className="h-4 w-4" />, label: "Lesson plan", prompt: "Create a 60-minute lesson plan for A-Level Physics on Newton's Laws of Motion. Include starter, main activities, and a plenary." },
  { icon: <ClipboardList className="h-4 w-4" />, label: "Exam questions", prompt: "Write 5 CAIE-style exam questions on the Water Cycle for IGCSE Geography, ranging from 1-mark recall to 6-mark extended response." },
  { icon: <MessageSquare className="h-4 w-4" />, label: "Student feedback", prompt: "Help me write constructive feedback for a student who clearly understands the theory but makes careless arithmetic errors in calculations." },
  { icon: <FileText className="h-4 w-4" />, label: "Mark scheme", prompt: "Generate a mark scheme for this question: 'Explain how enzymes lower the activation energy of a reaction. [4 marks]'" },
];

export default function TutorCraft() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(text?: string) {
    const content = text ?? input.trim();
    if (!content || loading) return;
    setInput("");

    const userMsg: Message = { role: "user", content };
    const history = messages.slice(-10);
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const { reply } = await apiFetch("/tutorcraft/chat", {
        method: "POST",
        body: JSON.stringify({ message: content, history }),
      });
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't get a response. Please check your connection and try again." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col page-transition">
      {/* Header */}
      <div className="border-b bg-card/50 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">TutorCraft™ AI</h1>
            <p className="text-xs text-muted-foreground">Your expert teaching assistant</p>
          </div>
          <Badge variant="secondary" className="text-xs ml-2">GPT-4o mini</Badge>
        </div>
        <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => setMessages([])}>
          <RotateCcw className="h-3.5 w-3.5" /> New Chat
        </Button>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Messages */}
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
                {messages.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn("flex gap-3", m.role === "user" ? "justify-end" : "justify-start")}
                  >
                    {m.role === "assistant" && (
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles className="h-4 w-4 text-primary" />
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
                          <ReactMarkdown>{m.content}</ReactMarkdown>
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
                ))}
                {loading && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>

        {/* Input */}
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
              Press Enter to send · Shift+Enter for new line · AI responses may not always be accurate
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
