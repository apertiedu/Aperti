import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Send, Sparkles, BookOpen, Lightbulb, RefreshCw,
  Clock, Brain, AlertCircle, ChevronRight, History,
} from "lucide-react";
import { useAuth } from "@/context/auth";
import { MathRenderer } from "@/components/math-renderer";


interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface EchoProfile {
  weakTopics: string[];
  preferredStyle: string;
  retentionScores: Record<string, number>;
}

async function fetchEchoProfile(): Promise<EchoProfile> {
  const res = await fetch("/api/echo/profile", {
    credentials: "include",
    headers: {},
  });
  if (!res.ok) return { weakTopics: [], preferredStyle: "conceptual", retentionScores: {} };
  const data = await res.json();
  return {
    weakTopics: (data.weakTopics as string[]) ?? [],
    preferredStyle: data.preferredStyle ?? "conceptual",
    retentionScores: (data.retentionScores as Record<string, number>) ?? {},
  };
}

async function fetchHistory(): Promise<any[]> {
  const res = await fetch("/api/mentor/sessions", {
    credentials: "include",
    headers: {},
  });
  if (!res.ok) return [];
  return res.json();
}

export default function TheMentor() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I'm your Mentor. Ask me any question, request a practice problem, or tell me a topic you'd like to master.",
    },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: echo, isLoading: echoLoading } = useQuery<EchoProfile>({
    queryKey: ["echo", "profile"],
    queryFn: fetchEchoProfile,
    staleTime: 60000,
  });

  const { data: history } = useQuery<any[]>({
    queryKey: ["mentor", "sessions"],
    queryFn: fetchHistory,
    staleTime: 60000,
  });

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (overrideText?: string) => {
    const text = overrideText || input;
    if (!text.trim() || streaming) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setStreaming(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/mentor/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId: `web-${Date.now()}` }),
      });

      if (!response.ok) {
        setAiAvailable(false);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: "AI tutoring is being configured for your institution. You'll be notified when it's ready." }
              : m
          )
        );
        setStreaming(false);
        return;
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/event-stream")) {
        const data = await response.json();
        setAiAvailable(false);
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, content: data.content || "No response." } : m)
        );
        setStreaming(false);
        return;
      }

      setAiAvailable(true);
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));
        for (const line of lines) {
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            fullContent += parsed.content || "";
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: fullContent } : m)));
          } catch {}
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: "Something went wrong. Please try again." } : m
        )
      );
    }
    setStreaming(false);
  };

  const handleQuickChip = (prompt: string) => {
    setInput(prompt);
    sendMessage(prompt);
  };

  const weakTopics = echo?.weakTopics ?? [];
  const initials = (user?.displayName || user?.username || "S")
    .split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);

  const quickChips = [
    ...weakTopics.slice(0, 2).map((t) => ({ label: `Explain ${t}`, prompt: `Explain ${t} in a clear, simple way` })),
    ...weakTopics.slice(0, 2).map((t) => ({ label: `Quiz me on ${t}`, prompt: `Give me a practice question on ${t}` })),
    { label: "Review my mistakes", prompt: "Help me review my recent mistakes and weak areas" },
    { label: "Simplify a concept", prompt: "Help me simplify a concept I'm struggling with" },
  ].slice(0, 5);

  return (
    <div className="min-h-screen bg-[#F8FAFB] flex flex-col" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-primary/8 flex items-center justify-center">
          <Sparkles className="h-4.5 w-4.5 text-primary" style={{ width: 18, height: 18 }} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">The Mentor</h1>
          <p className="text-xs text-gray-500">Adaptive AI tutor personalised to you</p>
        </div>
        {aiAvailable === false && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full">
            <Clock className="h-3.5 w-3.5" /> AI coming soon
          </span>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden max-w-6xl mx-auto w-full p-4 gap-4">
        {/* Sidebar */}
        <AnimatePresence>
          {showSidebar && (
            <motion.aside
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              className="hidden lg:flex flex-col gap-3 w-64 shrink-0"
            >
              {/* Echo Memory */}
              <div className="bg-card rounded-xl border border-border shadow-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="h-4 w-4 text-primary" />
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Your Learning Profile</h3>
                </div>
                {echoLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1.5">Learning Style</p>
                      <Badge variant="secondary" className="text-xs capitalize bg-primary/8 text-primary border-0">
                        {echo?.preferredStyle || "Conceptual"}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1.5">Weak Topics</p>
                      {weakTopics.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {weakTopics.slice(0, 5).map((t) => (
                            <button
                              key={t}
                              onClick={() => handleQuickChip(`Explain ${t} in a simple way`)}
                              className="text-[10px] px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full border border-orange-100 hover:bg-orange-100 transition-colors cursor-pointer"
                            >
                              {t} <ChevronRight className="inline h-2.5 w-2.5" />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">Keep studying to identify weak spots!</p>
                      )}
                    </div>
                    {echo && Object.keys(echo.retentionScores).length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1.5">Retention</p>
                        {Object.entries(echo.retentionScores).slice(0, 3).map(([topic, score]) => (
                          <div key={topic} className="mb-1">
                            <div className="flex justify-between text-[10px] text-gray-600 mb-0.5">
                              <span className="truncate max-w-[120px]">{topic}</span>
                              <span>{Math.round(score)}%</span>
                            </div>
                            <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${score}%`, background: score >= 70 ? "hsl(var(--primary))" : score >= 40 ? "#F59E0B" : "#EF4444" }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Session history */}
              <div className="bg-card rounded-xl border border-border shadow-sm p-4 flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <History className="h-4 w-4 text-gray-400" />
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Recent Sessions</h3>
                </div>
                {!history || history.length === 0 ? (
                  <p className="text-xs text-gray-400">No previous sessions yet.</p>
                ) : (
                  <div className="space-y-2">
                    {history.slice(0, 5).map((s: any, i: number) => (
                      <div key={i} className="text-xs text-gray-600 p-2 bg-gray-50 rounded-lg truncate">
                        {s.topic || `Session ${i + 1}`}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Chat area */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <Card className="flex-1 flex flex-col shadow-sm border-gray-100 rounded-xl overflow-hidden">
            <CardContent className="flex-1 flex flex-col p-0">
              <ScrollArea className="min-h-0 flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
                    >
                      {msg.role === "assistant" && (
                        <Avatar className="h-8 w-8 shrink-0 bg-primary/8 border-0">
                          <AvatarFallback className="bg-primary/8">
                            <Sparkles className="h-4 w-4 text-primary" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div
                        className={`rounded-2xl px-4 py-2.5 max-w-[80%] text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-primary text-white"
                            : "bg-gray-50 text-gray-800 border border-gray-100"
                        }`}
                      >
                        {msg.content ? (
                          msg.role === "assistant" ? (
                            <MathRenderer content={msg.content} className="text-sm leading-relaxed" />
                          ) : (
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          )
                        ) : (
                          <div className="flex gap-1 py-1 items-center">
                            {[0, 150, 300].map((delay) => (
                              <span
                                key={delay}
                                className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce"
                                style={{ animationDelay: `${delay}ms` }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                      {msg.role === "user" && (
                        <Avatar className="h-8 w-8 shrink-0 bg-primary/15 border-0">
                          <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">{initials}</AvatarFallback>
                        </Avatar>
                      )}
                    </motion.div>
                  ))}
                  <div ref={scrollRef} />
                </div>
              </ScrollArea>

              {/* Input + Quick chips */}
              <div className="shrink-0 border-t border-border bg-card">
                {quickChips.length > 0 && (
                  <div className="px-4 pt-3 pb-1">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Suggested</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {quickChips.map(({ label, prompt }) => (
                        <button
                          key={label}
                          onClick={() => handleQuickChip(prompt)}
                          disabled={streaming}
                          className="text-xs px-2.5 py-1 rounded-full bg-gray-50 border border-gray-200 text-gray-600 hover:bg-primary/8 hover:border-primary/25 hover:text-primary transition-all disabled:opacity-50 whitespace-nowrap"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="p-3">
                  <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask anything… e.g. 'Help me understand waves'"
                      disabled={streaming}
                      className="flex-1 h-10 rounded-xl border-border bg-card text-sm"
                    />
                    <Button
                      type="submit"
                      disabled={streaming || !input.trim()}
                      className="h-10 w-10 p-0 rounded-xl shrink-0"
                      style={{ background: "hsl(var(--primary))" }}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
