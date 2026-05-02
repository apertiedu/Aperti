import { useLocation, Link } from "wouter";
import { LayoutDashboard, CheckSquare, BookOpen, FolderOpen, User, LogOut, School, GraduationCap } from "lucide-react";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

const NAV_ITEMS = [
  { name: "Home", href: "/", icon: LayoutDashboard },
  { name: "My Attendance", href: "/attendance", icon: CheckSquare },
  { name: "Homework", href: "/homework", icon: BookOpen },
  { name: "Resources", href: "/resources", icon: FolderOpen },
  { name: "My Profile", href: "/profile", icon: User },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();

  const handleLogout = async () => {
    await logout();
    toast({ title: "Signed out" });
  };

  const initials = (user?.displayName || user?.username || "S")
    .split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="min-h-screen flex w-full bg-gradient-to-br from-slate-50 to-indigo-50/30 font-sans">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-indigo-100 flex flex-col h-screen sticky top-0 shadow-sm">
        {/* Logo */}
        <div className="p-5 border-b border-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white flex-shrink-0 shadow-md shadow-indigo-200">
              <School className="w-4.5 h-4.5" style={{width:18,height:18}} />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-gray-900 leading-none">Aperti</h1>
              <p className="text-[10px] text-indigo-400 mt-0.5 font-medium">Student Portal</p>
            </div>
          </div>
        </div>

        {/* Student avatar */}
        <div className="px-4 py-4 border-b border-indigo-50">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-indigo-50 to-violet-50">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-sm font-bold shadow-sm flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-900 truncate">{user?.displayName || user?.username}</p>
              <p className="text-[10px] text-indigo-500 font-medium">Student</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                    : "text-gray-500 hover:bg-indigo-50 hover:text-indigo-700"
                }`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-indigo-50">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-red-50 hover:text-red-600 transition-all duration-200"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />Sign out
          </button>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-screen overflow-auto">
        <div className="flex-1 p-6 lg:p-8 max-w-5xl mx-auto w-full">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
