import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Send, Share2, Sparkles, BookOpen, Zap,
  FileText, Crown, Shield, User, ChevronLeft,
  Plus, X, Bot, Palette,
} from "lucide-react";
import { useAuth } from "@/context/auth";
import { useLocation } from "wouter";

const token = () => localStorage.getItem("token") ?? "";
const fetchJSON = (url: string) => fetch(url, { headers: { Authorization: `Bearer ${token()}` } }).then((r) => r.json());
const postJSON = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` }, body: JSON.stringify(body) }).then((r) => r.json());

type RoomMessage = {
  id: number; room_id: number; sender_id: number; sender_name: string;
  content: string; attachment_url: string | null; created_at: string;
};
type Member = {
  id: number; room_id: number; user_id: number; name: string;
  account_role: string; role: string; joined_at: string;
};
type SharedResource = {
  id: number; room_id: number; user_id: number; shared_by_name: string;
  resource_type: string; title: string | null; shared_at: string;
};

const ROLE_ICONS: Record<string, React.ReactNode> = {
  owner: <Crown className="w-3 h-3 text-amber-500" />,
  moderator: <Shield className="w-3 h-3 text-blue-500" />,
  member: <User className="w-3 h-3 text-gray-400" />,
};

const RESOURCE_ICONS: Record<string, React.ReactNode> = {
  note: <FileText className="w-4 h-4 text-blue-500" />,
  flashcard: <Zap className="w-4 h-4 text-amber-500" />,
  quiz: <BookOpen className="w-4 h-4 text-teal-500" />,
  whiteboard: <Palette className="w-4 h-4 text-purple-500" />,
};

export default function CollaborateRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [compose, setCompose] = useState("");
  const [activeTab, setActiveTab] = useState<"chat" | "members" | "resources" | "ai">("chat");
  const [shareForm, setShareForm] = useState({ resource_type: "note", title: "" });
  const [showShare, setShowShare] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["room", roomId],
    queryFn: () => fetchJSON(`/api/rooms/${roomId}`),
    refetchInterval: 4000,
    enabled: !!roomId,
  });

  const room = data?.room;
  const messages: RoomMessage[] = data?.messages ?? [];
  const members: Member[] = data?.members ?? [];
  const resources: SharedResource[] = data?.resources ?? [];
  const myRole: string = data?.myRole ?? "member";

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMutation = useMutation({
    mutationFn: () => postJSON(`/api/rooms/${roomId}/messages`, { content: compose }),
    onSuccess: () => { setCompose(""); qc.invalidateQueries({ queryKey: ["room", roomId] }); },
  });

  const shareMutation = useMutation({
    mutationFn: () => postJSON(`/api/rooms/${roomId}/share`, shareForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["room", roomId] });
      setShowShare(false);
      setShareForm({ resource_type: "note", title: "" });
    },
  });

  const handleAiAsk = async () => {
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    setAiResponse("");
    try {
      const context = messages.slice(-10).map((m) => `${m.sender_name}: ${m.content}`).join("\n");
      const r = await postJSON("/api/messages/translate", { content: `Room context:\n${context}\n\nQuestion: ${aiQuery}`, target_language: "English" });
      const key = localStorage.getItem("token");
      const resp = await fetch("/api/coremind/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ message: aiQuery, context }),
      });
      if (resp.ok) {
        const d = await resp.json();
        setAiResponse(d.reply ?? d.response ?? "I can help the group with questions, explanations, and study tips!");
      } else {
        setAiResponse("I'm here to help your group! Ask me anything about the subject you're studying.");
      }
    } catch {
      setAiResponse("I'm here to help your group! Ask me anything about the subject you're studying.");
    }
    setAiLoading(false);
    setAiQuery("");
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-64 font-[Inter,sans-serif]">
      <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!room) return (
    <div className="max-w-md mx-auto mt-16 text-center font-[Inter,sans-serif]">
      <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
      <h2 className="font-semibold text-gray-700 mb-2">Room not found</h2>
      <button onClick={() => navigate("/rooms")} className="text-teal-600 text-sm hover:underline">Back to Rooms</button>
    </div>
  );

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col font-[Inter,sans-serif]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-4">
        <button onClick={() => navigate("/rooms")} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
            <Users className="w-4 h-4 text-teal-600" />
          </div>
          <div>
            <h1 className="font-semibold text-gray-900">{room.name}</h1>
            <p className="text-xs text-gray-500">{members.length} members · {room.type.replace("_", " ")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {["chat", "members", "resources", "ai"].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab as typeof activeTab)}
              className={`px-3 py-1.5 text-xs rounded-full transition-colors ${activeTab === tab ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {tab === "ai" ? "AI Assistant" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0">
          <AnimatePresence mode="wait">
            {activeTab === "chat" && (
              <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col">
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center text-gray-400 mt-20">
                      <MessageSquarePlaceholder />
                      <p className="text-sm mt-3">No messages yet. Start the collaboration!</p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMe = msg.sender_id === user?.id;
                      return (
                        <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                          className={`flex gap-3 ${isMe ? "flex-row-reverse" : ""}`}>
                          <div className="w-8 h-8 rounded-full bg-teal-100 flex-shrink-0 flex items-center justify-center">
                            <span className="text-xs font-semibold text-teal-700">{msg.sender_name[0]}</span>
                          </div>
                          <div className={`max-w-[70%] flex flex-col gap-1 ${isMe ? "items-end" : "items-start"}`}>
                            {!isMe && <span className="text-xs text-gray-500 px-1">{msg.sender_name}</span>}
                            <div className={`px-4 py-2.5 rounded-2xl text-sm shadow-sm ${isMe ? "bg-teal-600 text-white rounded-tr-sm" : "bg-white border border-gray-100 text-gray-800 rounded-tl-sm"}`}>
                              {msg.content}
                            </div>
                            <span className="text-[10px] text-gray-400 px-1">
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <div className="bg-white border-t border-gray-100 p-4">
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <textarea value={compose} onChange={(e) => setCompose(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (compose.trim()) sendMutation.mutate(); } }}
                        placeholder="Send a message to the room…"
                        rows={2}
                        className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 resize-none" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setShowShare(true)}
                        className="p-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors" title="Share resource">
                        <Share2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => { if (compose.trim()) sendMutation.mutate(); }}
                        disabled={!compose.trim() || sendMutation.isPending}
                        className="p-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors">
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "members" && (
              <motion.div key="members" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 overflow-y-auto p-6">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Room Members ({members.length})</h2>
                <div className="space-y-3">
                  {members.map((m) => (
                    <div key={m.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                        <span className="text-sm font-semibold text-teal-700">{m.name[0]}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-gray-900 text-sm">{m.name}</span>
                          {ROLE_ICONS[m.role]}
                        </div>
                        <p className="text-xs text-gray-500 capitalize">{m.account_role} · {m.role}</p>
                      </div>
                      <span className="text-xs text-gray-400">
                        Joined {new Date(m.joined_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === "resources" && (
              <motion.div key="resources" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 overflow-y-auto p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Shared Resources</h2>
                  <button onClick={() => setShowShare(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-xs rounded-lg hover:bg-teal-700 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Share
                  </button>
                </div>
                {resources.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <Share2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No resources shared yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {resources.map((r) => (
                      <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center">
                          {RESOURCE_ICONS[r.resource_type] ?? <FileText className="w-4 h-4 text-gray-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">{r.title || r.resource_type}</p>
                          <p className="text-xs text-gray-500">by {r.shared_by_name} · {new Date(r.shared_at).toLocaleDateString()}</p>
                        </div>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{r.resource_type}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === "ai" && (
              <motion.div key="ai" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                    <Bot className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">AI Study Assistant</h2>
                    <p className="text-xs text-gray-500">Ask questions, get hints, or request explanations</p>
                  </div>
                </div>

                {aiResponse && (
                  <div className="bg-purple-50 rounded-2xl p-4 mb-4 flex items-start gap-3">
                    <Bot className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-purple-700 mb-1">AI Response</p>
                      <p className="text-sm text-purple-900 leading-relaxed">{aiResponse}</p>
                    </div>
                  </div>
                )}

                <div className="mt-auto">
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {["Explain this topic simply", "Give us a practice question", "Summarise our discussion", "What should we focus on?"].map((q) => (
                      <button key={q} onClick={() => setAiQuery(q)}
                        className="text-xs text-left px-3 py-2 bg-gray-50 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors border border-gray-100">
                        {q}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <input value={aiQuery} onChange={(e) => setAiQuery(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAiAsk(); }}
                      placeholder="Ask the AI assistant…"
                      className="flex-1 px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30" />
                    <button onClick={handleAiAsk} disabled={!aiQuery.trim() || aiLoading}
                      className="px-4 py-2.5 bg-purple-600 text-white text-sm rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center gap-2">
                      <Sparkles className="w-4 h-4" /> {aiLoading ? "…" : "Ask"}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Share Resource Modal */}
      <AnimatePresence>
        {showShare && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Share Resource</h3>
                <button onClick={() => setShowShare(false)}><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Resource Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {["note", "flashcard", "quiz", "whiteboard"].map((type) => (
                      <button key={type} onClick={() => setShareForm({ ...shareForm, resource_type: type })}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border transition-colors ${shareForm.resource_type === type ? "border-teal-500 bg-teal-50 text-teal-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                        {RESOURCE_ICONS[type]} {type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Title (optional)</label>
                  <input value={shareForm.title} onChange={(e) => setShareForm({ ...shareForm, title: e.target.value })}
                    placeholder="Resource title"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
                </div>
                <button onClick={() => shareMutation.mutate()}
                  disabled={shareMutation.isPending}
                  className="w-full py-2.5 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors">
                  Share to Room
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MessageSquarePlaceholder() {
  return (
    <svg className="w-12 h-12 mx-auto opacity-20 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}
