import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Hash, Send, Pin, Lock, Unlock, Users, BookOpen,
  AlertCircle, Paperclip, ChevronDown, Settings, X,
} from "lucide-react";
import { useAuth } from "@/context/auth";

const fetchJSON = (url: string) => fetch(url, { credentials: "include" }).then((r) => r.json());
const postJSON = (url: string, body: unknown) =>
  fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
const putJSON = (url: string, body: unknown) =>
  fetch(url, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

type ChannelMsg = {
  id: number; channel_id: number; sender_id: number; sender_name: string; sender_role: string;
  content: string; is_pinned: boolean; attachment_url: string | null; created_at: string;
};

export default function ClassChannel() {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [compose, setCompose] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isTeacher = user?.role === "teacher" || user?.role === "admin";

  const { data, isLoading, error } = useQuery({
    queryKey: ["channel", courseId],
    queryFn: () => fetchJSON(`/api/channels/${courseId}`),
    refetchInterval: 6000,
  });

  const channel = data?.channel;
  const messages: ChannelMsg[] = data?.messages ?? [];
  const pinned = messages.find((m) => m.id === channel?.pinned_message_id);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMutation = useMutation({
    mutationFn: () => postJSON(`/api/channels/${channel?.id}/messages`, { content: compose }),
    onSuccess: () => { setCompose(""); qc.invalidateQueries({ queryKey: ["channel", courseId] }); },
  });

  const lockMutation = useMutation({
    mutationFn: (locked: boolean) => putJSON(`/api/channels/${channel?.id}/settings`, { is_locked: locked }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["channel", courseId] }),
  });

  const pinMutation = useMutation({
    mutationFn: (msgId: number) => putJSON(`/api/channels/${channel?.id}/settings`, { pinned_message_id: msgId, is_locked: channel?.is_locked }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["channel", courseId] }); setShowSettings(false); },
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64 text-gray-400 font-[Inter,sans-serif]">
      <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error || !channel) return (
    <div className="max-w-xl mx-auto mt-12 p-6 bg-white rounded-2xl shadow-sm text-center font-[Inter,sans-serif]">
      <Hash className="w-10 h-10 text-gray-300 mx-auto mb-3" />
      <h2 className="font-semibold text-gray-700 mb-1">No Channel Yet</h2>
      <p className="text-sm text-gray-500">This course doesn't have a discussion channel yet.</p>
      {isTeacher && (
        <button
          onClick={() => postJSON("/api/channels", { course_id: courseId, name: `Course ${courseId} Channel` }).then(() => qc.invalidateQueries({ queryKey: ["channel", courseId] }))}
          className="mt-4 px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 transition-colors">
          Create Channel
        </button>
      )}
    </div>
  );

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-gray-50 font-[Inter,sans-serif]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <Hash className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h1 className="font-semibold text-gray-900">{channel.name}</h1>
            {channel.description && <p className="text-xs text-gray-500">{channel.description}</p>}
          </div>
          {channel.is_locked && (
            <span className="flex items-center gap-1 text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">
              <Lock className="w-3 h-3" /> Locked
            </span>
          )}
        </div>
        {isTeacher && (
          <div className="flex items-center gap-2">
            <button onClick={() => lockMutation.mutate(!channel.is_locked)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors">
              {channel.is_locked ? <><Unlock className="w-3.5 h-3.5" />Unlock</> : <><Lock className="w-3.5 h-3.5" />Lock</>}
            </button>
            <button onClick={() => setShowSettings(true)}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Pinned Message */}
      {pinned && (
        <div className="bg-amber-50 border-b border-amber-100 px-6 py-2 flex items-start gap-2">
          <Pin className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <span className="text-xs font-medium text-amber-700">Pinned by teacher · </span>
            <span className="text-xs text-amber-800">{pinned.content}</span>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 mt-20">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No messages yet. Start the discussion!</p>
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
                <div className={`max-w-[70%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-1`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-700">{msg.sender_name}</span>
                    <span className="text-[10px] text-gray-400 capitalize bg-gray-100 px-1.5 py-0.5 rounded-full">{msg.sender_role}</span>
                    {msg.is_pinned && <Pin className="w-3 h-3 text-amber-500" />}
                  </div>
                  <div className={`px-4 py-2.5 rounded-2xl text-sm shadow-sm ${isMe
                    ? "bg-teal-600 text-white rounded-tr-sm"
                    : "bg-white border border-gray-100 text-gray-800 rounded-tl-sm"}`}>
                    {msg.content}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {isTeacher && !msg.is_pinned && (
                      <button onClick={() => pinMutation.mutate(msg.id)}
                        className="text-[10px] text-gray-400 hover:text-amber-600 transition-colors">Pin</button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Compose */}
      <div className="bg-white border-t border-gray-100 p-4">
        {channel.is_locked && !isTeacher ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 justify-center py-2">
            <Lock className="w-4 h-4" /> This channel is locked by the teacher
          </div>
        ) : (
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <textarea value={compose} onChange={(e) => setCompose(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (compose.trim()) sendMutation.mutate(); } }}
                placeholder={`Message #${channel.name}…`}
                rows={2}
                className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 resize-none" />
            </div>
            <button onClick={() => { if (compose.trim()) sendMutation.mutate(); }}
              disabled={!compose.trim() || sendMutation.isPending}
              className="p-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors">
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Channel Settings</h3>
                <button onClick={() => setShowSettings(false)}><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <p className="text-sm text-gray-600 mb-4">Pin a message by clicking "Pin" beneath it in the channel.</p>
              <div className="space-y-2">
                <button onClick={() => { lockMutation.mutate(!channel.is_locked); setShowSettings(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm bg-gray-50 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors">
                  {channel.is_locked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  {channel.is_locked ? "Unlock Channel" : "Lock Channel"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
