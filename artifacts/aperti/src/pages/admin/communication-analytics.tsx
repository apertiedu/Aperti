import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  BarChart2, TrendingUp, MessageSquare, Users, Megaphone,
  Ticket, BookOpen, Zap, Activity, Calendar,
} from "lucide-react";

const token = () => localStorage.getItem("token") ?? "";
const fetchJSON = (url: string) =>
  fetch(url, { headers: { Authorization: `Bearer ${token()}` } }).then((r) => r.json());

type CommAnalytics = {
  summary: {
    total_threads: number; total_messages: number; total_announcements: number;
    total_tickets: number; open_tickets: number; resolved_tickets: number;
    active_rooms: number; total_channels: number;
  };
  top_messagers: Array<{ name: string; role: string; message_count: number }>;
  ticket_stats: Array<{ status: string; count: number }>;
  daily_activity: Array<{ day: string; count: number }>;
  channel_activity: Array<{ channel_name: string; message_count: number; course_name: string | null }>;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CommunicationAnalytics() {
  const [period, setPeriod] = useState(30);

  const { data, isLoading } = useQuery<CommAnalytics>({
    queryKey: ["comm-analytics", period],
    queryFn: () => fetchJSON(`/api/analytics/communication?days=${period}`),
    refetchInterval: 60000,
  });

  const summary = data?.summary;
  const topMessagers = data?.top_messagers ?? [];
  const ticketStats = data?.ticket_stats ?? [];
  const dailyActivity = data?.daily_activity ?? [];
  const channelActivity = data?.channel_activity ?? [];

  const maxDaily = Math.max(...dailyActivity.map((d) => d.count), 1);

  return (
    <div className="max-w-5xl mx-auto p-6 font-[Inter,sans-serif]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
            <BarChart2 className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Communication Analytics</h1>
            <p className="text-sm text-gray-500">Platform-wide messaging and engagement insights</p>
          </div>
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setPeriod(d)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${period === d ? "bg-white text-gray-900 shadow-sm font-medium" : "text-gray-600"}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Loading analytics…</div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Total Messages", value: summary?.total_messages ?? 0, icon: <MessageSquare className="w-5 h-5" />, color: "text-teal-600 bg-teal-50" },
              { label: "Active Rooms", value: summary?.active_rooms ?? 0, icon: <Users className="w-5 h-5" />, color: "text-blue-600 bg-blue-50" },
              { label: "Announcements", value: summary?.total_announcements ?? 0, icon: <Megaphone className="w-5 h-5" />, color: "text-purple-600 bg-purple-50" },
              { label: "Open Tickets", value: summary?.open_tickets ?? 0, icon: <Ticket className="w-5 h-5" />, color: "text-red-600 bg-red-50" },
            ].map((card, i) => (
              <motion.div key={card.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${card.color}`}>
                  {card.icon}
                </div>
                <p className="text-2xl font-bold text-gray-900">{card.value.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            {/* Daily activity heatmap */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-gray-500" /> Daily Message Activity (last {period}d)
              </h3>
              {dailyActivity.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">No activity data yet</div>
              ) : (
                <div className="flex items-end gap-1 h-32">
                  {dailyActivity.slice(-28).map((d, i) => {
                    const height = Math.max(4, Math.round((d.count / maxDaily) * 100));
                    const date = new Date(d.day);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                        <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-900 text-white text-[10px] px-2 py-1 rounded-lg whitespace-nowrap z-10">
                          {d.count} msgs · {date.toLocaleDateString()}
                        </div>
                        <motion.div initial={{ height: 0 }} animate={{ height: `${height}%` }}
                          transition={{ delay: i * 0.01 }}
                          className="w-full bg-teal-400 rounded-t-sm min-h-[4px] hover:bg-teal-500 transition-colors" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Ticket stats */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Ticket className="w-4 h-4 text-gray-500" /> Ticket Status Breakdown
              </h3>
              {ticketStats.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">No tickets</div>
              ) : (
                <div className="space-y-3">
                  {ticketStats.map((t) => {
                    const total = ticketStats.reduce((a, b) => a + Number(b.count), 0);
                    const pct = Math.round((Number(t.count) / total) * 100);
                    const colors: Record<string, string> = {
                      open: "bg-blue-400", resolved: "bg-green-400",
                      in_progress: "bg-amber-400", closed: "bg-gray-300",
                    };
                    return (
                      <div key={t.status}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-600 capitalize">{t.status.replace("_", " ")}</span>
                          <span className="font-medium">{t.count}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                            className={`h-full rounded-full ${colors[t.status] ?? "bg-gray-400"}`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top messagers */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-gray-500" /> Most Active Users
              </h3>
              {topMessagers.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">No data</div>
              ) : (
                <div className="space-y-2">
                  {topMessagers.slice(0, 8).map((u, i) => {
                    const maxMsgs = topMessagers[0]?.message_count ?? 1;
                    const pct = Math.round((u.message_count / maxMsgs) * 100);
                    const roleColors: Record<string, string> = {
                      admin: "bg-red-100 text-red-700",
                      teacher: "bg-blue-100 text-blue-700",
                      student: "bg-teal-100 text-teal-700",
                    };
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                        <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-semibold text-teal-700">{u.name[0]}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-xs font-medium text-gray-900 truncate">{u.name}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full capitalize ${roleColors[u.role] ?? "bg-gray-100 text-gray-500"}`}>{u.role}</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                              className="h-full bg-teal-400 rounded-full" />
                          </div>
                        </div>
                        <span className="text-xs text-gray-500 flex-shrink-0">{u.message_count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Channel activity */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-gray-500" /> Most Active Class Channels
              </h3>
              {channelActivity.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">No channel activity</div>
              ) : (
                <div className="space-y-2">
                  {channelActivity.slice(0, 8).map((ch, i) => {
                    const maxMsgs = channelActivity[0]?.message_count ?? 1;
                    const pct = Math.round((ch.message_count / maxMsgs) * 100);
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs font-medium text-gray-900 truncate">{ch.channel_name}</span>
                            <span className="text-xs text-gray-500 ml-2 flex-shrink-0">{ch.message_count}</span>
                          </div>
                          {ch.course_name && (
                            <p className="text-[10px] text-gray-400 mb-0.5 truncate">{ch.course_name}</p>
                          )}
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                              className="h-full bg-blue-400 rounded-full" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
