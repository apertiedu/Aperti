import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, TrendingUp } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";
const token = () => localStorage.getItem("aperti_token");

export default function ErrorTrace() {
  const studentId = 1; // dynamic later
  const { data, isLoading } = useQuery({
    queryKey: ["error-trace", studentId],
    queryFn: async () => {
      const res = await fetch(`${API}/error-trace/student/${studentId}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      return res.json();
    },
  });

  if (isLoading) return <Skeleton className="h-96 rounded-xl" />;

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <TrendingUp className="h-7 w-7 text-primary" /> ErrorTrace<span className="text-primary">™</span>
        </h1>
        <p className="text-muted-foreground">Your mistake personality decoded.</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="card-hover">
          <CardHeader><CardTitle>Mistake Patterns</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(data?.patterns || {}).map(([key, value]: any) => (
              <div key={key}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{key.replace(/([A-Z])/g, ' $1')}</span>
                  <span>{value}</span>
                </div>
                <Progress value={Math.min(100, value)} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardHeader><CardTitle>Recommendation</CardTitle></CardHeader>
          <CardContent>
            <AlertTriangle className="h-5 w-5 text-primary mb-2" />
            <p className="text-sm">{data?.recommendation}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
