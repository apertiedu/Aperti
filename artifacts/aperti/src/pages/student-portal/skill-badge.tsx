import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, Star, Zap, BookOpen } from "lucide-react";

const MOCK_BADGES = [
  { name: "Circuit Master", icon: <Zap className="h-6 w-6" />, earned: true },
  { name: "Flashcard Pro", icon: <BookOpen className="h-6 w-6" />, earned: true },
  { name: "Perfect Attendance", icon: <Star className="h-6 w-6" />, earned: false },
  { name: "Exam Apex", icon: <Award className="h-6 w-6" />, earned: false },
];

export default function SkillBadge() {
  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold">SkillBadge<span className="text-primary"></span></h1>
        <p className="text-muted-foreground">Your earned credentials.</p>
      </motion.div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {MOCK_BADGES.map((badge, idx) => (
          <motion.div key={badge.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}>
            <Card className={`card-hover text-center ${!badge.earned ? "opacity-50" : ""}`}>
              <CardContent className="p-6 flex flex-col items-center gap-3">
                <div className={`h-16 w-16 rounded-full flex items-center justify-center ${badge.earned ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {badge.icon}
                </div>
                <p className="font-medium text-sm">{badge.name}</p>
                {badge.earned ? <Badge variant="default">Earned</Badge> : <Badge variant="secondary">Locked</Badge>}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
