import { useLocation, Link } from "wouter";
import { LayoutDashboard, CheckSquare, Users, CalendarClock, FileBarChart, School } from "lucide-react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Mark Attendance", href: "/attendance", icon: CheckSquare },
    { name: "Students", href: "/students", icon: Users },
    { name: "Sessions", href: "/sessions", icon: CalendarClock },
    { name: "Reports", href: "/reports", icon: FileBarChart },
  ];

  return (
    <div className="min-h-screen flex w-full bg-background font-sans">
      <div className="w-64 bg-card border-r border-border flex flex-col h-screen sticky top-0">
        <div className="p-6 border-b border-border flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground">
            <School className="w-5 h-5" />
          </div>
          <h1 className="font-bold text-lg tracking-tight text-foreground">Aperti</h1>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
      <main className="flex-1 flex flex-col min-h-screen">
        <div className="flex-1 p-8 max-w-[1200px] mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
