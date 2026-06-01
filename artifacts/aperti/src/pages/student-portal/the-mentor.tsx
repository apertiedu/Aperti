import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Sparkles, BookOpen, Lightbulb, RefreshCw, Clock } from "lucide-react";

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
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null); // null = not yet checked
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

    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    const token = localStorage.getItem("aperti_token");
    try {
      const response = await fetch(`${API}/mentor/chat`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: input, sessionId: "demo" }),
      });

      if (!response.ok) {
        setAiAvailable(false);
        // Replace the empty assistant bubble with a friendly message
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: "AI tutoring is currently unavailable. The team is configuring this feature." }
              : m
          )
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
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Something went wrong. Please try again." }
            : m
        )
      );
    }
    setStreaming(false);
  };

  const handleQuickAction = (action: string) => {
    if (aiAvailable === false) return;
    setInput(action);
  };

  const isDisabled = aiAvailable === false;

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-6 flex flex-col">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">The Mentor</h1>
            <p className="text-sm text-gray-500">Your personal, adaptive AI tutor</p>
          </div>
        </div>
      </motion.div>

      {/* Coming Soon banner */}
      <AnimatePresence>
        {isDisabled && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 max-w-3xl mx-auto w-full"
          >
            <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
              <Clock className="h-5 w-5 text-amber-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">AI tutoring is coming soon</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  The Mentor is being configured for your institution. You'll be notified when it's ready.
                </p>
              </div>
              <span className="ml-auto shrink-0 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> Coming Soon
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="flex-1 flex flex-col max-w-3xl mx-auto w-full shadow-sm border-0">
        <CardContent className="flex-1 flex flex-col p-4">
          <ScrollArea className="flex-1 pr-4 mb-4 min-h-0" style={{ height: "calc(100vh - 340px)" }}>
            <div className="space-y-4 py-2">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
                >
                  {msg.role === "assistant" && (
                    <Avatar className="h-8 w-8 shrink-0" style={{ background: "rgba(0,121,107,0.12)" }}>
                      <AvatarFallback className="bg-transparent">
                        <Sparkles className="h-4 w-4 text-primary" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-2.5 max-w-[80%] text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-white"
                        : "bg-slate-100 text-gray-800"
                    }`}
                  >
                    {msg.content ? (
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    ) : (
                      <div className="flex gap-1 py-1">
                        <span className="animate-pulse text-gray-400">●</span>
                        <span className="animate-pulse text-gray-400" style={{ animationDelay: "0.15s" }}>●</span>
                        <span className="animate-pulse text-gray-400" style={{ animationDelay: "0.3s" }}>●</span>
                      </div>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <Avatar className="h-8 w-8 shrink-0 bg-slate-200">
                      <AvatarFallback className="bg-slate-200 text-slate-600 text-xs font-semibold">U</AvatarFallback>
                    </Avatar>
                  )}
                </motion.div>
              ))}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          {/* Quick actions */}
          <div className="flex gap-2 mb-3 flex-wrap">
            {[
              { label: "Explain a concept", prompt: "Explain Newton's Laws visually", icon: Lightbulb },
              { label: "Practice question", prompt: "Give me a practice question on Momentum", icon: BookOpen },
              { label: "Weak topics", prompt: "Review my weak topics", icon: RefreshCw },
            ].map(({ label, prompt, icon: Icon }) => (
              <Button
                key={label}
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction(prompt)}
                disabled={isDisabled}
                className="text-xs h-7 border-gray-200 bg-white hover:bg-gray-50"
              >
                <Icon className="h-3 w-3 mr-1.5" /> {label}
              </Button>
            ))}
          </div>

          {/* Input bar */}
          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isDisabled ? "AI tutoring coming soon…" : "Ask anything… e.g., 'Help me understand waves'"}
              disabled={streaming || isDisabled}
              className="flex-1 h-10 border-gray-200 bg-white"
            />
            <Button
              type="submit"
              disabled={streaming || !input.trim() || isDisabled}
              className="h-10 bg-primary hover:bg-primary/90 text-white"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
