import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { DollarSign, TrendingUp, RefreshCw, Users } from "lucide-react";

interface Overview {
  gross_revenue: string;
  course_revenue: string;
  subscription_revenue: string;
  total_payments: number;
  pending_payments: number;
  refunded_payments: number;
}
interface TeacherRow {
  teacher_id: number;
  display_name: string;
  email: string;
  revenue: string;
  active_courses: number;
  payment_count: number;
}
interface DailyPoint { day: string; revenue: string; count: number; }
interface PlanSub { plan_name: string; active_subscriptions: number; mrr: string; }

interface PlatformRevenueData {
  overview: Overview;
  top_teachers: TeacherRow[];
  subscription_breakdown: PlanSub[];
  trends: { daily: DailyPoint[] };
  generated_at: string;
}

function MiniBar({ values, color = "bg-primary" }: { values: number[]; color?: string }) {
  if (!values.length) return <p className="text-xs text-muted-foreground">No data</p>;
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-0.5 h-14">
      {values.map((v, i) => (
        <div key={i} className={cn("flex-1 rounded-sm min-w-px transition-all", color)}
          style={{ height: `${Math.max((v / max) * 100, 2)}%`, opacity: v === 0 ? 0.15 : 1 }}
          title={`${v.toLocaleString()} EGP`} />
      ))}
    </div>
  );
}

function StatCard({ label, value, sub, green = false }: { label: string; value: string; sub?: string; green?: boolean }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className={cn("text-2xl font-bold tabular-nums mt-0.5", green ? "text-emerald-600" : "text-foreground")}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default function PlatformRevenuePage() {
  const [teacherPage, setTeacherPage] = useState(0);
  const PAGE_SIZE = 10;

  const { data, isLoading, refetch, isFetching } = useQuery<PlatformRevenueData>({
    queryKey: ["platform-revenue"],
    queryFn: () => apiFetch("/api/revenue/platform").then((r) => r.json()),
    refetchInterval: 120_000,
  });

  const o = data?.overview;
  const daily = data?.trends.daily ?? [];
  const teachers = data?.top_teachers ?? [];
  const paged = teachers.slice(teacherPage * PAGE_SIZE, (teacherPage + 1) * PAGE_SIZE);

  const totalMRR = (data?.subscription_breakdown ?? []).reduce((acc, p) => acc + parseFloat(p.mrr ?? "0"), 0);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Platform Revenue Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            All-time financials · last refreshed {data ? new Date(data.generated_at).toLocaleTimeString() : "—"}
          </p>
        </div>
        <button onClick={() => refetch()} className="p-2 border border-border rounded-lg hover:bg-muted transition-colors">
          <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", isFetching && "animate-spin")} />
        </button>
      </div>

      {isLoading ? (
        <div className="animate-pulse grid grid-cols-2 md:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard label="Gross Revenue" value={`${parseFloat(o?.gross_revenue ?? "0").toLocaleString()} EGP`} green />
          <StatCard label="Course Revenue" value={`${parseFloat(o?.course_revenue ?? "0").toLocaleString()} EGP`} sub="Paid enrollments" />
          <StatCard label="Subscription Revenue" value={`${parseFloat(o?.subscription_revenue ?? "0").toLocaleString()} EGP`} sub={`MRR: ${totalMRR.toLocaleString()} EGP`} />
          <StatCard label="Total Payments" value={(o?.total_payments ?? 0).toLocaleString()} sub="Approved" />
          <StatCard label="Pending" value={(o?.pending_payments ?? 0).toLocaleString()} sub="Awaiting verification" />
          <StatCard label="Refunded" value={(o?.refunded_payments ?? 0).toLocaleString()} sub="Returned to users" />
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Daily Revenue — Last 30 Days
          </p>
          <p className="text-xs text-muted-foreground mb-3">Verified payments only</p>
          <MiniBar values={daily.map((d) => parseFloat(d.revenue ?? "0"))} />
          <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
            <span>30 days ago</span>
            <span>Today</span>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-sm font-semibold text-foreground mb-3">Subscription Plans MRR</p>
          <div className="space-y-2">
            {(data?.subscription_breakdown ?? []).map((p) => {
              const mrr = parseFloat(p.mrr ?? "0");
              const topMRR = Math.max(...(data?.subscription_breakdown ?? []).map((x) => parseFloat(x.mrr ?? "0")), 1);
              return (
                <div key={p.plan_name}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="font-medium text-foreground">{p.plan_name}</span>
                    <span className="tabular-nums text-muted-foreground">{mrr.toLocaleString()} EGP · {p.active_subscriptions} subs</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${(mrr / topMRR) * 100}%` }} />
                  </div>
                </div>
              );
            })}
            {!data?.subscription_breakdown?.length && (
              <p className="text-sm text-muted-foreground text-center py-4">No active subscriptions</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Top Teachers by Revenue
          </p>
          <div className="flex gap-1">
            <button disabled={teacherPage === 0} onClick={() => setTeacherPage(p => p - 1)} className="text-xs px-2 py-1 rounded border border-border disabled:opacity-40 hover:bg-muted transition-colors">Prev</button>
            <button disabled={(teacherPage + 1) * PAGE_SIZE >= teachers.length} onClick={() => setTeacherPage(p => p + 1)} className="text-xs px-2 py-1 rounded border border-border disabled:opacity-40 hover:bg-muted transition-colors">Next</button>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {["Rank", "Teacher", "Courses", "Payments", "Revenue"].map((h) => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((t, i) => (
              <tr key={t.teacher_id} className="border-b border-border last:border-0 hover:bg-muted/20">
                <td className="px-5 py-3 text-xs text-muted-foreground font-mono">#{teacherPage * PAGE_SIZE + i + 1}</td>
                <td className="px-5 py-3">
                  <p className="font-medium text-foreground text-xs">{t.display_name}</p>
                  <p className="text-[11px] text-muted-foreground">{t.email}</p>
                </td>
                <td className="px-5 py-3 text-xs tabular-nums">{t.active_courses}</td>
                <td className="px-5 py-3 text-xs tabular-nums">{t.payment_count}</td>
                <td className="px-5 py-3 text-xs font-bold tabular-nums text-emerald-600">{parseFloat(t.revenue).toLocaleString()} EGP</td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-muted-foreground text-sm">No revenue data yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
