import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, CheckCircle, BookOpen, TrendingUp } from "lucide-react";

const API = "/api";

export default function GuardianHub() {
  // For demo: hardcoded children; in production, fetch from guardian_links table
  const children = [
    { id: 1, name: "Ahmed", attendance: 94, avgScore: 87, weakTopics: ["Momentum", "Algebra"] },
    { id: 2, name: "Mona", attendance: 100, avgScore: 92, weakTopics: [] },
  ];

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold">GuardianHub<span className="text-primary"></span></h1>
        <p className="text-muted-foreground">Your children's learning, at a glance.</p>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2">
        {children.map(child => (
          <Card key={child.id} className="card-hover">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" /> {child.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="flex items-center gap-1 text-sm"><CheckCircle className="h-4 w-4 text-primary" /> Attendance</span>
                <span className="font-medium">{child.attendance}%</span>
              </div>
              <Progress value={child.attendance} className="h-2" />
              <div className="flex justify-between">
                <span className="flex items-center gap-1 text-sm"><TrendingUp className="h-4 w-4 text-primary" /> Avg Score</span>
                <span className="font-medium">{child.avgScore}%</span>
              </div>
              {child.weakTopics.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Needs help with:</p>
                  <div className="flex gap-2 flex-wrap">
                    {child.weakTopics.map(t => <Badge key={t} variant="secondary">{t}</Badge>)}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
