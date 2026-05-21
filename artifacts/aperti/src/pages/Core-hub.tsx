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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  BookOpen,
  CalendarCheck,
  Users,
  TrendingUp,
  Award,
  Clock,
  Bell,
  Settings,
  HelpCircle,
  ChevronRight,
  Zap,
  Sparkles,
} from "lucide-react";
import { Link } from "wouter";

// ---------- Mock data (replace with API calls later) ----------
const todayStats = {
  lessons: 4,
  studentsPresent: 89,
  attendanceRate: 92,
  pendingHomework: 12,
};

const upcomingLessons = [
  { time: "09:00 AM", subject: "Physics 0625 – Electricity", students: 22 },
  { time: "11:00 AM", subject: "Math 0580 – Algebra", students: 18 },
  { time: "02:00 PM", subject: "Chemistry – Bonding", students: 15 },
];

const quickActions = [
  { label: "Start Live Class", icon: CalendarCheck, color: "text-teal-600", href: "/live-class" },
  { label: "Take Attendance", icon: CheckCheckIcon, color: "text-teal-600", href: "/checkin" },
  { label: "Create Homework", icon: BookOpen, color: "text-teal-600", href: "/submit-flow" },
  { label: "View Reports", icon: TrendingUp, color: "text-teal-600", href: "/pulse" },
];

// Custom CheckCheck icon (inline)
function CheckCheckIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 7 17l-5-5" />
      <path d="m22 10-7.5 7.5L13 16" />
    </svg>
  );
}

// Animation variants
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 200, damping: 20 } },
};

// ---------- Main Component ----------
export default function CoreHub() {
  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between mb-8"
      >
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Welcome back, <span className="text-primary">Teacher</span>
          </h1>
          <p className="text-muted-foreground">Here’s your classroom at a glance.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white">
              3
            </span>
          </Button>
          <Button variant="outline" size="icon">
            <Settings className="h-5 w-5" />
          </Button>
          <Link href="/helpdesk">
            <Button variant="outline" size="icon">
              <HelpCircle className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Stats Row */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      >
        <StatsCard
          label="Today’s Lessons"
          value={todayStats.lessons}
          icon={<BookOpen className="h-5 w-5 text-primary" />}
        />
        <StatsCard
          label="Students Present"
          value={todayStats.studentsPresent}
          icon={<Users className="h-5 w-5 text-primary" />}
        />
        <StatsCard
          label="Attendance Rate"
          value={`${todayStats.attendanceRate}%`}
          icon={<CalendarCheck className="h-5 w-5 text-primary" />}
        />
        <StatsCard
          label="Pending Homework"
          value={todayStats.pendingHomework}
          icon={<Clock className="h-5 w-5 text-primary" />}
        />
      </motion.div>

      {/* Two‑column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column (upcoming + quick actions) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upcoming Lessons */}
          <motion.div variants={item} initial="hidden" animate="show">
            <Card className="card-hover">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CalendarCheck className="h-5 w-5 text-primary" />
                  Upcoming Lessons
                </CardTitle>
                <CardDescription>Your next sessions</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-3">
                    {upcomingLessons.map((lesson, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="font-medium">{lesson.subject}</p>
                          <p className="text-sm text-muted-foreground">{lesson.time} • {lesson.students} students</p>
                        </div>
                        <Badge variant="outline" className="border-primary text-primary">
                          <Link href="/plan-grid">View</Link>
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick Actions */}
          <motion.div variants={item} initial="hidden" animate="show">
            <Card className="card-hover">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Zap className="h-5 w-5 text-primary" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {quickActions.map((action, idx) => (
                    <Link key={idx} href={action.href}>
                      <Button variant="outline" className="w-full h-auto py-3 flex flex-col items-center gap-1 group">
                        <action.icon className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
                        <span className="text-xs">{action.label}</span>
                      </Button>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Right column (subscription + kudos) */}
        <div className="space-y-6">
          {/* Subscription Health */}
          <motion.div variants={item} initial="hidden" animate="show">
            <Card className="card-hover">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-5 w-5 text-primary" />
                  SubPilot™
                </CardTitle>
                <CardDescription>Your current plan</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Plan</span>
                  <Badge className="bg-primary text-primary-foreground">Master</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Students</span>
                  <span className="font-medium">287 / 300</span>
                </div>
                <Progress value={95} className="h-2" />
                <p className="text-xs text-muted-foreground">FlexSeats™ available • <Link href="/subpilot" className="underline underline-offset-2">Manage</Link></p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Kudos Engine */}
          <motion.div variants={item} initial="hidden" animate="show">
            <Card className="card-hover">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Award className="h-5 w-5 text-primary" />
                  Kudos Engine™
                </CardTitle>
                <CardDescription>Top assistants this week</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 bg-primary/20 text-primary">
                      <AvatarFallback>AS</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Ahmed S.</p>
                      <p className="text-xs text-muted-foreground">+320 pts</p>
                    </div>
                    <Badge variant="secondary">1st</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 bg-primary/20 text-primary">
                      <AvatarFallback>MK</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Mona K.</p>
                      <p className="text-xs text-muted-foreground">+275 pts</p>
                    </div>
                    <Badge variant="secondary">2nd</Badge>
                  </div>
                  <Link href="/kudos-engine">
                    <Button variant="ghost" size="sm" className="w-full justify-between">
                      View leaderboard <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// Reusable stats card
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
    <motion.div variants={item}>
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
    </motion.div>
  );
}
