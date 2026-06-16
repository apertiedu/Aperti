import { useQuery } from "@tanstack/react-query";
import { fetchJSON } from "@/lib/api";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, Legend,
} from "recharts";
import { Users, TrendingUp, DollarSign, Activity, AlertTriangle, RefreshCw } from "lucide-react";
import { SkeletonChart, SkeletonDashboardGrid } from "@/components/skeleton-layouts";

const COLORS = ["hsl(var(--primary))", "#2563EB", "#7C3AED", "#D97706", "#DC2626", "#059669"];

function SectionCard({ title, subtitle, icon: Icon, children }: {
  title: string; subtitle?: string; icon: any; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">{title}</p>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function StatRow({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <p className="text-sm text-gray-600">{label}</p>
      <div className="text-right">
        <p className="text-sm font-bold text-gray-900">{value}</p>
        {detail && <p className="text-xs text-gray-400">{detail}</p>}
      </div>
    </div>
  );
}

export default function AnalyticsExtendedPage() {
  const { data: activeUsers, isLoading: loadingAU } = useQuery<any>({
    queryKey: ["analytics-active-users"],
    queryFn: () => fetchJSON("/api/admin/analytics/extended/active-users"),
    staleTime: 300_000,
  });

  const { data: revenue, isLoading: loadingRev } = useQuery<any>({
    queryKey: ["analytics-revenue-growth"],
    queryFn: () => fetchJSON("/api/admin/analytics/extended/revenue-growth"),
    staleTime: 300_000,
  });

  const { data: retention, isLoading: loadingRet } = useQuery<any>({
    queryKey: ["analytics-retention"],
    queryFn: () => fetchJSON("/api/admin/analytics/extended/retention"),
    staleTime: 300_000,
  });

  const { data: errors, isLoading: loadingErr } = useQuery<any>({
    queryKey: ["analytics-error-trends"],
    queryFn: () => fetchJSON("/api/admin/analytics/extended/error-trends"),
    staleTime: 300_000,
  });

  const { data: enrollment, isLoading: loadingEnr } = useQuery<any>({
    queryKey: ["analytics-enrollment-trends"],
    queryFn: () => fetchJSON("/api/admin/analytics/extended/enrollment-trends"),
    staleTime: 300_000,
  });

  const { data: growth, isLoading: loadingGrowth } = useQuery<any>({
    queryKey: ["analytics-user-growth"],
    queryFn: () => fetchJSON("/api/admin/analytics/extended/user-growth"),
    staleTime: 300_000,
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics Deep Dive</h1>
        <p className="text-sm text-gray-500 mt-0.5">All data sourced live from the database — no estimates</p>
      </div>

      {/* Active users: DAU / WAU / MAU */}
      <div className="grid grid-cols-3 gap-4">
        {loadingAU ? <SkeletonDashboardGrid cards={3} className="col-span-3 grid-cols-3" /> : [
          { label: "Daily Active Users", value: activeUsers?.dau ?? 0, Icon: Activity, sub: "last 24h" },
          { label: "Weekly Active Users", value: activeUsers?.wau ?? 0, Icon: TrendingUp, sub: "last 7 days" },
          { label: "Monthly Active Users", value: activeUsers?.mau ?? 0, Icon: Users, sub: "last 30 days" },
        ].map(({ label, value, Icon, sub }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center">
                <Icon className="w-4 h-4 text-primary" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            <p className="text-xs text-gray-400">{sub}</p>
          </div>
        ))}
      </div>

      {/* User growth + Enrollment trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="User Growth" subtitle="Weekly new sign-ups" icon={Users}>
          {loadingGrowth ? <SkeletonChart height={160} /> : (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={growth?.weekly ?? []} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <defs>
                  <linearGradient id="ugGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} tickFormatter={v => v?.slice(5, 10) ?? v} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: any) => [`${v} users`, "New Users"]} />
                <Area type="monotone" dataKey="new_users" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#ugGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
          {!loadingGrowth && growth && (
            <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-3">
              <StatRow label="Total Accounts" value={(growth.total ?? 0).toLocaleString()} />
              <StatRow label="Active Accounts" value={(growth.active ?? 0).toLocaleString()} />
            </div>
          )}
        </SectionCard>

        <SectionCard title="Enrollment Trends" subtitle="Weekly new enrollments" icon={TrendingUp}>
          {loadingEnr ? <SkeletonChart height={160} /> : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={enrollment?.weekly ?? []} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} tickFormatter={v => v?.slice(5, 10) ?? v} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: any) => [`${v}`, "Enrollments"]} />
                <Bar dataKey="enrollments" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      {/* Revenue growth */}
      <SectionCard title="Revenue Growth" subtitle="Weekly completed transactions" icon={DollarSign}>
        {loadingRev ? <SkeletonChart height={180} /> : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: "Total Revenue", value: `EGP ${(revenue?.total ?? 0).toLocaleString()}` },
                { label: "This Month", value: `EGP ${(revenue?.thisMonth ?? 0).toLocaleString()}` },
                { label: "Transactions", value: (revenue?.totalTransactions ?? 0).toLocaleString() },
              ].map(s => (
                <div key={s.label} className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-base font-bold text-gray-900">{s.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={revenue?.weekly ?? []} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} tickFormatter={v => v?.slice(5, 10) ?? v} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: any) => [`EGP ${parseFloat(v).toLocaleString()}`, "Revenue"]} />
                <Area type="monotone" dataKey="revenue" stroke="#059669" strokeWidth={2} fill="url(#revGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </>
        )}
      </SectionCard>

      {/* Retention + Error trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Retention" subtitle="7-day and 30-day cohorts" icon={Activity}>
          {loadingRet ? <SkeletonChart height={140} /> : (
            <div className="space-y-4">
              {[
                { label: "7-Day Retention", pct: retention?.retention7d, cohort: retention?.cohort7dSize },
                { label: "30-Day Retention", pct: retention?.retention30d, cohort: retention?.cohort30dSize },
              ].map(r => (
                <div key={r.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-medium text-gray-700">{r.label}</p>
                    <p className="text-sm font-bold text-gray-900">
                      {r.pct != null ? `${r.pct}%` : "—"}
                    </p>
                  </div>
                  <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-1000"
                      style={{ width: `${r.pct ?? 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">cohort size: {(r.cohort ?? 0).toLocaleString()}</p>
                </div>
              ))}
              {retention?.retention7d == null && (
                <p className="text-sm text-gray-400 text-center py-4">Retention data builds as users accumulate activity.</p>
              )}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Error Trends" subtitle="Last 7 days" icon={AlertTriangle}>
          {loadingErr ? <SkeletonChart height={140} /> : errors?.daily?.length > 0 ? (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={errors.daily} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} tickFormatter={v => v?.slice(5) ?? v} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip formatter={(v: any) => [`${v}`, "Errors"]} />
                <Bar dataKey="errors" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-28 text-gray-400">
              <AlertTriangle className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">No errors logged in the last 7 days</p>
            </div>
          )}
          {!loadingErr && errors?.bySource?.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
              {errors.bySource.map((s: any) => (
                <div key={s.source} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">{s.source}</span>
                  <span className="font-bold text-gray-800">{s.count}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* User breakdown by role */}
      {!loadingGrowth && growth?.byRole?.length > 0 && (
        <SectionCard title="Users by Role" subtitle="Current distribution" icon={Users}>
          <div className="flex items-center gap-6">
            <div style={{ minWidth: 180 }}>
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={growth.byRole} dataKey="count" nameKey="role" cx="50%" cy="50%"
                    outerRadius={70} innerRadius={45}>
                    {growth.byRole.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any, n: any) => [`${v}`, n]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {growth.byRole.map((r: any, i: number) => (
                <div key={r.role} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-sm capitalize text-gray-700 flex-1">{r.role}</span>
                  <span className="text-sm font-bold text-gray-900">{r.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
