import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, MessageSquare, Calendar, Clock, CheckCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TEACHERS = [
  { id: "t1", name: "Mr. Ahmed Hassan", subject: "Physics 0625", avatar: "AH", unread: 2, online: true },
  { id: "t2", name: "Ms. Sarah Khalil", subject: "Math 0580", avatar: "SK", unread: 0, online: false },
  { id: "t3", name: "Dr. Omar Farouk", subject: "Chemistry 0620", avatar: "OF", unread: 1, online: true },
];

const MOCK_MESSAGES: Record<string, Array<{ id: string; from: "teacher" | "parent"; content: string; time: string; read: boolean }>> = {
  t1: [
    { id: "m1", from: "teacher", content: "Good morning! I wanted to let you know that Nour did exceptionally well on last week's wave optics test — scored 88%. Keep up the encouragement at home!", time: "09:15", read: true },
    { id: "m2", from: "parent", content: "That's wonderful news! We're very proud of her. Is there anything specific we should focus on for the upcoming paper?", time: "10:30", read: true },
    { id: "m3", from: "teacher", content: "I'd recommend focusing on electromagnetic induction — it tends to be tricky. I've uploaded some extra resources to ContentCraft. Also, her mock exam is on June 12th.", time: "11:00", read: false },
    { id: "m4", from: "teacher", content: "Don't hesitate to reach out if you have any concerns about exam prep 📚", time: "11:01", read: false },
  ],
  t2: [],
  t3: [
    { id: "m5", from: "teacher", content: "Hi, just a reminder about the chemistry assignment due this Friday. Please encourage Nour to submit on time.", time: "Yesterday", read: false },
  ],
};

export default function GuardianLink() {
  const [selected, setSelected] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(MOCK_MESSAGES);
  const { toast } = useToast();

  const teacher = TEACHERS.find((t) => t.id === selected);
  const thread = selected ? (messages[selected] || []) : [];

  const sendMessage = () => {
    if (!input.trim() || !selected) return;
    setMessages((prev) => ({
      ...prev,
      [selected]: [
        ...(prev[selected] || []),
        { id: Date.now().toString(), from: "parent", content: input.trim(), time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }), read: true },
      ],
    }));
    setInput("");
    toast({ title: "Message sent", description: `Your message to ${teacher?.name} has been sent.` });
  };

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">GuardianLink<span className="text-primary"></span></h1>
        </div>
        <p className="text-muted-foreground">Direct messaging with your child's teachers.</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
        {/* Teacher list */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Teachers</CardTitle>
            <CardDescription>Tap to open a conversation</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-0">
              {TEACHERS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelected(t.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-border/50 last:border-0 ${selected === t.id ? "bg-primary/10" : "hover:bg-muted/50"}`}
                >
                  <div className="relative shrink-0">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className={`text-xs ${selected === t.id ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        {t.avatar}
                      </AvatarFallback>
                    </Avatar>
                    {t.online && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-card" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{t.subject}</p>
                  </div>
                  {t.unread > 0 && (
                    <Badge className="h-5 w-5 p-0 flex items-center justify-center text-[10px] shrink-0">
                      {t.unread}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Message thread */}
        <div className="lg:col-span-2">
          {selected ? (
            <Card className="h-full flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-3 p-4 border-b border-border/50 shrink-0">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">{teacher?.avatar}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold">{teacher?.name}</p>
                  <p className="text-[10px] text-muted-foreground">{teacher?.subject}</p>
                </div>
                <div className="ml-auto flex gap-2">
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                    <Calendar className="h-3 w-3" /> Schedule Meeting
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {thread.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">
                      No messages yet. Start the conversation below.
                    </div>
                  ) : (
                    thread.map((msg) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${msg.from === "parent" ? "justify-end" : "justify-start"}`}
                      >
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${msg.from === "parent" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                          <p className="text-sm leading-relaxed">{msg.content}</p>
                          <div className={`flex items-center gap-1 mt-1 text-[10px] ${msg.from === "parent" ? "text-primary-foreground/70 justify-end" : "text-muted-foreground"}`}>
                            <Clock className="h-2.5 w-2.5" />
                            {msg.time}
                            {msg.from === "parent" && <CheckCheck className={`h-2.5 w-2.5 ml-0.5 ${msg.read ? "text-primary-foreground" : "text-primary-foreground/40"}`} />}
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="p-4 border-t border-border/50 shrink-0">
                <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={`Message ${teacher?.name}…`}
                    className="flex-1 text-sm"
                  />
                  <Button type="submit" disabled={!input.trim()} size="icon">
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a teacher to start messaging</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
