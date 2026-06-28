import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, Star, Zap, BookOpen, Trophy, Target, Flame } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

const ICON_MAP: Record<string, React.ReactNode> = {
  circuit: <Zap className="h-6 w-6" />,
  flashcard: <BookOpen className="h-6 w-6" />,
  attendance: <Star className="h-6 w-6" />,
  exam: <Award className="h-6 w-6" />,
  trophy: <Trophy className="h-6 w-6" />,
  target: <Target className="h-6 w-6" />,
  streak: <Flame className="h-6 w-6" />,
};

function BadgeIcon({ type }: { type?: string }) {
  return ICON_MAP[type ?? ""] ?? <Award className="h-6 w-6" />;
}

export default function SkillBadge() {
  const { data: badges = [], isLoading } = useQuery({
    queryKey: ["skill-badges"],
    queryFn: () => apiFetch("/api/achievements/badges").then((r) => r.json()),
  });

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold">SkillBadge<span className="text-primary"></span></h1>
        <p className="text-muted-foreground">Your earned credentials.</p>
      </motion.div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse h-40" />
          ))}
        </div>
      ) : badges.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <Award className="h-12 w-12 text-muted-foreground" />
            <p className="font-medium text-lg">No badges yet</p>
            <p className="text-muted-foreground text-sm">Complete milestones to earn badges.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {badges.map((badge: any, idx: number) => (
            <motion.div key={badge.id ?? badge.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}>
              <Card className={`card-hover text-center ${!badge.earned ? "opacity-50" : ""}`}>
                <CardContent className="p-6 flex flex-col items-center gap-3">
                  <div className={`h-16 w-16 rounded-full flex items-center justify-center ${badge.earned ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                    <BadgeIcon type={badge.icon_type} />
                  </div>
                  <p className="font-medium text-sm">{badge.name}</p>
                  {badge.earned ? <Badge variant="default">Earned</Badge> : <Badge variant="secondary">Locked</Badge>}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
