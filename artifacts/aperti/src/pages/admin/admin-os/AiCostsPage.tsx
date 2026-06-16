import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fetchJSON, putJSON } from "@/lib/api";
import { Zap, DollarSign, Activity, Save } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const TYPE_COLORS: Record<string, string> = {
  tutor: "hsl(var(--primary))", revision: "#3B82F6", assessment: "#8B5CF6",
  flashcard: "#F59E0B", weave: "#EF4444", default: "#6B7280",
};

export default function AiCostsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["ai-costs"],
    queryFn: () => fetchJSON("/api/admin/ai/costs"),
  });
  const { data: budgetData } = useQuery({
    queryKey: ["ai-budget"],
    queryFn: () => fetchJSON("/api/admin/ai/budget"),
  });

  const [cap, setCap] = useState<string>("");
  const saveMut = useMutation({
    mutationFn: () => putJSON("/api/admin/ai/settings", { monthlyBudgetCap: parseFloat(cap) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-budget"] }),
  });

  const breakdown = data?.breakdown ?? [];
  const totals = data?.totals ?? {};
  const budget = budgetData?.monthlyBudgetCap ?? 50;

  // Aggregate by day for bar chart
  const byDay = Object.values(
    breakdown.reduce((acc: any, row: any) => {
      if (!acc[row.day]) acc[row.day] = { day: row.day, cost: 0, tokens: 0 };
      acc[row.day].cost += parseFloat(row.cost_usd || 0);
      acc[row.day].tokens += parseInt(row.tokens || 0);
      return acc;
    }, {})
  ).slice(-14) as any[];

  // Aggregate by type
  const byType = Object.values(
    breakdown.reduce((acc: any, row: any) => {
      if (!acc[row.interaction_type]) acc[acc.length] = { type: row.interaction_type, cost: 0, calls: 0 };
      const key = row.interaction_type;
      if (!acc[key]) acc[key] = { type: key, cost: 0, calls: 0 };
      acc[key].cost += parseFloat(row.cost_usd || 0);
      acc[key].calls += parseInt(row.calls || 0);
      return acc;
    }, {})
  ) as any[];

  const totalCost = parseFloat(totals.costUSD || 0);
  const totalTokens = parseInt(totals.tokens || 0);
  const budgetPct = budget > 0 ? Math.min(100, (totalCost / budget) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Cost Management</h1>
        <p className="text-sm text-gray-500 mt-0.5">Daily token usage, cost breakdown, and budget configuration</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-primary" />
            <span className="text-sm text-gray-500">MTD Cost</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">${totalCost.toFixed(4)}</p>
          <div className="mt-2 bg-gray-100 rounded-full h-2">
            <div className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${budgetPct}%` }} />
          </div>
          <p className="text-xs text-gray-400 mt-1">{budgetPct.toFixed(1)}% of ${budget} budget</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-purple-600" />
            <span className="text-sm text-gray-500">Tokens Used</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalTokens.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">Last 30 days</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-gray-500">Cost per 1K tokens</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">$0.002</p>
          <p className="text-xs text-gray-400 mt-1">GPT-4o-mini rate</p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily cost */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Daily Cost (last 14 days)</h3>
          {isLoading ? (
            <div className="animate-pulse bg-gray-100 h-48 rounded-lg" />
          ) : byDay.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No AI usage data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byDay}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v.toFixed(3)}`} />
                <Tooltip formatter={(v: any) => [`$${parseFloat(v).toFixed(4)}`, "Cost"]} />
                <Bar dataKey="cost" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* By type */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Cost by Feature</h3>
          {isLoading ? (
            <div className="animate-pulse bg-gray-100 h-48 rounded-lg" />
          ) : byType.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No AI interaction types yet</p>
          ) : (
            <div className="space-y-3">
              {byType.sort((a: any, b: any) => b.cost - a.cost).map((t: any) => {
                const pct = totalCost > 0 ? (t.cost / totalCost) * 100 : 0;
                const color = TYPE_COLORS[t.type] ?? TYPE_COLORS.default;
                return (
                  <div key={t.type}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700 capitalize">{t.type}</span>
                      <span className="text-gray-500">${t.cost.toFixed(4)} ({pct.toFixed(1)}%)</span>
                    </div>
                    <div className="bg-gray-100 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Budget config */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Budget Configuration</h3>
        <div className="flex items-center gap-4">
          <div>
            <label className="text-sm text-gray-600 block mb-1">Monthly Budget Cap (USD)</label>
            <input
              type="number" min="1" step="1"
              placeholder={String(budget)}
              value={cap}
              onChange={(e) => setCap(e.target.value)}
              className="w-36 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          <div className="mt-5">
            <button onClick={() => saveMut.mutate()} disabled={!cap || saveMut.isPending}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition-colors disabled:opacity-50">
              <Save className="w-4 h-4" />
              {saveMut.isPending ? "Saving…" : "Save"}
            </button>
          </div>
          {saveMut.isSuccess && (
            <span className="text-sm text-green-600 mt-5">Saved!</span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Current cap: <strong>${budget}</strong>/month. An alert is created when usage exceeds 50% of daily average.
        </p>
      </div>
    </div>
  );
}
