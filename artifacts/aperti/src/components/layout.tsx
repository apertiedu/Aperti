import { useLocation, Link } from "wouter";
import { LayoutDashboard, CheckSquare, Users, CalendarClock, FileBarChart, School, LogOut, UserCog } from "lucide-react";
import { useAuth } from "@/context/auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function AddAccountDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ username: "", displayName: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to create account");
      }
      toast({ title: "Account created", description: `${form.displayName || form.username} can now log in` });
      setOpen(false);
      setForm({ username: "", displayName: "", password: "" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors w-full">
          <UserCog className="w-4 h-4" />
          Add Assistant
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Assistant Account</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Display Name</Label>
            <Input
              placeholder="e.g. Sarah Ahmed"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Username</Label>
            <Input
              placeholder="e.g. sarah"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, "") })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input
              type="password"
              placeholder="Choose a password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating..." : "Create Account"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Mark Attendance", href: "/attendance", icon: CheckSquare },
    { name: "Students", href: "/students", icon: Users },
    { name: "Sessions", href: "/sessions", icon: CalendarClock },
    { name: "Reports", href: "/reports", icon: FileBarChart },
  ];

  const handleLogout = async () => {
    await logout();
    toast({ title: "Signed out" });
  };

  return (
    <div className="min-h-screen flex w-full bg-background font-sans">
      <div className="w-64 bg-card border-r border-border flex flex-col h-screen sticky top-0">
        {/* Logo */}
        <div className="p-6 border-b border-border flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground">
            <School className="w-5 h-5" />
          </div>
          <h1 className="font-bold text-lg tracking-tight text-foreground">Aperti</h1>
        </div>

        {/* Navigation */}
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

        {/* Bottom user section */}
        <div className="p-4 border-t border-border space-y-1">
          <AddAccountDialog />
          <div className="px-3 py-2 text-xs text-muted-foreground truncate">
            Signed in as <span className="font-medium text-foreground">{user?.displayName || user?.username}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-sm"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </Button>
        </div>
      </div>

      <main className="flex-1 flex flex-col min-h-screen">
        <div className="flex-1 p-8 max-w-[1200px] mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
