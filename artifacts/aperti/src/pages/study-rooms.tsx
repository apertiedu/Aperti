import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  Users, Plus, Search, BookOpen, Target, Zap, GraduationCap,
  X, Lock, Globe, ChevronRight, MessageSquare, Share2,
  UserPlus, Crown, Shield, User,
} from "lucide-react";
import { useAuth } from "@/context/auth";

const token = () => localStorage.getItem("token") ?? "";
const fetchJSON = (url: string) => fetch(url, { headers: { Authorization: `Bearer ${token()}` } }).then((r) => r.json());
const postJSON = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` }, body: JSON.stringify(body) }).then((r) => r.json());

type Room = {
  id: number; name: string; type: string; course_id: number | null;
  creator_name: string; member_count: number; my_role: string | null;
  is_public: boolean; settings: Record<string, unknown>; created_at: string;
};

const TYPE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  study_group: { label: "Study Group", icon: <BookOpen className="w-4 h-4" />, color: "bg-blue-100 text-blue-700" },
  revision: { label: "Revision", icon: <Target className="w-4 h-4" />, color: "bg-amber-100 text-amber-700" },
  exam_prep: { label: "Exam Prep", icon: <Zap className="w-4 h-4" />, color: "bg-red-100 text-red-700" },
  peer_tutoring: { label: "Peer Tutoring", icon: <GraduationCap className="w-4 h-4" />, color: "bg-purple-100 text-purple-700" },
};

const ROLE_ICONS: Record<string, React.ReactNode> = {
  owner: <Crown className="w-3 h-3 text-amber-500" />,
  moderator: <Shield className="w-3 h-3 text-blue-500" />,
  member: <User className="w-3 h-3 text-gray-400" />,
};

export default function StudyRooms() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", type: "study_group", is_public: true });

  const { data: rooms = [], isLoading } = useQuery<Room[]>({
    queryKey: ["rooms"],
    queryFn: () => fetchJSON("/api/rooms"),
    refetchInterval: 15000,
  });

  const createMutation = useMutation({
    mutationFn: () => postJSON("/api/rooms", { name: form.name, type: form.type, is_public: form.is_public }),
    onSuccess: (room) => {
      qc.invalidateQueries({ queryKey: ["rooms"] });
      setShowCreate(false);
      setForm({ name: "", type: "study_group", is_public: true });
      navigate(`/collaborate/${room.id}`);
    },
  });

  const joinMutation = useMutation({
    mutationFn: (id: number) => postJSON(`/api/rooms/${id}/join`, {}),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["rooms"] });
      navigate(`/collaborate/${id}`);
    },
  });

  const filtered = rooms.filter((r) => {
    const matchSearch = !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.creator_name.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || r.type === typeFilter;
    return matchSearch && matchType;
  });

  const myRooms = filtered.filter((r) => r.my_role);
  const discoverRooms = filtered.filter((r) => !r.my_role && r.is_public);

  return (
    <div className="max-w-5xl mx-auto p-6 font-[Inter,sans-serif]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Collaboration Rooms</h1>
            <p className="text-sm text-gray-500">Study together, share resources, collaborate live</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 transition-colors">
          <Plus className="w-4 h-4" /> Create Room
        </button>
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rooms…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
        </div>
        <div className="flex gap-1">
          {["all", "study_group", "revision", "exam_prep", "peer_tutoring"].map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 text-xs rounded-full whitespace-nowrap transition-colors ${typeFilter === t ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {t === "all" ? "All" : TYPE_META[t]?.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Loading rooms…</div>
      ) : (
        <>
          {/* My Rooms */}
          {myRooms.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">My Rooms</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myRooms.map((room) => (
                  <RoomCard key={room.id} room={room} onOpen={() => navigate(`/collaborate/${room.id}`)} onJoin={() => navigate(`/collaborate/${room.id}`)} isJoined />
                ))}
              </div>
            </div>
          )}

          {/* Discover */}
          {discoverRooms.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Discover</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {discoverRooms.map((room) => (
                  <RoomCard key={room.id} room={room} onOpen={() => navigate(`/collaborate/${room.id}`)} onJoin={() => joinMutation.mutate(room.id)} isJoined={false} />
                ))}
              </div>
            </div>
          )}

          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No rooms found</p>
              <p className="text-xs mt-1">Create a room to start collaborating</p>
            </div>
          )}
        </>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-semibold text-gray-900">Create Collaboration Room</h3>
                <button onClick={() => setShowCreate(false)}><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Room Name *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Physics Revision Group"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(TYPE_META).map(([key, meta]) => (
                      <button key={key} onClick={() => setForm({ ...form, type: key })}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border transition-colors ${form.type === key ? "border-teal-500 bg-teal-50 text-teal-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                        {meta.icon} {meta.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setForm({ ...form, is_public: !form.is_public })}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border transition-colors ${form.is_public ? "border-teal-500 bg-teal-50 text-teal-700" : "border-gray-200 text-gray-600"}`}>
                    {form.is_public ? <><Globe className="w-3.5 h-3.5" /> Public</> : <><Lock className="w-3.5 h-3.5" /> Private</>}
                  </button>
                  <span className="text-xs text-gray-400">{form.is_public ? "Anyone can discover and join" : "Invite only"}</span>
                </div>
                <button onClick={() => createMutation.mutate()}
                  disabled={!form.name.trim() || createMutation.isPending}
                  className="w-full py-2.5 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors">
                  Create & Open Room
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RoomCard({ room, onOpen, onJoin, isJoined }: { room: Room; onOpen: () => void; onJoin: () => void; isJoined: boolean }) {
  const meta = TYPE_META[room.type] ?? TYPE_META.study_group;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-medium ${meta.color}`}>
          {meta.icon} {meta.label}
        </div>
        {!room.is_public && <Lock className="w-3.5 h-3.5 text-gray-400" />}
      </div>
      <h3 className="font-semibold text-gray-900 mb-1">{room.name}</h3>
      <div className="flex items-center gap-3 text-xs text-gray-500 mb-4">
        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{room.member_count} members</span>
        <span>by {room.creator_name}</span>
      </div>
      {isJoined ? (
        <button onClick={onOpen}
          className="w-full flex items-center justify-center gap-2 py-2 bg-teal-600 text-white text-xs font-medium rounded-xl hover:bg-teal-700 transition-colors">
          Open Room <ChevronRight className="w-3.5 h-3.5" />
        </button>
      ) : (
        <button onClick={onJoin}
          className="w-full flex items-center justify-center gap-2 py-2 bg-gray-100 text-gray-700 text-xs font-medium rounded-xl hover:bg-gray-200 transition-colors">
          <UserPlus className="w-3.5 h-3.5" /> Join Room
        </button>
      )}
    </motion.div>
  );
}
