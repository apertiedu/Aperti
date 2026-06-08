import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, BellOff, MessageSquare, Megaphone, Ticket, Users,
  BookOpen, Zap, Settings2, Check, ChevronRight, Sparkles,
} from "lucide-react";
import { useAuth } from "@/context/auth";

const token = () => localStorage.getItem("token") ?? "";
const fetchJSON = (url: string) =>
  fetch(url, { headers: { Authorization: `Bearer ${token()}` } }).then((r) => r.json());
const putJSON = (url: string, body: unknown) =>
  fetch(url, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` }, body: JSON.stringify(body) }).then((r) => r.json());

type NotifPref = {
  id: number; user_id: number; category: string; delivery_method: string;
  enabled: boolean; frequency: string;
};

const CATEGORIES = [
  { key: "messages", label: "Direct Messages", icon: <MessageSquare className="w-4 h-4" />, color: "text-teal-600 bg-teal-50" },
  { key: "announcements", label: "Announcements", icon: <Megaphone className="w-4 h-4" />, color: "text-blue-600 bg-blue-50" },
  { key: "assignments", label: "Assignments & Homework", icon: <BookOpen className="w-4 h-4" />, color: "text-amber-600 bg-amber-50" },
  { key: "exams", label: "Exams & Results", icon: <Zap className="w-4 h-4" />, color: "text-red-600 bg-red-50" },
  { key: "tickets", label: "Support Tickets", icon: <Ticket className="w-4 h-4" />, color: "text-purple-600 bg-purple-50" },
  { key: "rooms", label: "Collaboration Rooms", icon: <Users className="w-4 h-4" />, color: "text-indigo-600 bg-indigo-50" },
  { key: "ai_insights", label: "AI Insights & Tips", icon: <Sparkles className="w-4 h-4" />, color: "text-pink-600 bg-pink-50" },
];

const FREQUENCIES = ["instant", "hourly", "daily", "weekly"];
const METHODS = ["in_app", "email", "push"];

function methodLabel(m: string) {
  return m === "in_app" ? "In-App" : m === "email" ? "Email" : "Push";
}

export default function NotificationCenter() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [saving, setSaving] = useState<string | null>(null);
  const [localPrefs, setLocalPrefs] = useState<Record<string, Partial<NotifPref>>>({});

  const { data: prefs = [], isLoading } = useQuery<NotifPref[]>({
    queryKey: ["notif-prefs"],
    queryFn: () => fetchJSON("/api/notifications/preferences"),
  });

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => putJSON("/api/notifications/preferences", body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notif-prefs"] }); setSaving(null); },
  });

  function getPref(category: string): NotifPref | undefined {
    return prefs.find((p) => p.category === category);
  }

  function getLocal(category: string, field: keyof NotifPref) {
    return localPrefs[category]?.[field] ?? getPref(category)?.[field];
  }

  function setLocal(category: string, field: keyof NotifPref, value: unknown) {
    setLocalPrefs((prev) => ({
      ...prev,
      [category]: { ...prev[category], [field]: value },
    }));
  }

  function save(category: string) {
    setSaving(category);
    const local = localPrefs[category] ?? {};
    const base = getPref(category);
    saveMutation.mutate({
      category,
      enabled: local.enabled ?? base?.enabled ?? true,
      delivery_method: local.delivery_method ?? base?.delivery_method ?? "in_app",
      frequency: local.frequency ?? base?.frequency ?? "instant",
    });
  }

  const hasChanges = (category: string) => !!localPrefs[category] && Object.keys(localPrefs[category]).length > 0;

  return (
    <div className="max-w-2xl mx-auto p-6 font-[Inter,sans-serif]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
          <Bell className="w-5 h-5 text-teal-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Notification Preferences</h1>
          <p className="text-sm text-gray-500">Control how and when Aperti notifies you</p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Loading preferences…</div>
      ) : (
        <div className="space-y-3">
          {CATEGORIES.map((cat) => {
            const enabled = getLocal(cat.key, "enabled") !== false;
            const freq = (getLocal(cat.key, "frequency") as string) ?? "instant";
            const method = (getLocal(cat.key, "delivery_method") as string) ?? "in_app";
            const dirty = hasChanges(cat.key);

            return (
              <motion.div key={cat.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${cat.color}`}>
                        {cat.icon}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{cat.label}</p>
                        <p className="text-xs text-gray-400">{enabled ? `${methodLabel(method)} · ${freq}` : "Disabled"}</p>
                      </div>
                    </div>
                    {/* Toggle */}
                    <button
                      onClick={() => setLocal(cat.key, "enabled", !enabled)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? "bg-teal-500" : "bg-gray-200"}`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                  </div>

                  <AnimatePresence>
                    {enabled && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden">
                        <div className="pt-3 border-t border-gray-50 space-y-3">
                          {/* Delivery method */}
                          <div>
                            <p className="text-xs text-gray-500 mb-1.5 font-medium">Delivery</p>
                            <div className="flex gap-2">
                              {METHODS.map((m) => (
                                <button key={m} onClick={() => setLocal(cat.key, "delivery_method", m)}
                                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${method === m ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
                                  {methodLabel(m)}
                                </button>
                              ))}
                            </div>
                          </div>
                          {/* Frequency */}
                          <div>
                            <p className="text-xs text-gray-500 mb-1.5 font-medium">Frequency</p>
                            <div className="flex gap-2">
                              {FREQUENCIES.map((f) => (
                                <button key={f} onClick={() => setLocal(cat.key, "frequency", f)}
                                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors capitalize ${freq === f ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
                                  {f}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {dirty && (
                  <div className="px-4 pb-4">
                    <button onClick={() => save(cat.key)}
                      disabled={saving === cat.key}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-60">
                      <Check className="w-3.5 h-3.5" /> {saving === cat.key ? "Saving…" : "Save changes"}
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Global actions */}
      <div className="mt-6 flex gap-3">
        <button
          onClick={() => {
            CATEGORIES.forEach((c) => setLocal(c.key, "enabled", false));
            CATEGORIES.forEach((c) => save(c.key));
          }}
          className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-colors">
          <BellOff className="w-4 h-4" /> Disable All
        </button>
        <button
          onClick={() => {
            CATEGORIES.forEach((c) => setLocal(c.key, "enabled", true));
            CATEGORIES.forEach((c) => save(c.key));
          }}
          className="flex items-center gap-2 px-4 py-2 text-sm text-teal-700 bg-teal-50 rounded-xl hover:bg-teal-100 transition-colors">
          <Bell className="w-4 h-4" /> Enable All
        </button>
      </div>
    </div>
  );
}
