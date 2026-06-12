import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, RadarChart, Radar, PolarGrid, PolarAngleAxis } from "recharts";
import { Users, MousePointerClick, MessageCircle, Activity, Flame, TrendingUp, AlertTriangle, BookOpen } from "lucide-react";

const API = "/api";
const tok = () => localStorage.getItem("aperti_token");
async function apiFetch(url: string) {
  const res = await fetch(`${API}${url}`, { headers: { Authorization: `Bearer ${tok()}` } });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

function StatCard({ label, value, icon, sub }: any) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-4">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary">{icon}</div>
        <div>
          <p className="text-2xl font-bold tabular-nums">{value ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
          {sub && <p className="text-xs text-primary">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ClassForge() {
  const [sessionId, setSessionId] = useState("1");

  const sessions: any[] = [];

  const { data, isLoading } = useQuery({
    queryKey: ["class-forge", "heatmap", sessionId],
    queryFn: () => apiFetch(`/class-forge/heatmap/${sessionId}`),
  });

  const { data: students } = useQuery<any[]>({
    queryKey: ["students-all"],
    queryFn: () => apiFetch("/students"),
  });

  const sessionList: any[] = Array.isArray(sessions) ? sessions : [];
  const studentList: any[] = Array.isArray(students) ? students : (students as any)?.students ?? [];

  /* Use real session data only — no synthetic fallback values */
  const records: any[] = data?.records ?? [];

  const avgAttention = records.length > 0
    ? Math.round(records.reduce((s, r) => s + r.attentionPercentage, 0) / records.length)
    : data?.averageAttention ?? 0;

  const totalHandRaises = records.reduce((s, r) => s + (r.handRaises ?? 0), 0);
  const highEngaged = records.filter(r => r.participationScore >= 70).length;
  const lowEngaged = records.filter(r => r.participationScore < 40);

  const topParticipants = [...records].sort((a, b) => b.participationScore - a.participationScore).slice(0, 6);

  const radarData = [
    { metric: "Attention", value: avgAttention },
    { metric: "Chat", value: Math.min(100, (records.reduce((s, r) => s + r.chatMessages, 0) / Math.max(1, records.length)) * 10) },
    { metric: "Polls", value: records.length > 0 ? Math.round((records.filter(r => r.pollResponses > 0).length / records.length) * 100) : 0 },
    { metric: "Q&A", value: Math.min(100, totalHandRaises * 8) },
    { metric: "Engagement", value: records.length > 0 ? Math.round(records.reduce((s, r) => s + r.participationScore, 0) / records.length) : 0 },
  ];

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">ClassForge™</h1>
          <p className="text-muted-foreground text-sm">Post-session engagement intelligence and participation heatmap.</p>
        </div>
        {sessionList.length > 0 && (
          <Select value={sessionId} onValueChange={setSessionId}>
            <SelectTrigger className="w-48 h-8 text-xs">
              <SelectValue placeholder="Select session…" />
            </SelectTrigger>
            <SelectContent>
              {sessionList.map((s: any) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.subject_name ?? `Session ${s.id}`} — {s.started_at ? new Date(s.started_at).toLocaleDateString() : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Avg Attention" value={`${avgAttention}%`} icon={<Activity className="h-5 w-5" />} />
        <StatCard label="Hand Raises" value={totalHandRaises} icon={<MousePointerClick className="h-5 w-5" />} />
        <StatCard label="High Engaged" value={highEngaged} icon={<Flame className="h-5 w-5" />} sub={`of ${records.length} students`} />
        <StatCard label="Need Support" value={lowEngaged.length} icon={<AlertTriangle className="h-5 w-5" />} />
      </div>

      <Tabs defaultValue="heatmap">
        <TabsList className="mb-4">
          <TabsTrigger value="heatmap">Participation Heatmap</TabsTrigger>
          <TabsTrigger value="radar">Engagement Radar</TabsTrigger>
          <TabsTrigger value="table">Full Report</TabsTrigger>
        </TabsList>

        <TabsContent value="heatmap">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Flame className="h-4 w-4 text-primary" /> Top Participants
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topParticipants} layout="vertical" barSize={20}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
                    <YAxis dataKey="studentName" type="category" width={90} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: any) => [`${v}%`, "Score"]} />
                    <Bar dataKey="participationScore" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {lowEngaged.length > 0 && (
              <Card className="border-amber-200 dark:border-amber-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-amber-700 dark:text-amber-400 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> Needs Attention
                  </CardTitle>
                  <CardDescription className="text-xs">Students with participation score below 40%</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {lowEngaged.map((r: any) => (
                    <div key={r.studentId} className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-full bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center text-xs font-bold text-amber-700 shrink-0">
                        {r.studentName?.slice(0, 2).toUpperCase() ?? "ST"}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium">{r.studentName ?? `Student ${r.studentId}`}</p>
                        <Progress value={r.participationScore} className="h-1.5 mt-1" />
                      </div>
                      <Badge variant="secondary" className="text-xs">{r.participationScore}%</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {lowEngaged.length === 0 && (
              <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/10">
                <CardContent className="p-6 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-emerald-700 dark:text-emerald-400">Excellent engagement!</p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5">All students are above the 40% participation threshold.</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="radar">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Class Engagement Profile</CardTitle>
              <CardDescription className="text-xs">Multi-dimensional engagement across 5 indicators</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
                  <Radar dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="table">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead className="text-center">Hand Raises</TableHead>
                    <TableHead className="text-center">Chat Messages</TableHead>
                    <TableHead className="text-center">Poll Responses</TableHead>
                    <TableHead>Attention</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.studentName ?? `Student ${r.studentId}`}</TableCell>
                      <TableCell className="text-center">{r.handRaises}</TableCell>
                      <TableCell className="text-center">{r.chatMessages}</TableCell>
                      <TableCell className="text-center">{r.pollResponses}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={r.attentionPercentage} className="h-2 w-20" />
                          <span className="text-xs tabular-nums">{r.attentionPercentage}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={r.participationScore >= 70 ? "default" : r.participationScore >= 40 ? "secondary" : "destructive"}
                          className="text-xs"
                        >
                          {r.participationScore}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
