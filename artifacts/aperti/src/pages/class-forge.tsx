import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Users, MousePointerClick, MessageCircle, Activity, Flame } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";
const token = () => localStorage.getItem("aperti_token");

async function fetchJSON(url: string) {
  const res = await fetch(`${API}${url}`, { headers: { Authorization: `Bearer ${token()}` } });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

export default function ClassForge() {
  const liveClassId = 1;
  const { data, isLoading } = useQuery({
    queryKey: ["class-forge", "heatmap", liveClassId],
    queryFn: () => fetchJSON(`/class-forge/heatmap/${liveClassId}`),
  });

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold">ClassForge<span className="text-primary">™</span></h1>
        <p className="text-muted-foreground">Post‑session engagement intelligence.</p>
      </motion.div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="card-hover">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{data?.averageAttention || 0}%</p>
                  <p className="text-sm text-muted-foreground">Average Attention</p>
                </div>
              </CardContent>
            </Card>
            <Card className="card-hover">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <MousePointerClick className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{data?.totalHandRaises || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Hand Raises</p>
                </div>
              </CardContent>
            </Card>
            <Card className="card-hover">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <MessageCircle className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{data?.records?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Participants</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top participants chart */}
          {data?.topParticipants?.length > 0 && (
            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Flame className="h-5 w-5 text-primary" /> Top Participants</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data.topParticipants} layout="vertical">
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis dataKey="studentId" type="category" width={80} />
                    <Tooltip />
                    <Bar dataKey="participationScore" fill="hsl(var(--primary))" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Low participants alert */}
          {data?.lowParticipants?.length > 0 && (
            <Card className="card-hover border-orange-200">
              <CardHeader>
                <CardTitle className="text-orange-600">Needs Attention</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.lowParticipants.map((p: any) => (
                    <div key={p.studentId} className="flex items-center justify-between">
                      <span>Student {p.studentId}</span>
                      <Badge variant="secondary">{p.participationScore}% engagement</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Full table */}
          <Card className="card-hover">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Hand Raises</TableHead>
                    <TableHead>Chat Messages</TableHead>
                    <TableHead>Poll Responses</TableHead>
                    <TableHead>Attention</TableHead>
                    <TableHead>Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.records?.map((rec: any) => (
                    <TableRow key={rec.studentId}>
                      <TableCell>{rec.studentId}</TableCell>
                      <TableCell>{rec.handRaises}</TableCell>
                      <TableCell>{rec.chatMessages}</TableCell>
                      <TableCell>{rec.pollResponses}</TableCell>
                      <TableCell>
                        <Progress value={rec.attentionPercentage} className="h-2 w-16" />
                        <span className="text-xs ml-2">{rec.attentionPercentage}%</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={rec.participationScore >= 70 ? "default" : rec.participationScore >= 40 ? "secondary" : "destructive"}>
                          {rec.participationScore}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
