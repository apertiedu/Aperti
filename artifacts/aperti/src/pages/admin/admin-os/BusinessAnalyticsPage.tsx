import { useQuery } from "@tanstack/react-query";
import { fetchJSON } from "@/lib/api";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { Users, TrendingUp, CreditCard, Clock, UserCheck, BookOpen, Heart, Activity } from "lucide-react";


const COLORS = ["hsl(var(--primary))", "#3B82F6", "#8B5CF6", "#F59E0B"];

function MetricCard({
  label, value, sub, icon: Icon, color = "text-gray-600", bg = "bg-gray-50",
}: { label: string; value: any; sub?: string; icon: any; color?: string; bg?: string }) {
  return (
    <div className={`${bg} rounded-xl p-4`}>
      <Icon className={`w-4 h-4 ${color} mb-2`} />
      <p className="text-2xl font-bold text-gray-900">{value ?? "—"}</p>
      <p className="text-xs font-medium text-gray-600 mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">{title}</h3>
      {children}
    </div>
  );
}

export default function BusinessAnalyticsPage() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["business-analytics"],
    queryFn: () => fetchJSON("/api/admin/business-analytics"),
    staleTime: 60_000,
  });

  if (isLoading) return (
    <div className="space-y-6">
      <div className="h-8 w-64 bg-gray-100 rounded-xl animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
      <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
    </div>
  );

  const u = data?.users ?? {};
  const s = data?.subscriptions ?? {};
  const w = data?.waitlist ?? {};
  const growth = data?.user_growth ?? [];
  const subGrowth = data?.sub_growth ?? [];

  const userBreakdown = [
    { name: "Students", value: parseInt(u.total_students) || 0 },
    { name: "Teachers", value: parseInt(u.total_teachers) || 0 },
    { name: "Parents",  value: parseInt(u.total_parents) || 0 },
  ];

  const conversionRate = data?.conversion_rate ?? "0.0";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Business Analytics</h1>
        <p className="text-sm text-gray-500 mt-0.5">Platform-wide business metrics — users, conversions, engagement, and growth</p>
      </div>

      {/* Core KPIs */}
      <Section title="Key Performance Indicators">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Total Users" value={parseInt(u.total_users || 0).toLocaleString()} icon={Users} color="text-primary" bg="bg-primary/8" />
          <MetricCard label="Active Subscriptions" value={parseInt(s.active || 0).toLocaleString()} icon={CreditCard} color="text-blue-600" bg="bg-blue-50" />
          <MetricCard label="Conversion Rate" value={`${conversionRate}%`} icon={TrendingUp} color="text-purple-600" bg="bg-purple-50" />
          <MetricCard label="Waitlist Total" value={parseInt(w.total || 0).toLocaleString()} icon={Clock} color="text-amber-600" bg="bg-amber-50" />
        </div>
      </Section>

      {/* Activity Metrics */}
      <Section title="User Activity">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Daily Active Users" value={parseInt(u.dau || 0).toLocaleString()} sub="Logged in today" icon={Activity} color="text-primary" />
          <MetricCard label="Weekly Active Users" value={parseInt(u.wau || 0).toLocaleString()} sub="Active past 7 days" icon={UserCheck} color="text-blue-600" />
          <MetricCard label="New This Week" value={parseInt(u.new_this_week || 0).toLocaleString()} sub="Accounts created" icon={Users} color="text-green-600" />
          <MetricCard label="New This Month" value={parseInt(u.new_this_month || 0).toLocaleString()} sub="Accounts created" icon={TrendingUp} color="text-indigo-600" />
        </div>
      </Section>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Growth Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="mb-4">
            <h3 className="font-semibold text-gray-900">User Growth — Last 30 Days</h3>
            <p className="text-xs text-gray-400">New accounts created per day</p>
          </div>
          {growth.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-gray-400 text-sm">No growth data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={growth} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="userGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} tickFormatter={(v) => new Date(v).toLocaleDateString("en", { month: "short", day: "numeric" })} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip labelFormatter={(v) => new Date(v).toLocaleDateString()} formatter={(v: any) => [`${v} users`, "New Users"]} />
                <Area type="monotone" dataKey="users" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#userGradient)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* User Breakdown Pie */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="mb-4">
            <h3 className="font-semibold text-gray-900">User Breakdown</h3>
            <p className="text-xs text-gray-400">Distribution by role</p>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <PieChart>
              <Pie data={userBreakdown} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} dataKey="value">
                {userBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: any, n: any) => [`${v}`, n]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-3">
            {userBreakdown.map((item, i) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i] }} />
                  <span className="text-gray-600">{item.name}</span>
                </div>
                <span className="font-semibold text-gray-800">{item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Subscription Growth */}
      {subGrowth.length > 0 && (
        <Section title="Subscription Growth">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="mb-4">
              <h3 className="font-semibold text-gray-900">New Subscriptions — Last 30 Days</h3>
              <p className="text-xs text-gray-400">Number of new paid subscriptions per day</p>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={subGrowth} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} tickFormatter={(v) => new Date(v).toLocaleDateString("en", { month: "short", day: "numeric" })} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip labelFormatter={(v) => new Date(v).toLocaleDateString()} formatter={(v: any) => [`${v} subscriptions`, "New Subs"]} />
                <Bar dataKey="subs" fill="#3B82F6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      )}

      {/* Role Adoption */}
      <Section title="Role Adoption">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-primary/8 rounded-xl flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Teacher Adoption</p>
                <p className="text-xs text-gray-400">Platform creators</p>
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{parseInt(u.total_teachers || 0).toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">
              {parseInt(u.total_users || 1) > 0
                ? `${((parseInt(u.total_teachers) / parseInt(u.total_users)) * 100).toFixed(1)}% of all users`
                : "0% of all users"}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Student Engagement</p>
                <p className="text-xs text-gray-400">Platform learners</p>
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{parseInt(u.total_students || 0).toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">
              {parseInt(u.total_users || 1) > 0
                ? `${((parseInt(u.total_students) / parseInt(u.total_users)) * 100).toFixed(1)}% of all users`
                : "0% of all users"}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center">
                <Heart className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Parent Engagement</p>
                <p className="text-xs text-gray-400">Guardian users</p>
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{parseInt(u.total_parents || 0).toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">
              {parseInt(u.total_users || 1) > 0
                ? `${((parseInt(u.total_parents) / parseInt(u.total_users)) * 100).toFixed(1)}% of all users`
                : "0% of all users"}
            </p>
          </div>
        </div>
      </Section>

      {/* Waitlist Funnel */}
      <Section title="Waitlist Funnel">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="mb-4">
            <h3 className="font-semibold text-gray-900">Signup Waitlist Status Breakdown</h3>
            <p className="text-xs text-gray-400">How submissions move through the funnel</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total", value: parseInt(w.total || 0), color: "bg-gray-100 text-gray-700" },
              { label: "Pending",   value: parseInt(w.pending || 0),   color: "bg-yellow-100 text-yellow-700" },
              { label: "Contacted", value: 0, color: "bg-blue-100 text-blue-700" },
              { label: "Converted", value: parseInt(w.converted || 0), color: "bg-green-100 text-green-700" },
            ].map(({ label, value, color }) => (
              <div key={label} className={`rounded-xl p-4 text-center ${color}`}>
                <p className="text-2xl font-bold">{value.toLocaleString()}</p>
                <p className="text-xs font-semibold mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          {parseInt(w.total || 0) > 0 && (
            <div className="mt-4">
              <p className="text-xs text-gray-500 mb-2">Conversion rate from waitlist</p>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.min(100, (parseInt(w.converted) / parseInt(w.total)) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {((parseInt(w.converted || 0) / Math.max(1, parseInt(w.total || 1))) * 100).toFixed(1)}% waitlist-to-signup conversion
              </p>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}
