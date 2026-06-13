import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, Sparkles, RefreshCw } from "lucide-react";

const TEAL = "#0D9488";
const authFetch = (url: string, opts?: RequestInit) =>
  fetch(url, { ...opts, credentials: "include", headers: { "Content-Type": "application/json", ...(opts?.headers || {}) } });

interface Message { role: "user" | "assistant"; content: string; ts: number; }

const QUICK_QUESTIONS = [
  "What does my child's predicted grade mean?",
  "How can I help with exam preparation at home?",
  "What is a good attendance rate?",
  "My child has overdue assignments — what should I do?",
  "How does the grading system work?",
  "What revision strategies work best for IGCSE?",
];

export default function ParentAIAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hello! I'm GuardianAI, your personal educational assistant. I'm here to help you understand your child's academic progress and suggest strategies to support their learning. What would you like to know?", ts: Date.now() },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedChild, setSelectedChild] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: dashData } = useQuery({
    queryKey: ["parent-dashboard"],
    queryFn: () => authFetch("/api/parent/dashboard").then(r => r.json()),
  });
  const children = dashData?.children || [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", content: text.trim(), ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const res = await authFetch("/api/parent/ai-assistant", {
        method: "POST",
        body: JSON.stringify({ message: text.trim(), studentId: selectedChild }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.response || "I'm sorry, I couldn't process that request.", ts: Date.now() }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "I'm having trouble connecting right now. Please try again shortly.", ts: Date.now() }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto h-[calc(100vh-4rem)] flex flex-col gap-4">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between gap-3 shrink-0 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${TEAL}20` }}>
            <Bot className="h-5 w-5" style={{ color: TEAL }} />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900">GuardianAI<span style={{ color: TEAL }}>.</span></h1>
            <p className="text-sm text-gray-500">Your educational assistant</p>
          </div>
        </div>
        {children.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Context:</span>
            <div className="flex gap-1.5">
              <button
                onClick={() => setSelectedChild(null)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-all ${!selectedChild ? "text-white border-teal-500" : "border-gray-200 text-gray-500"}`}
                style={!selectedChild ? { background: TEAL } : undefined}
              >General</button>
              {children.slice(0, 3).map((c: any) => (
                <button
                  key={c.studentId}
                  onClick={() => setSelectedChild(c.studentId)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${selectedChild === c.studentId ? "text-white border-teal-500" : "border-gray-200 text-gray-500"}`}
                  style={selectedChild === c.studentId ? { background: TEAL } : undefined}
                >{c.name.split(" ")[0]}</button>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* Chat area */}
      <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${TEAL}20` }}>
                    <Bot className="h-3.5 w-3.5" style={{ color: TEAL }} />
                  </div>
                )}
                <div className={`max-w-[82%] rounded-2xl px-4 py-3 ${msg.role === "user" ? "text-white" : "bg-gray-50 text-gray-800"}`}
                  style={{ background: msg.role === "user" ? TEAL : undefined }}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  <p className={`text-[9px] mt-1.5 ${msg.role === "user" ? "text-white/60 text-right" : "text-gray-400"}`}>
                    {new Date(msg.ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {msg.role === "user" && (
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-3.5 w-3.5 text-gray-500" />
                  </div>
                )}
              </motion.div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: `${TEAL}20` }}>
                  <Bot className="h-3.5 w-3.5" style={{ color: TEAL }} />
                </div>
                <div className="bg-gray-50 rounded-2xl px-4 py-3">
                  <div className="flex gap-1 items-center h-4">
                    {[0,1,2].map(i => (
                      <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-300"
                        animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Quick questions */}
        {messages.length <= 1 && (
          <div className="px-4 pb-2">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1"><Sparkles className="h-3 w-3" />Quick questions</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_QUESTIONS.map((q, i) => (
                <button key={i} onClick={() => send(q)}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50 transition-all">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-3 border-t border-gray-100 shrink-0">
          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about your child's education…"
              className="flex-1 text-sm rounded-xl"
              disabled={loading}
            />
            <Button type="submit" disabled={!input.trim() || loading} size="icon" className="rounded-xl shrink-0" style={{ background: TEAL }}>
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
