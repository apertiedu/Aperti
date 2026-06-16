import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { fetchJSON, postJSON, putJSON } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Calendar, Video, BookOpen, Trophy, Wrench, Edit2, ExternalLink } from "lucide-react";

const TYPE_META: Record<string, { label: string; icon: any; color: string }> = {
  webinar:     { label: "Webinar",     icon: Video,     color: "bg-blue-100 text-blue-700" },
  launch:      { label: "Launch",      icon: Trophy,    color: "bg-purple-100 text-purple-700" },
  training:    { label: "Training",    icon: BookOpen,  color: "bg-primary/15 text-primary" },
  competition: { label: "Competition", icon: Trophy,    color: "bg-yellow-100 text-yellow-700" },
  workshop:    { label: "Workshop",    icon: Wrench,    color: "bg-orange-100 text-orange-700" },
};

const EMPTY = { title: "", description: "", event_date: "", registration_url: "", capacity: "", type: "webinar", is_published: true };

export default function EventsAdminPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(EMPTY);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["admin-events"],
    queryFn: () => fetchJSON("/api/admin/events"),
  });

  const saveMutation = useMutation({
    mutationFn: () => editing ? putJSON(`/api/admin/events/${editing.id}`, form) : postJSON("/api/admin/events", form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-events"] }); toast.success("Saved"); closeModal(); },
    onError: () => toast.error("Save failed"),
  });

  function openCreate() { setEditing(null); setForm(EMPTY); setShowModal(true); }
  function openEdit(e: any) { setEditing(e); setForm({ ...e, event_date: e.event_date ? new Date(e.event_date).toISOString().slice(0, 16) : "" }); setShowModal(true); }
  function closeModal() { setShowModal(false); setEditing(null); setForm(EMPTY); }

  const upcoming = events.filter((e: any) => new Date(e.event_date) > new Date());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          <p className="text-sm text-gray-500 mt-0.5">{upcoming.length} upcoming · {events.length} total</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/80 transition-colors">
          <Plus className="w-4 h-4" /> New Event
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && <div className="col-span-3 space-y-3 animate-pulse">{[1,2,3].map(i => <div key={i} className="h-32 bg-gray-100 rounded-xl" />)}</div>}
        {!isLoading && events.length === 0 && (
          <div className="col-span-3 bg-white rounded-xl p-12 text-center border border-gray-100 shadow-sm">
            <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No events yet. Create your first event.</p>
          </div>
        )}
        {events.map((event: any) => {
          const meta = TYPE_META[event.type] || TYPE_META.webinar;
          const EventIcon = meta.icon;
          const isPast = new Date(event.event_date) < new Date();
          return (
            <motion.div key={event.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3 ${isPast ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
                  <EventIcon className="w-3 h-3 inline mr-1" />{meta.label}
                </span>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(event)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{event.title}</h3>
                {event.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{event.description}</p>}
              </div>
              <div className="space-y-1 text-xs text-gray-500">
                {event.event_date && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(event.event_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                )}
                {event.capacity && <p>Capacity: {event.capacity}</p>}
              </div>
              {event.registration_url && (
                <a href={event.registration_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:text-primary transition-colors">
                  <ExternalLink className="w-3 h-3" /> Registration Link
                </a>
              )}
              {!event.is_published && <span className="text-xs text-yellow-600 font-medium">⚠ Hidden from public</span>}
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100"><h2 className="text-lg font-bold text-gray-900">{editing ? "Edit Event" : "New Event"}</h2></div>
              <div className="px-6 py-4 space-y-4">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Title *</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Description</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                    <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Date & Time</label><input type="datetime-local" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" /></div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Capacity</label><input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" /></div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Registration URL</label><input value={form.registration_url} onChange={(e) => setForm({ ...form, registration_url: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" /></div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} className="w-4 h-4 rounded text-primary" /><span className="text-sm text-gray-700">Published publicly</span></label>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
                <button onClick={closeModal} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={() => saveMutation.mutate()} disabled={!form.title || saveMutation.isPending} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/80 disabled:opacity-50">
                  {saveMutation.isPending ? "Saving..." : editing ? "Update" : "Create Event"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
