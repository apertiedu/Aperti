import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Users, Flame } from "lucide-react";

const TEAMS = [
  { name: "Physics Phantoms", xp: 8540, members: 12 },
  { name: "Math Mavericks", xp: 7200, members: 10 },
  { name: "Chem Crew", xp: 6900, members: 9 },
];

export default function TeamForge() {
  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold">TeamForge<span className="text-primary"></span></h1>
        <p className="text-muted-foreground">Class leagues and team competitions.</p>
      </motion.div>

      <div className="grid gap-4 max-w-2xl">
        {TEAMS.map((team, idx) => (
          <Card key={team.name} className="card-hover">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                  {idx + 1}
                </div>
                <div>
                  <p className="font-medium">{team.name}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" /> {team.members} members
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold flex items-center gap-1"><Flame className="h-4 w-4 text-orange-500" /> {team.xp.toLocaleString()} XP</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
