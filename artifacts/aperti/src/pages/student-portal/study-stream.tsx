import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen,
  CalendarCheck,
  Clock,
  CheckCircle,
  AlertCircle,
  Zap,
  Target,
  TrendingUp,
  Flame,
  ArrowRight,
} from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/context/auth";

// ---------- Mock data (replace with real API calls later) ----------
const MOCK_UPCOMING_LESSONS = [
  { id: 1, subject: "Physics 0625 – Electricity", time: "09:00 AM", mode: "online" },
  { id: 2, subject: "Math 0580 – Algebra", time: "11:00 AM", mode: "centre" },
];

const MOCK_HOMEWORK = [
  { id: 1, title: "Chapter 5 Worksheet", subject: "Physics", dueDate: "2026-05-25", status: "pending" },
  { id: 2, title: "Algebra Problem Set", subject: "Math", dueDate: "2026-05-24", status: "submitted" },
];

const MOCK_WEAK_TOPICS = ["Momentum", "Quadratic Equations", "Bonding"];

const MOCK_ASCEND = { xp: 2450, level: 7, rank: "Gold", streak: 12 };

export default function StudyStream() {
  const { user } = useAuth();
  const displayName = user?.displayName || "Student";

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-8"
      >
        <div>
          <h1 className="text-3xl font-bold">
            Welcome back, <span className="text-primary">{displayName}</span>
          </h1>
          <p className="text-muted-foreground">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/ascend">
            <Button variant="outline" size="sm" className="gap-2">
              <Flame className="h-4 w-4 text-orange-500" /> {MOCK_ASCEND.streak} day streak
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Stats Row */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8"
      >
        <StatsCard label="Upcoming" value={MOCK_UPCOMING_LESSONS.length} icon={<CalendarCheck className="h-5 w-5 text-primary" />} />
        <StatsCard label="Homework" value={MOCK_HOMEWORK.length} icon={<BookOpen className="h-5 w-5 text-primary" />} />
        <StatsCard label="Attendance" value="96%" icon={<CheckCircle className="h-5 w-5 text-primary" />} />
        <StatsCard label="Rank" value={MOCK_ASCEND.rank} icon={<Target className="h-5 w-5 text-primary" />} />
      </motion.div>

      {/* Two‑column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upcoming Lessons */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="card-hover">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CalendarCheck className="h-5 w-5 text-primary" />
                  Upcoming Lessons
                </CardTitle>
                <CardDescription>Your next sessions</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[180px]">
                  <div className="space-y-3">
                    {MOCK_UPCOMING_LESSONS.map((lesson) => (
                      <div key={lesson.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="font-medium">{lesson.subject}</p>
                          <p className="text-sm text-muted-foreground">{lesson.time} · {lesson.mode}</p>
                        </div>
                        <Badge variant="outline" className="border-primary text-primary">
                          <Link href="/my-plan-grid">View</Link>
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </motion.div>

          {/* Pending Homework */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="card-hover">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Homework
                </CardTitle>
                <CardDescription>What needs your attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {MOCK_HOMEWORK.map((hw) => (
                    <div key={hw.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium">{hw.title}</p>
                        <p className="text-sm text-muted-foreground">{hw.subject} · Due {hw.dueDate}</p>
                      </div>
                      <Badge variant={hw.status === "submitted" ? "secondary" : "default"}>
                        {hw.status === "submitted" ? <CheckCircle className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
                        {hw.status}
                      </Badge>
                    </div>
                  ))}
                </div>
                <Link href="/my-homework">
                  <Button variant="ghost" size="sm" className="w-full justify-between mt-2">
                    View all homework <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Focus Coach: weak topics */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Card className="card-hover">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Target className="h-5 w-5 text-primary" />
                  Focus Coach
                </CardTitle>
                <CardDescription>Topics to reinforce</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {MOCK_WEAK_TOPICS.map((topic) => (
                    <div key={topic} className="flex items-center justify-between">
                      <span className="text-sm">{topic}</span>
                      <Link href={`/revisit?topic=${encodeURIComponent(topic)}`}>
                        <Button variant="outline" size="sm">Revisit</Button>
                      </Link>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick Actions */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="card-hover">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Zap className="h-5 w-5 text-primary" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <Link href="/mentor"><Button variant="outline" className="w-full h-auto py-3 flex flex-col items-center gap-1"><BookOpen className="h-5 w-5 text-primary" /><span className="text-xs">The Mentor</span></Button></Link>
                  <Link href="/flashcards"><Button variant="outline" className="w-full h-auto py-3 flex flex-col items-center gap-1"><Zap className="h-5 w-5 text-primary" /><span className="text-xs">CardStack</span></Button></Link>
                  <Link href="/simverse"><Button variant="outline" className="w-full h-auto py-3 flex flex-col items-center gap-1"><Flame className="h-5 w-5 text-primary" /><span className="text-xs">SimVerse</span></Button></Link>
                  <Link href="/ascend"><Button variant="outline" className="w-full h-auto py-3 flex flex-col items-center gap-1"><TrendingUp className="h-5 w-5 text-primary" /><span className="text-xs">Ascend</span></Button></Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Ascend Progress */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <Card className="card-hover">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Flame className="h-5 w-5 text-primary" />
                  Ascend Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Level {MOCK_ASCEND.level}</span>
                  <span>{MOCK_ASCEND.xp} / 3000 XP</span>
                </div>
                <Progress value={(MOCK_ASCEND.xp / 3000) * 100} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Rank: {MOCK_ASCEND.rank}</span>
                  <span>Streak: {MOCK_ASCEND.streak} days</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function StatsCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="card-hover">
      <CardContent className="p-4 flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
