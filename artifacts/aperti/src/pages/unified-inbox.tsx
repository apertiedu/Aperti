import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Search, Send, Paperclip, Mic, Sparkles,
  BookOpen, FileText, Clock, Users, Filter, Plus, X,
  ChevronRight, Bot, Globe, AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/context/auth";

const fetchJSON = (url: string) => fetch(url, { credentials: "include" }).then((r) => r.json());
const postJSON = (url: string, body: unknown) =>
  fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

type Thread = {
  id: number; type: string; title: string | null; context_type: string | null;
  context_id: number | null; unread_count: number; last_message: string | null;
  last_at: string | null; participants: Array<{ id: number; name: string; role: string }>;
};
type Message = {
  id: number; thread_id: number; sender_id: number; sender_name: string; sender_role: string;
  content: string; attachment_url: string | null; attachment_type: string | null;
  ai_generated: boolean; is_read: boolean; created_at: string;
};

const TYPE_COLORS: Record<string, string> = {
  direct: "bg-teal-100 text-teal-700",
  class: "bg-blue-100 text-blue-700",
  parent: "bg-purple-100 text-purple-700",
  group: "bg-amber-100 text-amber-700",
  system: "bg-gray-100 text-gray-600",
};

export default function UnifiedInbox() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [compose, setCompose] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [showCompose, setShowCompose] = useState(false);
  const [newRecipients, setNewRecipients] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [summary, setSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [translating, setTranslating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: threads = [], isLoading } = useQuery<Thread[]>({
    queryKey: ["comm-threads"],
    queryFn: () => fetchJSON("/api/messages/threads"),
    refetchInterval: 8000,
  });

  const { data: threadData } = useQuery({
    queryKey: ["comm-thread", selectedThread?.id],
    queryFn: () => fetchJSON(`/api/messages/threads/${selectedThread!.id}`),
    enabled: !!selectedThread,
    refetchInterval: 5000,
  });

  const messages: Message[] = threadData?.messages ?? [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: () => postJSON(`/api/messages/threads/${selectedThread!.id}/messages`, { content: compose }),
    onSuccess: () => {
      setCompose("");
      qc.invalidateQueries({ queryKey: ["comm-thread", selectedThread?.id] });
      qc.invalidateQueries({ queryKey: ["comm-threads"] });
    },
  });

  const createThreadMutation = useMutation({
    mutationFn: () => postJSON("/api/messages/threads", {
      recipient_ids: newRecipients.split(",").map((s) => parseInt(s.trim())).filter(Boolean),
      title: newTitle || undefined,
    }),
    onSuccess: (thread) => {
      qc.invalidateQueries({ queryKey: ["comm-threads"] });
      setSelectedThread(thread);
      setShowCompose(false);
      setNewRecipients("");
      setNewTitle("");
    },
  });

  const handleSummary = async () => {
    if (!selectedThread) return;
    setLoadingSummary(true);
    setSummary(null);
    const data = await fetchJSON(`/api/messages/threads/${selectedThread.id}/summary`);
    setSummary(data.summary);
    setLoadingSummary(false);
  };

  const handleTranslate = async (msg: Message) => {
    setTranslating(true);
    await postJSON("/api/messages/translate", { content: msg.content, target_language: "Arabic" });
    setTranslating(false);
  };

  const filtered = threads.filter((t) => {
    const matchSearch = !search || (t.title ?? t.participants?.[0]?.name ?? "").toLowerCase().includes(search.toLowerCase())
      || (t.last_message ?? "").toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || t.type === filter;
    return matchSearch && matchFilter;
  });

  const threadLabel = (t: Thread) => t.title || t.participants?.map((p) => p.name).join(", ") || "Conversation";

  return (
    <div className="h-[calc(100vh-64px)] flex bg-gray-50 font-[Inter,sans-serif]">
      {/* Thread List Panel */}
      <div className="w-80 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-teal-600" /> Inbox
            </h1>
            <button onClick={() => setShowCompose(true)}
              className="p-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search messages…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {["all", "direct", "class", "parent", "group"].map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-2.5 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${filter === f ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No conversations yet</div>
          ) : (
            filtered.map((thread) => (
              <motion.button key={thread.id} onClick={() => { setSelectedThread(thread); setSummary(null); }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className={`w-full p-3 text-left border-b border-gray-50 hover:bg-gray-50 transition-colors ${selectedThread?.id === thread.id ? "bg-teal-50 border-l-2 border-l-teal-500" : ""}`}>
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-teal-700">{threadLabel(thread)[0]?.toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900 truncate">{threadLabel(thread)}</span>
                      {thread.unread_count > 0 && (
                        <span className="ml-1 flex-shrink-0 bg-teal-600 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                          {thread.unread_count}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${TYPE_COLORS[thread.type] ?? TYPE_COLORS.system}`}>
                        {thread.type}
                      </span>
                      {thread.context_type && (
                        <span className="text-[10px] text-gray-400">{thread.context_type}</span>
                      )}
                    </div>
                    {thread.last_message && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">{thread.last_message}</p>
                    )}
                  </div>
                </div>
              </motion.button>
            ))
          )}
        </div>
      </div>

      {/* Conversation View */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedThread ? (
          <>
            {/* Header */}
            <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">{threadLabel(selectedThread)}</h2>
                <p className="text-xs text-gray-500">
                  {threadData?.participants?.map((p: any) => p.name).join(", ")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleSummary} disabled={loadingSummary}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors">
                  <Sparkles className="w-3.5 h-3.5" />
                  {loadingSummary ? "Summarising…" : "AI Summary"}
                </button>
              </div>
            </div>

            {/* AI Summary Banner */}
            <AnimatePresence>
              {summary && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="bg-purple-50 border-b border-purple-100 px-6 py-3 flex items-start gap-2">
                  <Bot className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-purple-700 mb-0.5">AI Thread Summary</p>
                    <p className="text-sm text-purple-800">{summary}</p>
                  </div>
                  <button onClick={() => setSummary(null)}><X className="w-4 h-4 text-purple-400" /></button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg) => {
                const isMe = msg.sender_id === user?.id;
                return (
                  <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-1`}>
                      {!isMe && (
                        <span className="text-xs text-gray-500 px-1">{msg.sender_name} · {msg.sender_role}</span>
                      )}
                      <div className={`px-4 py-2.5 rounded-2xl text-sm ${isMe
                        ? "bg-teal-600 text-white rounded-tr-sm"
                        : "bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm"}`}>
                        {msg.ai_generated && (
                          <div className="flex items-center gap-1 text-xs opacity-70 mb-1">
                            <Bot className="w-3 h-3" /> AI-generated
                          </div>
                        )}
                        {msg.content}
                        {msg.attachment_url && (
                          <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer"
                            className="mt-1 flex items-center gap-1 text-xs underline opacity-80">
                            <Paperclip className="w-3 h-3" /> Attachment
                          </a>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400 px-1">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Compose */}
            <div className="bg-white border-t border-gray-100 p-4">
              <div className="flex items-end gap-3">
                <div className="flex-1 relative">
                  <textarea value={compose} onChange={(e) => setCompose(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (compose.trim()) sendMutation.mutate(); } }}
                    placeholder="Type a message… (Enter to send)"
                    rows={2}
                    className="w-full px-4 py-3 pr-10 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 resize-none" />
                </div>
                <button onClick={() => { if (compose.trim()) sendMutation.mutate(); }}
                  disabled={!compose.trim() || sendMutation.isPending}
                  className="p-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors flex-shrink-0">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* Context Sidebar */}
      {selectedThread && (
        <div className="w-64 flex-shrink-0 bg-white border-l border-gray-100 p-4 overflow-y-auto">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Context</h3>

          {selectedThread.context_type && (
            <div className="bg-teal-50 rounded-xl p-3 mb-3">
              <div className="flex items-center gap-2 mb-1">
                <BookOpen className="w-4 h-4 text-teal-600" />
                <span className="text-xs font-medium text-teal-700 capitalize">{selectedThread.context_type}</span>
              </div>
              <p className="text-xs text-teal-600">ID: {selectedThread.context_id}</p>
            </div>
          )}

          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Participants</p>
            <div className="space-y-2">
              {threadData?.participants?.map((p: any) => (
                <div key={p.id} className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                    <span className="text-[10px] font-semibold text-gray-600">{p.name[0]}</span>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-800">{p.name}</p>
                    <p className="text-[10px] text-gray-400 capitalize">{p.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Quick Actions</p>
            <div className="space-y-1.5">
              <button className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <AlertTriangle className="w-3.5 h-3.5" /> Report Message
              </button>
              <button className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <Globe className="w-3.5 h-3.5" /> Translate Thread
              </button>
              <button className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <FileText className="w-3.5 h-3.5" /> Export Transcript
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compose Modal */}
      <AnimatePresence>
        {showCompose && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">New Conversation</h3>
                <button onClick={() => setShowCompose(false)}><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Recipient User IDs (comma separated)</label>
                  <input value={newRecipients} onChange={(e) => setNewRecipients(e.target.value)}
                    placeholder="e.g. 12, 34, 56"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Title (optional)</label>
                  <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Conversation title"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
                </div>
                <button onClick={() => createThreadMutation.mutate()}
                  disabled={!newRecipients.trim() || createThreadMutation.isPending}
                  className="w-full py-2.5 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors">
                  Start Conversation
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
