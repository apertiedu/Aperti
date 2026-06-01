import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, Sparkles, BookOpen, Lightbulb, RefreshCw } from "lucide-react";

const API = "/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function TheMentor() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I'm your Mentor. Ask me any question, request a practice problem, or tell me a topic you'd like to master.",
    },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || streaming) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setStreaming(true);

    // Prepare assistant placeholder
    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    const token = localStorage.getItem("aperti_token");
    const response = await fetch(`${API}/mentor/chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: input, sessionId: "demo" }),
    });

    if (!response.ok) {
      setStreaming(false);
      return;
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";

    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split("\n").filter((line) => line.startsWith("data: "));
      for (const line of lines) {
        const data = line.slice(6);
        if (data === "[DONE]") break;
        try {
          const parsed = JSON.parse(data);
          fullContent += parsed.content || "";
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: fullContent } : m))
          );
        } catch {}
      }
    }
    setStreaming(false);
  };

  const handleQuickAction = (action: string) => {
    setInput(action);
  };

  return (
    <div className="min-h-screen bg-background p-6 page-transition flex flex-col">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
        <h1 className="text-3xl font-bold">The Mentor<span className="text-primary"></span></h1>
        <p className="text-muted-foreground">Your personal, adaptive tutor.</p>
      </motion.div>

      <Card className="card-hover flex-1 flex flex-col max-w-3xl mx-auto w-full">
        <CardContent className="flex-1 flex flex-col p-4">
          <ScrollArea className="flex-1 pr-4 mb-4">
            <div className="space-y-4">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
                >
                  {msg.role === "assistant" && (
                    <Avatar className="h-8 w-8 bg-primary/20 text-primary">
                      <AvatarFallback><Sparkles className="h-4 w-4" /></AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-2 max-w-[80%] ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {msg.content ? (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <div className="flex gap-1">
                        <span className="animate-pulse">●</span>
                        <span className="animate-pulse delay-100">●</span>
                        <span className="animate-pulse delay-200">●</span>
                      </div>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <Avatar className="h-8 w-8 bg-secondary">
                      <AvatarFallback>U</AvatarFallback>
                    </Avatar>
                  )}
                </motion.div>
              ))}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          {/* Quick actions */}
          <div className="flex gap-2 mb-3 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => handleQuickAction("Explain Newton's Laws visually")}>
              <Lightbulb className="h-3 w-3 mr-1" /> Explain a concept
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickAction("Give me a practice question on Momentum")}>
              <BookOpen className="h-3 w-3 mr-1" /> Practice question
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickAction("Review my weak topics")}>
              <RefreshCw className="h-3 w-3 mr-1" /> Weak topics
            </Button>
          </div>

          {/* Input bar */}
          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything... e.g., 'Help me understand waves'"
              disabled={streaming}
              className="flex-1"
            />
            <Button type="submit" disabled={streaming || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
