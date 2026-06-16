import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { fetchJSON } from "@/lib/api";
import { SkeletonChart, SkeletonDashboardGrid } from "@/components/skeleton-layouts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const COLORS = ["hsl(var(--primary))", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444", "#10B981"];

function RetentionBar({ pct, label, color }: { pct: number | null; label: string; color: string }) {
  if (pct === null) return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-10">{label}</span>
      <span className="text-xs text-gray-300 italic">No data</span>
    </div>
  );
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-10">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold w-10 text-right" style={{ color }}>{pct}%</span>
    </div>
  );
}

export default function AnalyticsPage() {
  const [tab, setTab] = useState<"users" | "courses" | "ai" | "retention">("users");

  const { data: userData, isLoading: usersLoading } = useQuery({ queryKey: ["analytics-users"], queryFn: () => fetchJSON("/api/admin/analytics/users") });
  const { data: courseData, isLoading: coursesLoading } = useQuery({ queryKey: ["analytics-courses"], queryFn: () => fetchJSON("/api/admin/analytics/courses") });
  const { data: aiData, isLoading: aiLoading } = useQuery({ queryKey: ["analytics-ai"], queryFn: () => fetchJSON("/api/admin/analytics/ai") });
  const { data: retentionData, isLoading: retentionLoading } = useQuery({
    queryKey: ["analytics-retention"],
    queryFn: () => fetchJSON("/api/admin/analytics/retention"),
    enabled: tab === "retention",
  });
  const { data: engagementData } = useQuery({
    queryKey: ["analytics-engagement"],
    queryFn: () => fetchJSON("/api/admin/analytics/engagement"),
    enabled: tab === "retention",
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Analytics</h1>
        <p className="text-sm text-gray-500">Insights across users, courses, AI usage, and retention</p>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(["users", "courses", "ai", "retention"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md capitalize transition-all ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >{t}</button>
        ))}
      </div>

      {/* Users Tab */}
      {tab === "users" && (
        usersLoading ? (
          <div className="space-y-5"><SkeletonDashboardGrid cards={3} /><div className="grid md:grid-cols-2 gap-5"><SkeletonChart /><SkeletonChart /></div></div>
        ) : userData ? (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "New This Month", value: userData.newThisMonth },
                { label: "Total Active", value: userData.totalActive },
                { label: "Role Groups", value: userData.byRole?.length },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                  <p className="text-2xl font-bold text-primary">{s.value ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="grid md:grid-cols-2 gap-5">
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">User Growth (12 months)</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={(userData.growthChart || []).map((d: any) => ({ month: d.month?.slice(0, 7), users: d.users }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="users" stroke="hsl(var(--primary))" fill="#ccfbf1" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Users by Role</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={userData.byRole || []} dataKey="count" nameKey="role" cx="50%" cy="50%" outerRadius={80}
                      label={({ role, percent }: any) => `${role} ${(percent * 100).toFixed(0)}%`}>
                      {(userData.byRole || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : null
      )}

      {/* Courses Tab */}
      {tab === "courses" && (
        coursesLoading ? (
          <div className="space-y-5"><SkeletonDashboardGrid cards={5} /><SkeletonChart /></div>
        ) : courseData ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: "Total Courses", value: courseData.total_courses },
                { label: "Published", value: courseData.published },
                { label: "Drafts", value: courseData.drafts },
                { label: "Total Lessons", value: courseData.total_lessons },
                { label: "Total Homework", value: courseData.total_homework },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                  <p className="text-2xl font-bold text-blue-600">{s.value ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Enrollment Growth (12 months)</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={(courseData.enrollmentGrowth || []).map((d: any) => ({ month: d.month?.slice(0, 7), enrollments: d.enrollments }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="enrollments" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null
      )}

      {/* AI Tab */}
      {tab === "ai" && (
        aiLoading ? (
          <div className="space-y-5"><SkeletonDashboardGrid cards={3} /><SkeletonChart /></div>
        ) : aiData ? (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Monthly Interactions", value: aiData.monthly_interactions?.toLocaleString() },
                { label: "Total Interactions", value: aiData.total_interactions?.toLocaleString() },
                { label: "Active AI Users", value: aiData.active_ai_users?.toLocaleString() },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                  <p className="text-2xl font-bold text-purple-600">{s.value ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">AI Usage Growth (12 months)</h3>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={(aiData.aiGrowth || []).map((d: any) => ({ month: d.month?.slice(0, 7), interactions: d.interactions }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="interactions" stroke="#8B5CF6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null
      )}

      {/* Retention Tab */}
      {tab === "retention" && (
        retentionLoading ? (
          <div className="space-y-5"><SkeletonDashboardGrid cards={4} /><SkeletonChart /></div>
        ) : (
          <div className="space-y-5">
            {/* Retention rate cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Students", value: retentionData?.totalStudents ?? 0, color: "text-gray-900" },
                { label: "30-Day Retention", value: retentionData?.retention30d !== null ? `${retentionData?.retention30d}%` : "—", color: retentionData?.retention30d >= 70 ? "text-green-600" : "text-amber-600" },
                { label: "60-Day Retention", value: retentionData?.retention60d !== null ? `${retentionData?.retention60d}%` : "—", color: retentionData?.retention60d >= 60 ? "text-green-600" : "text-amber-600" },
                { label: "90-Day Retention", value: retentionData?.retention90d !== null ? `${retentionData?.retention90d}%` : "—", color: retentionData?.retention90d >= 50 ? "text-green-600" : "text-amber-600" },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Retention bars */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Retention Rates</h3>
              <div className="space-y-3">
                <RetentionBar pct={retentionData?.retention30d ?? null} label="30d" color="hsl(var(--primary))" />
                <RetentionBar pct={retentionData?.retention60d ?? null} label="60d" color="#3B82F6" />
                <RetentionBar pct={retentionData?.retention90d ?? null} label="90d" color="#8B5CF6" />
              </div>
              <p className="text-xs text-gray-400 mt-4">% of students who signed up 30/60/90+ days ago and are still active</p>
            </div>

            {/* Engagement funnel */}
            {engagementData?.funnelSteps && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="font-semibold text-gray-900 mb-1">Engagement Funnel (30 days)</h3>
                <p className="text-xs text-gray-400 mb-4">What % of active students use each feature</p>
                <div className="space-y-2">
                  {engagementData.funnelSteps.map((step: any, i: number) => (
                    <div key={step.step} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-36 truncate">{step.step}</span>
                      <div className="flex-1 h-5 bg-gray-100 rounded-md overflow-hidden">
                        <div
                          className="h-full rounded-md flex items-center px-2 text-[10px] font-semibold text-white transition-all"
                          style={{ width: `${Math.max(step.pct, 2)}%`, background: COLORS[i % COLORS.length] }}
                        >
                          {step.pct > 8 ? `${step.pct}%` : ""}
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-gray-700 w-10 text-right">{step.count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cohort retention table */}
            {retentionData?.cohortRetention?.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Monthly Cohort Retention</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-400 border-b border-gray-100">
                        <th className="text-left py-2 pr-4">Cohort</th>
                        <th className="text-right py-2 pr-4">Size</th>
                        <th className="text-right py-2">Retained</th>
                        <th className="text-right py-2">Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {retentionData.cohortRetention.map((row: any) => {
                        const rate = row.cohort_size > 0 ? Math.round((row.retained / row.cohort_size) * 100) : 0;
                        return (
                          <tr key={row.cohort_month} className="border-b border-gray-50">
                            <td className="py-2 pr-4 font-medium text-gray-700">{row.cohort_month}</td>
                            <td className="text-right py-2 pr-4 text-gray-500">{row.cohort_size}</td>
                            <td className="text-right py-2 pr-4 text-gray-500">{row.retained}</td>
                            <td className="text-right py-2">
                              <span className={`font-semibold ${rate >= 70 ? "text-green-600" : rate >= 50 ? "text-amber-600" : "text-red-500"}`}>
                                {rate}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!retentionData && (
              <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
                <p className="text-sm text-gray-400">Retention data will appear once students have been active for 30+ days.</p>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
