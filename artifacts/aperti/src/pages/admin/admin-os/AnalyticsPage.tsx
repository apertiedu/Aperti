import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { fetchJSON } from "@/lib/api";

const COLORS = ["#0D9488", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444", "#10B981"];

export default function AnalyticsPage() {
  const [tab, setTab] = useState<"users" | "courses" | "ai">("users");

  const { data: userData } = useQuery({ queryKey: ["analytics-users"], queryFn: () => fetchJSON("/api/admin/analytics/users") });
  const { data: courseData } = useQuery({ queryKey: ["analytics-courses"], queryFn: () => fetchJSON("/api/admin/analytics/courses") });
  const { data: aiData } = useQuery({ queryKey: ["analytics-ai"], queryFn: () => fetchJSON("/api/admin/analytics/ai") });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Analytics</h1>
        <p className="text-sm text-gray-500">Insights across users, courses, and AI usage</p>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(["users", "courses", "ai"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 text-sm font-medium rounded-md capitalize transition-all ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>{t}</button>
        ))}
      </div>

      {tab === "users" && userData && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "New This Month", value: userData.newThisMonth },
              { label: "Total Active", value: userData.totalActive },
              { label: "Role Groups", value: userData.byRole?.length },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                <p className="text-2xl font-bold text-teal-600">{s.value}</p>
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
                  <Area type="monotone" dataKey="users" stroke="#0D9488" fill="#ccfbf1" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Users by Role</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={userData.byRole || []} dataKey="count" nameKey="role" cx="50%" cy="50%" outerRadius={80} label={({ role, percent }: any) => `${role} ${(percent * 100).toFixed(0)}%`}>
                    {(userData.byRole || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {tab === "courses" && courseData && (
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
      )}

      {tab === "ai" && aiData && (
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
      )}
    </div>
  );
}
