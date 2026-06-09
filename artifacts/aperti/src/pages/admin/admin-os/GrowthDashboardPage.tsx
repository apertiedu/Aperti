import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fetchJSON } from "@/lib/api";
import { TrendingUp, Users, Clock, CheckCircle2, Calendar, FileText, Rocket, BarChart3 } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  scheduled:   "bg-indigo-100 text-indigo-700",
  coming_soon: "bg-teal-100 text-teal-700",
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  webinar: "bg-blue-100 text-blue-700",
  launch:  "bg-purple-100 text-purple-700",
  training:"bg-teal-100 text-teal-700",
};

export default function GrowthDashboardPage() {
  const { data: growth, isLoading } = useQuery({
    queryKey: ["admin-growth"],
    queryFn: () => fetchJSON("/api/admin/growth"),
    refetchInterval: 30000,
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-400 text-sm">Loading growth data...</p>
      </div>
    </div>
  );

  const u = growth?.users || {};
  const f = growth?.features || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Growth Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Platform growth metrics, launches, and engagement at a glance</p>
        </div>
        <span className="text-xs text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" /> Auto-refreshes every 30s</span>
      </div>

      {/* User Metrics */}
      <div>
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">User Growth</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "Total Users", value: u.total_users || 0, icon: Users, color: "text-gray-600", bg: "bg-gray-50" },
            { label: "New (30d)", value: u.new_users_30d || 0, icon: TrendingUp, color: "text-teal-600", bg: "bg-teal-50" },
            { label: "New (7d)", value: u.new_users_7d || 0, icon: TrendingUp, color: "text-green-600", bg: "bg-green-50" },
            { label: "Teachers", value: u.teachers || 0, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Students", value: u.students || 0, icon: Users, color: "text-purple-600", bg: "bg-purple-50" },
          ].map((s) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`${s.bg} rounded-xl p-4 border border-white`}>
              <s.icon className={`w-4 h-4 ${s.color} mb-2`} />
              <p className="text-2xl font-bold text-gray-900">{parseInt(s.value).toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Feature Stats */}
      <div>
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Feature Portfolio</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "Total Features", value: f.total_features || 0, color: "bg-white text-gray-600" },
            { label: "Released", value: f.released || 0, color: "bg-green-50 text-green-700" },
            { label: "In Beta", value: f.beta || 0, color: "bg-orange-50 text-orange-700" },
            { label: "Coming Soon", value: f.coming_soon || 0, color: "bg-teal-50 text-teal-700" },
            { label: "Scheduled", value: f.scheduled || 0, color: "bg-indigo-50 text-indigo-700" },
          ].map((s) => (
            <div key={s.label} className={`${s.color} rounded-xl p-4 border border-gray-100 shadow-sm`}>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs opacity-70 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Launches */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Rocket className="w-4 h-4 text-teal-600" />
            <h3 className="font-semibold text-gray-800 text-sm">Upcoming Launches</h3>
          </div>
          <div className="p-4 space-y-3">
            {(growth?.upcoming_launches || []).length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No upcoming launches scheduled</p>
            ) : (
              growth.upcoming_launches.map((f: any) => (
                <div key={f.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{f.name}</p>
                    {f.release_date && <p className="text-xs text-gray-400">{new Date(f.release_date).toLocaleDateString()}</p>}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${STATUS_COLORS[f.status] || "bg-gray-100 text-gray-600"}`}>{f.status.replace("_", " ")}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <h3 className="font-semibold text-gray-800 text-sm">Upcoming Events</h3>
          </div>
          <div className="p-4 space-y-3">
            {(growth?.events || []).length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No upcoming events</p>
            ) : (
              growth.events.map((e: any) => (
                <div key={e.id} className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${EVENT_TYPE_COLORS[e.type] || "bg-gray-100 text-gray-600"}`}>{e.type}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-800">{e.title}</p>
                  {e.event_date && <p className="text-xs text-gray-400">{new Date(e.event_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Release Notes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-600" />
            <h3 className="font-semibold text-gray-800 text-sm">Recent Releases</h3>
          </div>
          <div className="p-4 space-y-3">
            {(growth?.release_notes || []).length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No published release notes</p>
            ) : (
              growth.release_notes.map((n: any) => (
                <div key={n.id} className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${n.type === "major" ? "bg-purple-100 text-purple-700" : n.type === "security" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>{n.type}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-800 line-clamp-1">{n.title}</p>
                  {n.published_at && <p className="text-xs text-gray-400">{new Date(n.published_at).toLocaleDateString()}</p>}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Conversion Summary */}
      {(growth?.conversion || []).length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Conversion Events (30d)</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {growth.conversion.map((ev: any) => (
              <div key={ev.event_type} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-2xl font-bold text-gray-900">{parseInt(ev.count).toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-0.5">{ev.event_type.replace(/_/g, " ")}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Waitlist */}
      {growth?.waitlist && (
        <div className="bg-gradient-to-r from-teal-500 to-teal-600 rounded-xl p-5 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-3xl font-bold">{parseInt(growth.waitlist.total).toLocaleString()}</p>
              <p className="text-teal-100 text-sm">Total users on feature waitlists</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
