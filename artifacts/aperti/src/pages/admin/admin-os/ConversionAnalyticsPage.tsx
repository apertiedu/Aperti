import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fetchJSON } from "@/lib/api";
import { BarChart3, TrendingUp, MousePointer, Package, Users } from "lucide-react";

const EVENT_ICONS: Record<string, any> = {
  page_view: MousePointer, signup: Users, subscription: Package,
  waitlist_join: Users, feature_interest: Package, pricing_click: BarChart3, demo_start: TrendingUp,
};

const EVENT_COLORS: Record<string, string> = {
  page_view: "bg-gray-100 text-gray-600",
  signup: "bg-green-100 text-green-700",
  subscription: "bg-blue-100 text-blue-700",
  waitlist_join: "bg-yellow-100 text-yellow-700",
  feature_interest: "bg-teal-100 text-teal-700",
  pricing_click: "bg-purple-100 text-purple-700",
  demo_start: "bg-orange-100 text-orange-700",
};

export default function ConversionAnalyticsPage() {
  const [days, setDays] = useState("30");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-conversion", days],
    queryFn: () => fetchJSON(`/api/admin/analytics/conversion?days=${days}`),
  });

  const { data: adoption = [], isLoading: loadingAdoption } = useQuery({
    queryKey: ["admin-adoption"],
    queryFn: () => fetchJSON("/api/admin/analytics/feature-adoption"),
  });

  const funnel: any[] = data?.funnel || [];
  const trend: any[] = data?.trend || [];
  const topEvents: any[] = data?.top_events || [];

  const maxTrend = Math.max(...trend.map((t: any) => parseInt(t.events) || 0), 1);
  const maxFunnel = Math.max(...funnel.map((f: any) => parseInt(f.count) || 0), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Conversion Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">Funnel analysis, signup trends, and feature adoption</p>
        </div>
        <select value={days} onChange={(e) => setDays(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversion Funnel */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Conversion Funnel</h3>
            <p className="text-xs text-gray-400 mt-0.5">Events in the last {days} days</p>
          </div>
          <div className="p-5 space-y-3">
            {isLoading ? (
              <div className="text-center text-gray-400 py-8 text-sm">Loading...</div>
            ) : funnel.length === 0 ? (
              <div className="text-center text-gray-400 py-8 text-sm">No conversion events tracked yet.<br/><span className="text-xs">Events are recorded when users interact with public pages.</span></div>
            ) : (
              funnel.map((item: any) => {
                const IconComp = EVENT_ICONS[item.event_type] || BarChart3;
                const pct = Math.round((parseInt(item.count) / maxFunnel) * 100);
                return (
                  <div key={item.event_type} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${EVENT_COLORS[item.event_type] || "bg-gray-100 text-gray-600"}`}>
                          <IconComp className="w-3 h-3 inline mr-0.5" />{item.event_type.replace(/_/g, " ")}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-gray-800">{parseInt(item.count).toLocaleString()}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} className="h-full bg-teal-500 rounded-full" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Daily Trend */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Daily Events Trend</h3>
            <p className="text-xs text-gray-400 mt-0.5">Total events per day</p>
          </div>
          <div className="p-5">
            {isLoading ? (
              <div className="text-center text-gray-400 py-8 text-sm">Loading...</div>
            ) : trend.length === 0 ? (
              <div className="text-center text-gray-400 py-8 text-sm">No trend data yet</div>
            ) : (
              <div className="flex items-end gap-1 h-32">
                {trend.slice(-30).map((t: any, i: number) => {
                  const pct = (parseInt(t.events) / maxTrend) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5 group" title={`${t.date}: ${t.events} events`}>
                      <motion.div initial={{ height: 0 }} animate={{ height: `${Math.max(pct, 2)}%` }} transition={{ duration: 0.5, delay: i * 0.01 }} className="w-full bg-teal-500 rounded-t group-hover:bg-teal-600 transition-colors cursor-pointer" style={{ minHeight: 2 }} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Feature Adoption */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Feature Adoption</h3>
          <p className="text-xs text-gray-400 mt-0.5">Waitlist signups, beta testers, and early access per feature</p>
        </div>
        <div className="overflow-x-auto">
          {loadingAdoption ? (
            <div className="text-center text-gray-400 py-8 text-sm">Loading...</div>
          ) : adoption.length === 0 ? (
            <div className="text-center text-gray-400 py-8 text-sm">No feature data</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Feature</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Waitlist</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Beta Testers</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Early Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {adoption.map((f: any) => (
                  <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800">{f.name}</td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{f.category || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{f.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-700">{f.waitlist_count || 0}</td>
                    <td className="px-4 py-3 text-right text-gray-600 hidden lg:table-cell">{f.beta_testers || 0}</td>
                    <td className="px-4 py-3 text-right text-gray-600 hidden lg:table-cell">{f.early_access_users || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
