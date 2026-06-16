import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fetchJSON } from "@/lib/api";
import { BarChart3, Users, TrendingUp, Package, CheckCircle2, Clock, Zap, Activity, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";


const STATUS_COLORS: Record<string, string> = {
  released:    "bg-green-100 text-green-700",
  beta:        "bg-orange-100 text-orange-700",
  coming_soon: "bg-primary/15 text-primary",
  scheduled:   "bg-indigo-100 text-indigo-700",
  draft:       "bg-gray-100 text-gray-600",
  deprecated:  "bg-red-100 text-red-600",
};

export default function FeatureAdoptionPage() {
  const [tab, setTab] = useState("registry");

  const { data: adoption = [], isLoading: regLoading } = useQuery({
    queryKey: ["admin-feature-adoption"],
    queryFn: () => fetchJSON("/api/admin/analytics/feature-adoption"),
    refetchInterval: 60000,
  });

  const { data: liveUsage, isLoading: usageLoading } = useQuery({
    queryKey: ["admin-feature-usage"],
    queryFn: () => fetchJSON("/api/admin/feature-usage"),
    refetchInterval: 30000,
  });

  const totalWaitlist = adoption.reduce((s: number, f: any) => s + (parseInt(f.waitlist_count) || 0), 0);
  const totalBeta     = adoption.reduce((s: number, f: any) => s + (parseInt(f.beta_count) || 0), 0);
  const released      = adoption.filter((f: any) => f.status === "released").length;

  const heatmap: any[] = liveUsage?.heatmap ?? [];
  const timeline: any[] = liveUsage?.timeline ?? [];
  const topUsers: any[] = liveUsage?.topUsers ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Feature Adoption</h1>
        <p className="text-sm text-gray-500 mt-0.5">Feature registry, waitlist metrics, and live usage intelligence</p>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Features tracked", value: adoption.length,          icon: Package,      color: "text-gray-600",   bg: "bg-gray-50" },
          { label: "Released",         value: released,                  icon: CheckCircle2, color: "text-green-600",  bg: "bg-green-50" },
          { label: "Waitlist signups", value: totalWaitlist,             icon: Users,        color: "text-primary",   bg: "bg-primary/8" },
          { label: "Live events (30d)", value: liveUsage?.totalEvents ?? 0, icon: Activity, color: "text-blue-600",   bg: "bg-blue-50" },
        ].map(s => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`${s.bg} rounded-xl p-4`}>
            <s.icon className={`w-4 h-4 ${s.color} mb-2`} />
            <p className="text-2xl font-bold text-gray-900">{s.value.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </motion.div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="registry">Feature Registry</TabsTrigger>
          <TabsTrigger value="live">
            Live Usage
            {heatmap.length > 0 && <span className="ml-1.5 bg-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{heatmap.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="users">Power Users</TabsTrigger>
        </TabsList>

        {/* REGISTRY TAB */}
        <TabsContent value="registry" className="mt-4 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-gray-400" />
              <h3 className="font-semibold text-gray-800">Per-Feature Metrics</h3>
            </div>
            {regLoading ? (
              <div className="p-8 space-y-3">
                {[0,1,2,3,4].map(i => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
              </div>
            ) : adoption.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Package className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No features registered yet</p>
                <p className="text-xs mt-1 opacity-70">Add features via the Feature Registry to track them here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-5 py-3 text-left">Feature</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-right">Waitlist</th>
                      <th className="px-4 py-3 text-right">Beta</th>
                      <th className="px-4 py-3 text-left">Release Date</th>
                      <th className="px-5 py-3 text-right">Interest</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {adoption.map((f: any, i: number) => {
                      const waitlist = parseInt(f.waitlist_count) || 0;
                      const beta = parseInt(f.beta_count) || 0;
                      const score = waitlist * 2 + beta * 5;
                      const maxScore = Math.max(...adoption.map((x: any) => (parseInt(x.waitlist_count)||0)*2 + (parseInt(x.beta_count)||0)*5), 1);
                      const barPct = Math.round((score / maxScore) * 100);
                      return (
                        <motion.tr key={f.feature_id || i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                          className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-3.5">
                            <p className="font-medium text-gray-900 text-sm">{f.name}</p>
                            <p className="text-xs text-gray-400">{f.category || f.owner || "—"}</p>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[f.status] ?? "bg-gray-100 text-gray-500"}`}>
                              {f.status?.replace(/_/g, " ").toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <span className="text-sm font-semibold text-gray-900">{waitlist.toLocaleString()}</span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <span className="text-sm font-semibold text-gray-900">{beta.toLocaleString()}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              {f.release_date ? (
                                <><Clock className="w-3 h-3" />{new Date(f.release_date).toLocaleDateString()}</>
                              ) : "—"}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2 justify-end">
                              <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all" className="bg-primary h-full rounded-full transition-all" style={{ width: `${barPct}%` }} />
                              </div>
                              <span className="text-xs font-semibold text-gray-700 w-6 text-right">{score}</span>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* LIVE USAGE TAB */}
        <TabsContent value="live" className="mt-4 space-y-4">
          {usageLoading ? (
            <div className="space-y-3">
              {[0,1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : heatmap.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl text-gray-400">
              <Zap className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No usage events recorded yet</p>
              <p className="text-xs mt-1 opacity-70">Usage will appear here as users navigate the platform.</p>
            </div>
          ) : (
            <>
              {/* Usage heatmap */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-gray-800">Feature Usage Heatmap (30d)</h3>
                  <span className="ml-auto text-xs text-gray-400">{liveUsage?.totalEvents?.toLocaleString()} total events</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {heatmap.slice(0, 20).map((f: any, i: number) => {
                    const maxUses = Math.max(...heatmap.map((x: any) => parseInt(x.uses_30d) || 0), 1);
                    const pct = Math.round(((parseInt(f.uses_30d) || 0) / maxUses) * 100);
                    return (
                      <motion.div key={f.feature_key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                        className="px-5 py-3 flex items-center gap-4 hover:bg-gray-50/50 transition-colors">
                        <div className="w-40 shrink-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{f.feature_key.replace(/_/g, " ")}</p>
                          <p className="text-[10px] text-gray-400">{f.feature_category}</p>
                        </div>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <motion.div className="h-full rounded-full" className="bg-primary text-primary-foreground"
                            initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, delay: i * 0.03 }} />
                        </div>
                        <div className="text-right shrink-0 w-24">
                          <p className="text-sm font-bold text-gray-900">{parseInt(f.uses_30d).toLocaleString()}</p>
                          <p className="text-[10px] text-gray-400">{parseInt(f.unique_users)} users</p>
                        </div>
                        <span className="text-[10px] text-gray-300 shrink-0 w-20 text-right">last: {f.last_used ? new Date(f.last_used).toLocaleDateString() : "—"}</span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Daily timeline */}
              {timeline.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" /> Daily Activity (30d)
                  </h3>
                  <div className="flex items-end gap-1 h-20">
                    {timeline.map((d: any, i: number) => {
                      const maxEvents = Math.max(...timeline.map((x: any) => parseInt(x.events) || 0), 1);
                      const h = Math.max(Math.round((parseInt(d.events) / maxEvents) * 100), 4);
                      return (
                        <div key={d.day} className="flex-1 flex flex-col items-center gap-1" title={`${d.day}: ${d.events} events`}>
                          <div className="w-full rounded-sm transition-all" className="bg-primary w-full rounded-sm transition-all" />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[10px] text-gray-300">
                    <span>{timeline[0]?.day}</span>
                    <span>{timeline[timeline.length - 1]?.day}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* POWER USERS TAB */}
        <TabsContent value="users" className="mt-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400" />
              <h3 className="font-semibold text-gray-800">Most Active Users (30d)</h3>
            </div>
            {usageLoading ? (
              <div className="p-6 space-y-3">{[0,1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}</div>
            ) : topUsers.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Users className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No usage data yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {topUsers.map((u: any, i: number) => (
                  <div key={u.username} className="px-5 py-3.5 flex items-center gap-4">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0"
                      className={i < 3 ? "bg-primary" : "bg-slate-400"}>
                      {i + 1}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-primary/8 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {(u.display_name || u.username)?.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{u.display_name || u.username}</p>
                      <p className="text-xs text-gray-400 capitalize">{u.role}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-900">{parseInt(u.total_events).toLocaleString()}</p>
                      <p className="text-[10px] text-gray-400">{u.distinct_features} features</p>
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-primary shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
