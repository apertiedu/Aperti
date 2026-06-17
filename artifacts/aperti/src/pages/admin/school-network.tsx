import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Users, DollarSign, TrendingUp, GraduationCap, Globe, BarChart3, Activity } from "lucide-react";

function StatCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-gray-500 font-medium">{label}</p>
          <p className="text-xl font-black text-gray-900">{value}</p>
          {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    active:    "bg-emerald-100 text-emerald-800 border-emerald-200",
    inactive:  "bg-gray-100 text-gray-600 border-gray-200",
    trial:     "bg-blue-100 text-blue-800 border-blue-200",
    suspended: "bg-red-100 text-red-800 border-red-200",
  };
  return <Badge className={`text-[10px] font-semibold border ${cfg[status] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>{status}</Badge>;
}

export default function SchoolNetwork() {
  const { data: orgs = [], isLoading } = useQuery<any[]>({
    queryKey: ["admin-school-network-orgs"],
    queryFn: async () => {
      const r = await fetch("/api/admin/orgs", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      const j = await r.json();
      return Array.isArray(j) ? j : (j.orgs ?? j.organizations ?? []);
    },
    retry: false,
    refetchInterval: 60_000,
  });

  const { data: networkStats } = useQuery<any>({
    queryKey: ["admin-school-network-stats"],
    queryFn: async () => {
      const r = await fetch("/api/admin/analytics/network", { credentials: "include" });
      if (!r.ok) return {};
      return r.json();
    },
    retry: false,
    refetchInterval: 60_000,
  });

  const activeOrgs    = orgs.filter((o: any) => o.status === "active" || !o.status).length;
  const totalStudents = orgs.reduce((s: number, o: any) => s + (o.student_count ?? 0), 0);
  const totalRevenue  = orgs.reduce((s: number, o: any) => s + parseFloat(o.revenue ?? o.total_revenue ?? 0), 0);

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-teal-100 flex items-center justify-center">
            <Globe className="h-5 w-5 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">School Network</h1>
            <p className="text-sm text-gray-500">Multi-school SaaS management & per-school analytics</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Building2}    label="Active Schools"   value={activeOrgs}   color="bg-teal-100 text-teal-600" />
        <StatCard icon={Users}        label="Total Students"   value={totalStudents} color="bg-blue-100 text-blue-600" />
        <StatCard icon={DollarSign}   label="Network Revenue"  value={`${totalRevenue.toLocaleString()} EGP`} color="bg-emerald-100 text-emerald-600" />
        <StatCard icon={Activity}     label="Schools (Total)"  value={orgs.length}  color="bg-purple-100 text-purple-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-teal-500" />
                All Schools / Organizations
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-gray-100 animate-pulse rounded-lg" />)}</div>
              ) : orgs.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  <Building2 className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  No organizations registered yet
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="text-xs">School / Org</TableHead>
                      <TableHead className="text-xs">Plan</TableHead>
                      <TableHead className="text-xs">Students</TableHead>
                      <TableHead className="text-xs">Teachers</TableHead>
                      <TableHead className="text-xs">Revenue</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orgs.map((org: any) => (
                      <TableRow key={org.id} className="hover:bg-gray-50">
                        <TableCell>
                          <div>
                            <p className="text-xs font-semibold text-gray-800">{org.name}</p>
                            {org.domain && <p className="text-[10px] text-gray-400">{org.domain}</p>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-blue-50 text-blue-700 border-blue-100 text-[10px] border">
                            {org.plan ?? org.subscription_plan ?? "Standard"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-semibold">{org.student_count ?? org.students ?? "—"}</TableCell>
                        <TableCell className="text-xs">{org.teacher_count ?? org.teachers ?? "—"}</TableCell>
                        <TableCell className="text-xs font-semibold text-emerald-700">
                          {parseFloat(org.revenue ?? org.total_revenue ?? 0).toLocaleString()} EGP
                        </TableCell>
                        <TableCell><StatusBadge status={org.status ?? "active"} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-purple-500" />
                Network Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "Active Schools",    value: activeOrgs,    icon: Building2,    color: "text-teal-600" },
                { label: "Total Students",    value: totalStudents,  icon: GraduationCap, color: "text-blue-600" },
                { label: "Network Revenue",   value: `${totalRevenue.toLocaleString()} EGP`, icon: DollarSign, color: "text-emerald-600" },
                { label: "Avg Students/School", value: orgs.length > 0 ? Math.round(totalStudents / orgs.length) : 0, icon: TrendingUp, color: "text-purple-600" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${color}`} />
                    <span className="text-xs text-gray-600">{label}</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-indigo-500" />
                Plan Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(() => {
                const planCounts: Record<string, number> = {};
                orgs.forEach((o: any) => {
                  const plan = o.plan ?? o.subscription_plan ?? "Standard";
                  planCounts[plan] = (planCounts[plan] ?? 0) + 1;
                });
                const total = orgs.length || 1;
                return Object.entries(planCounts).map(([plan, count]) => (
                  <div key={plan}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600">{plan}</span>
                      <span className="font-semibold text-gray-800">{count} schools</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-400 rounded-full"
                        style={{ width: `${(count / total) * 100}%` }}
                      />
                    </div>
                  </div>
                ));
              })()}
              {orgs.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">No plan data yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
