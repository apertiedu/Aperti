import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fetchJSON } from "@/lib/api";
import { Users, TrendingUp, ArrowRight } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

const ROLE_COLORS: Record<string, string> = {
  student: "#0D9488",
  teacher: "#3B82F6",
  parent: "#8B5CF6",
  admin: "#F59E0B",
};
const PIE_COLORS = ["#0D9488", "#3B82F6", "#8B5CF6", "#F59E0B", "#10B981"];

export default function FounderGrowthPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["founder-growth"],
    queryFn: () => fetchJSON("/api/founder/growth"),
  });

  const daily = data?.daily ?? [];
  const planDist = data?.planDistribution ?? [];
  const byRole = data?.byRole ?? [];
  const funnel = data?.funnel ?? {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Growth Analytics</h1>
        <p className="text-sm text-gray-500 mt-0.5">Signups, funnel, and plan distribution</p>
      </div>

      {/* Funnel */}
      {!isLoading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Conversion Funnel (last 30 days)</h3>
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {[
              { label: "Registrations", value: funnel.registrations ?? 0, color: "bg-teal-100 text-teal-700 border-teal-200" },
              { label: "Active Users", value: funnel.activeUsers ?? 0, color: "bg-blue-100 text-blue-700 border-blue-200" },
              { label: "Subscribers", value: funnel.subscribers ?? 0, color: "bg-purple-100 text-purple-700 border-purple-200" },
            ].map((step, i, arr) => (
              <div key={step.label} className="flex items-center gap-2 flex-shrink-0">
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className={`px-5 py-4 rounded-xl border ${step.color} text-center min-w-[120px]`}>
                  <p className="text-2xl font-bold">{step.value.toLocaleString()}</p>
                  <p className="text-xs font-medium mt-0.5">{step.label}</p>
                  {i > 0 && arr[i - 1].value > 0 && (
                    <p className="text-xs opacity-70 mt-0.5">
                      {((step.value / arr[i - 1].value) * 100).toFixed(1)}% conversion
                    </p>
                  )}
                </motion.div>
                {i < arr.length - 1 && <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
              </div>
            ))}
            <div className="ml-4 px-4 py-2 bg-green-50 border border-green-200 rounded-xl text-center">
              <p className="text-xl font-bold text-green-700">{funnel.conversionRate ?? 0}%</p>
              <p className="text-xs text-green-600">Overall conversion</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily signups */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Daily Signups (30 days)</h3>
          {isLoading ? (
            <div className="animate-pulse bg-gray-100 h-48 rounded-lg" />
          ) : daily.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No signup data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={daily}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip labelFormatter={(v) => `Date: ${v}`} formatter={(v: any) => [v, "Signups"]} />
                <Area type="monotone" dataKey="signups" stroke="#0D9488" fill="#ccfbf1" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Plan distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Active Subscriptions by Plan</h3>
          {isLoading ? (
            <div className="animate-pulse bg-gray-100 h-48 rounded-lg" />
          ) : planDist.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No subscription data yet</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={planDist} dataKey="count" nameKey="plan" cx="50%" cy="50%" outerRadius={65} innerRadius={30}>
                    {planDist.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => [v, "Subscribers"]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 flex flex-wrap gap-2 justify-center">
                {planDist.map((p: any, i: number) => (
                  <div key={p.plan} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    {p.plan} ({p.count})
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Users by role */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Active Users by Role</h3>
        {isLoading ? (
          <div className="animate-pulse bg-gray-100 h-24 rounded-lg" />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {byRole.map((r: any) => {
              const color = ROLE_COLORS[r.role] ?? "#6B7280";
              return (
                <motion.div key={r.role} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="text-center p-4 rounded-xl border border-gray-100">
                  <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center"
                    style={{ background: `${color}20` }}>
                    <Users className="w-5 h-5" style={{ color }} />
                  </div>
                  <p className="text-xl font-bold text-gray-900">{parseInt(r.count).toLocaleString()}</p>
                  <p className="text-xs text-gray-500 capitalize mt-0.5">{r.role}</p>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
