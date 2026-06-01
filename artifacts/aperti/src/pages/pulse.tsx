import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Users, TrendingUp, AlertTriangle, CheckCircle, Target } from "lucide-react";

const API = "/api";

async function fetchJSON(url: string) {
  const token = localStorage.getItem("aperti_token");
  const res = await fetch(`${API}${url}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

export default function Pulse() {
  const { data, isLoading } = useQuery({
    queryKey: ["pulse", "class-overview"],
    queryFn: () => fetchJSON("/analytics/class-overview"),
  });

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold">Pulse<span className="text-primary"></span></h1>
        <p className="text-muted-foreground">Your classroom's real‑time health monitor.</p>
      </motion.div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* Top stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Students" value={data?.studentCount} icon={<Users className="h-5 w-5 text-primary" />} />
            <StatCard label="Attendance Rate" value={`${data?.attendanceRate}%`} icon={<CheckCircle className="h-5 w-5 text-primary" />} />
            <StatCard label="Weak Topics" value={data?.weakTopics?.length || 0} icon={<AlertTriangle className="h-5 w-5 text-orange-500" />} />
            <StatCard label="Avg Exam Score" value={`${data?.recentExamAverages?.[0]?.average || 0}%`} icon={<TrendingUp className="h-5 w-5 text-primary" />} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Weak Topics */}
            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" /> Class Weak Topics</CardTitle>
                <CardDescription>Topics where most students need help</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data?.weakTopics?.map((wt: any) => (
                    <div key={wt.topic} className="flex items-center justify-between">
                      <span>{wt.topic}</span>
                      <Badge variant="secondary">{wt.count} students</Badge>
                    </div>
                  ))}
                  {!data?.weakTopics?.length && <p className="text-muted-foreground text-sm">No weak topics detected yet.</p>}
                </div>
              </CardContent>
            </Card>

            {/* Recent Exam Averages */}
            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> Recent Exam Averages</CardTitle>
                <CardDescription>Last 5 assessments</CardDescription>
              </CardHeader>
              <CardContent>
                {data?.recentExamAverages?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.recentExamAverages}>
                      <XAxis dataKey="examName" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Bar dataKey="average" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted-foreground text-sm">No exam data yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <Card className="card-hover">
      <CardContent className="p-4 flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">{icon}</div>
        <div>
          <p className="text-2xl font-bold">{value ?? "—"}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
