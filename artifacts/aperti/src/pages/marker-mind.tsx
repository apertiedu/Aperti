import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Lightbulb, AlertTriangle } from "lucide-react";

const API = "/api";
const token = () => localStorage.getItem("aperti_token");

export default function MarkerMind() {
  const { data: tips, isLoading } = useQuery({
    queryKey: ["marker-mind-tips", 1], // replace with real subjectId
    queryFn: async () => {
      const res = await fetch(`${API}/marker-mind/tips/1`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      return res.json();
    },
  });

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Lightbulb className="h-7 w-7 text-primary" /> MarkerMind<span className="text-primary"></span>
        </h1>
        <p className="text-muted-foreground">Examiner tips from past reports.</p>
      </motion.div>

      {isLoading ? (
        <div className="space-y-4">{[1,2].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
      ) : tips?.length === 0 ? (
        <Card className="card-hover"><CardContent className="p-8 text-center text-muted-foreground">No reports uploaded yet.</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {tips.map((tip: any, idx: number) => (
            <Card key={idx} className="card-hover">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Report from {tip.year}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{tip.commonMistakes}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
