import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fetchJSON } from "@/lib/api";
import { DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight, CreditCard, XCircle, Clock } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const COLORS = ["#0D9488", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444", "#10B981"];

function KPI({ label, value, sub, icon: Icon, trend, color = "teal" }: any) {
  const bg: Record<string, string> = {
    teal: "bg-teal-50 text-teal-600", green: "bg-green-50 text-green-600",
    blue: "bg-blue-50 text-blue-600", amber: "bg-amber-50 text-amber-600",
  };
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bg[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend !== undefined && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${trend >= 0 ? "text-green-600" : "text-rose-500"}`}>
            {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-600 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </motion.div>
  );
}

export default function FounderRevenuePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["founder-revenue"],
    queryFn: () => fetchJSON("/api/founder/revenue"),
  });

  const totals = data?.totals ?? {};
  const monthly = data?.monthly ?? [];
  const byPlan = data?.byPlan ?? [];

  const fmt = (n: number | string) => `EGP ${parseFloat(String(n || 0)).toLocaleString()}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Revenue Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Detailed breakdown — payments, plans, and trends</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 animate-pulse h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPI label="MRR" value={fmt(totals.mrr)} icon={DollarSign} color="teal" />
          <KPI label="ARR (projected)" value={fmt(totals.arr)} icon={TrendingUp} color="green" trend={totals.growthRate} />
          <KPI label="YTD Revenue" value={fmt(totals.ytd)} icon={DollarSign} color="blue" />
          <KPI label="All-Time Revenue" value={fmt(totals.allTime)} icon={DollarSign} color="amber" />
        </div>
      )}

      {/* Payment health */}
      {!isLoading && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-green-50 rounded-xl p-4 border border-green-100 flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-lg font-bold text-green-700">{totals.paidCount ?? 0}</p>
              <p className="text-xs text-green-600">Approved payments</p>
            </div>
          </div>
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-600" />
            <div>
              <p className="text-lg font-bold text-amber-700">{totals.pendingCount ?? 0}</p>
              <p className="text-xs text-amber-600">Pending payments</p>
            </div>
          </div>
          <div className="bg-rose-50 rounded-xl p-4 border border-rose-100 flex items-center gap-3">
            <XCircle className="w-5 h-5 text-rose-500" />
            <div>
              <p className="text-lg font-bold text-rose-600">{totals.failedCount ?? 0}</p>
              <p className="text-xs text-rose-500">Failed payments</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly trend */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Monthly Revenue (12 months)</h3>
          {monthly.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No revenue data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthly}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => [fmt(v), "Revenue"]} />
                <Line type="monotone" dataKey="revenue" stroke="#0D9488" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* By plan */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Revenue by Plan</h3>
          {byPlan.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No subscription data yet</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={byPlan} dataKey="revenue" nameKey="plan" cx="50%" cy="50%" outerRadius={70} label={({ plan }) => plan}>
                    {byPlan.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => [fmt(v), "Revenue"]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1.5">
                {byPlan.map((p: any, i: number) => (
                  <div key={p.plan} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-gray-700">{p.plan}</span>
                    </div>
                    <span className="font-medium text-gray-900">{fmt(p.revenue)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Monthly table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Monthly Breakdown</h3>
        </div>
        {monthly.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No data yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-left">
              <th className="px-5 py-3 text-gray-500 font-medium">Month</th>
              <th className="px-5 py-3 text-gray-500 font-medium text-right">Revenue</th>
              <th className="px-5 py-3 text-gray-500 font-medium text-right">Transactions</th>
            </tr></thead>
            <tbody>
              {[...monthly].reverse().map((r: any) => (
                <tr key={r.month} className="border-t border-gray-50 hover:bg-gray-50/50">
                  <td className="px-5 py-3 font-medium text-gray-800">{r.month}</td>
                  <td className="px-5 py-3 text-right text-gray-700">{fmt(r.revenue)}</td>
                  <td className="px-5 py-3 text-right text-gray-500">{r.transactions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
