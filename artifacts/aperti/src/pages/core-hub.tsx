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
  Users,
  TrendingUp,
  Award,
  Clock,
  Bell,
  HelpCircle,
  ChevronRight,
  Zap,
  Sparkles,
  Edit3,
} from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/context/auth";
import { useQuery } from "@tanstack/react-query";

// ---------- API helpers ----------
const API = import.meta.env.VITE_API_URL || "";

async function fetchJSON(url: string) {
  const token = localStorage.getItem("aperti_token");
  const res = await fetch(`${API}${url}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

export default function CoreHub() {
  const { user } = useAuth();
  const displayName = user?.displayName || "Youssef Tarek";
  const isAdmin = user?.role === "admin";

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: () => fetchJSON("/dashboard/summary"),
  });

  const { data: subData, isLoading: subLoading } = useQuery({
    queryKey: ["subscription", "mine"],
    queryFn: () => fetchJSON("/subscriptions/mine"),
  });

  const plan = subData?.subscription?.plan;
  const flexSeats = subData?.flexSeats || [];
  const currentStudents = 287; // Replace later with actual count from API

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      {/* Header – personalised */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between mb-8"
      >
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Welcome back, <span className="text-primary">{displayName}</span>
          </h1>
          <p className="text-muted-foreground">Your classroom at a glance.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white">
              3
            </span>
          </Button>
          {isAdmin && (
            <Link href="/admin/subpilot-settings">
              <Button variant="outline" size="icon" title="Manage subscription plans">
                <Edit3 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </Link>
          )}
          <Link href="/helpdesk">
            <Button variant="outline" size="icon">
              <HelpCircle className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Stats row – live data */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      >
        {summaryLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatsCard label="Today’s Lessons" value={summary?.lessonsToday} icon={<BookOpen className="h-5 w-5 text-primary" />} />
            <StatsCard label="Students Present" value={summary?.studentsPresent} icon={<Users className="h-5 w-5 text-primary" />} />
            <StatsCard label="Attendance Rate" value={`${summary?.attendanceRate}%`} icon={<CalendarCheck className="h-5 w-5 text-primary" />} />
            <StatsCard label="Pending Homework" value={summary?.pendingHomework} icon={<Clock className="h-5 w-5 text-primary" />} />
          </>
        )}
      </motion.div>

      {/* Two‑column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upcoming Lessons – placeholder, real API next */}
          <motion.div variants={item} initial="hidden" animate="show">
            <Card className="card-hover">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CalendarCheck className="h-5 w-5 text-primary" />
                  Upcoming Lessons
                </CardTitle>
                <CardDescription>Your next sessions (coming soon)</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-3 text-muted-foreground text-sm">
                    {["09:00 AM — Physics 0625", "11:00 AM — Math 0580", "02:00 PM — Chemistry"].map((l, i) => (
                      <div key={i} className="p-3 rounded-lg bg-muted/50">{l}</div>
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
                  {[
                    { label: "Start Live Class", icon: CalendarCheck, href: "/live-class" },
                    { label: "Take Attendance", icon: CheckCheckIcon, href: "/checkin" },
                    { label: "Create Homework", icon: BookOpen, href: "/submit-flow" },
                    { label: "View Reports", icon: TrendingUp, href: "/pulse" },
                  ].map((a, idx) => (
                    <Link key={idx} href={a.href}>
                      <Button variant="outline" className="w-full h-auto py-3 flex flex-col items-center gap-1 group">
                        <a.icon className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
                        <span className="text-xs">{a.label}</span>
                      </Button>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Subscription health – real data */}
          <motion.div variants={item} initial="hidden" animate="show">
            <Card className="card-hover">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="h-5 w-5 text-primary" />
                    SubPilot™
                  </CardTitle>
                  {isAdmin && (
                    <Link href="/admin/subpilot-settings">
                      <Button variant="ghost" size="icon" title="Edit plans">
                        <Edit3 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </Link>
                  )}
                </div>
                <CardDescription>
                  {plan ? `${plan.name} plan — ${plan.priceEgp} EGP / student / month` : "Loading…"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {plan ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Students</span>
                      <span className="font-medium">{currentStudents} / {plan.studentLimit}</span>
                    </div>
                    <Progress value={(currentStudents / plan.studentLimit) * 100} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        FlexSeats™ available at <strong>{plan.flexSeatPriceEgp} EGP</strong> each
                      </span>
                    </div>
                  </>
                ) : (
                  <Skeleton className="h-4 w-full" />
                )}
                <Link href="/subpilot">
                  <Button variant="outline" size="sm" className="w-full mt-1">
                    Manage subscription
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>

          {/* Kudos Engine – placeholder real later */}
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
                    <Avatar className="h-8 w-8 bg-primary/20 text-primary"><AvatarFallback>AS</AvatarFallback></Avatar>
                    <div className="flex-1"><p className="text-sm font-medium">Ahmed S.</p><p className="text-xs text-muted-foreground">+320 pts</p></div>
                    <Badge variant="secondary">1st</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 bg-primary/20 text-primary"><AvatarFallback>MK</AvatarFallback></Avatar>
                    <div className="flex-1"><p className="text-sm font-medium">Mona K.</p><p className="text-xs text-muted-foreground">+275 pts</p></div>
                    <Badge variant="secondary">2nd</Badge>
                  </div>
                </div>
                <Link href="/kudos-engine">
                  <Button variant="ghost" size="sm" className="w-full justify-between">
                    View leaderboard <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// Reusable components
function CheckCheckIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 7 17l-5-5" />
      <path d="m22 10-7.5 7.5L13 16" />
    </svg>
  );
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 200, damping: 20 } },
};

function StatsCard({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <motion.div variants={item}>
      <Card className="card-hover">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">{icon}</div>
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
