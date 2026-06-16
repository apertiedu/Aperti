import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { DollarSign, TrendingUp, TrendingDown, RefreshCw, BookOpen, Tag } from "lucide-react";

interface CourseRow {
  course_id: number;
  course_name: string;
  students_enrolled: number;
  revenue: string;
  refunded: string;
}
interface DailyPoint { date: string; revenue: number; }
interface WeeklyPoint { week: string; revenue: number; }
interface DiscountImpact { code: string; uses: number; affected_revenue: string; }

interface RevenueData {
  teacher_id: number;
  total_revenue: number;
  net_revenue: number;
  refunded_total: number;
  approved_count: number;
  pending_count: number;
  course_breakdown: CourseRow[];
  discount_impact: DiscountImpact[];
  trends: { daily: DailyPoint[]; weekly: WeeklyPoint[] };
  generated_at: string;
}

function MiniBar({ values, color = "bg-primary" }: { values: number[]; color?: string }) {
  if (!values.length) return <p className="text-xs text-muted-foreground">No data</p>;
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-0.5 h-12">
      {values.map((v, i) => (
        <div
          key={i}
          className={cn("flex-1 rounded-sm min-w-0.5 transition-all", color)}
          style={{ height: `${Math.max((v / max) * 100, 2)}%`, opacity: v === 0 ? 0.2 : 1 }}
          title={`${v.toLocaleString()} EGP`}
        />
      ))}
    </div>
  );
}

function StatCard({ label, value, sub, trend, warn = false }: { label: string; value: string; sub?: string; trend?: "up" | "down"; warn?: boolean }) {
  return (
    <div className={cn("bg-card border rounded-xl p-5 space-y-1", warn ? "border-amber-200" : "border-border")}>
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <div className="flex items-end gap-2">
        <p className={cn("text-2xl font-bold tabular-nums", warn ? "text-amber-600" : "text-foreground")}>{value}</p>
        {trend && (
          trend === "up"
            ? <TrendingUp className="h-4 w-4 text-emerald-500 mb-0.5" />
            : <TrendingDown className="h-4 w-4 text-red-500 mb-0.5" />
        )}
      </div>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function RevenueDashboard() {
  const { data, isLoading, refetch, isFetching } = useQuery<RevenueData>({
    queryKey: ["teacher-revenue"],
    queryFn: () => apiFetch("/api/revenue/my").then((r) => r.json()),
    refetchInterval: 120_000,
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-muted rounded w-48" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  const d = data;
  const dailyValues = (d?.trends.daily ?? []).map((p) => p.revenue);
  const weeklyValues = (d?.trends.weekly ?? []).map((p) => p.revenue);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Revenue Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your earnings breakdown — last updated {d ? new Date(d.generated_at).toLocaleTimeString() : "—"}
          </p>
        </div>
        <button onClick={() => refetch()} className="p-2 border border-border rounded-lg hover:bg-muted transition-colors">
          <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", isFetching && "animate-spin")} />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Gross Revenue"
          value={`${(d?.total_revenue ?? 0).toLocaleString()} EGP`}
          sub={`${d?.approved_count ?? 0} payments approved`}
        />
        <StatCard
          label="Net Revenue"
          value={`${(d?.net_revenue ?? 0).toLocaleString()} EGP`}
          sub="After refunds"
          trend={(d?.net_revenue ?? 0) > 0 ? "up" : undefined}
        />
        <StatCard
          label="Refunded"
          value={`${(d?.refunded_total ?? 0).toLocaleString()} EGP`}
          warn={(d?.refunded_total ?? 0) > 0}
          sub="Returned to students"
          trend={(d?.refunded_total ?? 0) > 0 ? "down" : undefined}
        />
        <StatCard
          label="Pending"
          value={`${d?.pending_count ?? 0}`}
          sub="Transactions awaiting approval"
          warn={(d?.pending_count ?? 0) > 0}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Daily Revenue — Last 30 Days
          </p>
          <p className="text-xs text-muted-foreground mb-3">Each bar = one day</p>
          <MiniBar values={dailyValues} />
          <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
            <span>30 days ago</span>
            <span>Today</span>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Weekly Revenue — Last 12 Weeks
          </p>
          <p className="text-xs text-muted-foreground mb-3">Each bar = one week</p>
          <MiniBar values={weeklyValues} color="bg-teal-500" />
          <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
            <span>12 weeks ago</span>
            <span>This week</span>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            Revenue by Course
          </p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {["Course", "Students", "Revenue", "Refunded", "Net"].map((h) => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(d?.course_breakdown ?? []).map((c) => {
              const rev = parseFloat(c.revenue);
              const ref = parseFloat(c.refunded);
              return (
                <tr key={c.course_id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-5 py-3 font-medium text-foreground text-xs">{c.course_name}</td>
                  <td className="px-5 py-3 text-xs tabular-nums">{c.students_enrolled.toLocaleString()}</td>
                  <td className="px-5 py-3 text-xs font-semibold tabular-nums">{rev.toLocaleString()} EGP</td>
                  <td className="px-5 py-3 text-xs tabular-nums text-red-500">{ref > 0 ? `${ref.toLocaleString()} EGP` : "—"}</td>
                  <td className="px-5 py-3 text-xs font-semibold tabular-nums text-emerald-600">{(rev - ref).toLocaleString()} EGP</td>
                </tr>
              );
            })}
            {!d?.course_breakdown?.length && (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-muted-foreground text-sm">No course revenue data yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {(d?.discount_impact ?? []).length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              Discount Code Impact
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Code", "Uses", "Revenue Affected"].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(d?.discount_impact ?? []).map((dc) => (
                <tr key={dc.code} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-5 py-3 font-mono font-semibold text-xs">{dc.code}</td>
                  <td className="px-5 py-3 text-xs tabular-nums">{dc.uses}</td>
                  <td className="px-5 py-3 text-xs tabular-nums">{parseFloat(dc.affected_revenue).toLocaleString()} EGP</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
