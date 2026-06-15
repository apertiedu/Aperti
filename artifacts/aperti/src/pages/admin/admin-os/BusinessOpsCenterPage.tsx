import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { fetchJSON } from "@/lib/api";
import {
  Layout, Quote, HelpCircle, Megaphone, Flag, Users, BarChart3,
  FileText, Globe, TrendingUp, ArrowRight, CheckCircle2, Clock,
  Eye, CreditCard,
} from "lucide-react";

const TOOLS = [
  {
    category: "Landing Page",
    items: [
      { href: "/admin/os/landing-settings", icon: Layout, label: "Landing Page Editor", desc: "Edit headlines, CTAs, features, trust badges, and footer content", color: "bg-teal-50 text-teal-600", badge: "Live CMS" },
      { href: "/admin/os/landing-cms", icon: Globe, label: "Section Manager", desc: "Add, reorder, and toggle visibility of landing page sections", color: "bg-teal-50 text-teal-600" },
    ],
  },
  {
    category: "Content Management",
    items: [
      { href: "/admin/os/testimonials", icon: Quote, label: "Testimonials", desc: "Add, approve, reorder, and manage customer testimonials", color: "bg-blue-50 text-blue-600" },
      { href: "/admin/os/faqs", icon: HelpCircle, label: "FAQs", desc: "Create and publish FAQ content by category", color: "bg-indigo-50 text-indigo-600" },
      { href: "/admin/os/announcements", icon: Megaphone, label: "Announcements", desc: "Create, pin, schedule, and target announcements by role", color: "bg-purple-50 text-purple-600" },
    ],
  },
  {
    category: "Growth & Waitlist",
    items: [
      { href: "/admin/os/signup-waitlist", icon: Users, label: "Signup Waitlist", desc: "Manage landing page submissions — approve, contact, convert", color: "bg-amber-50 text-amber-600", badge: "Submissions" },
      { href: "/admin/os/waitlists", icon: Clock, label: "Feature Waitlists", desc: "Manage waitlists for specific platform features", color: "bg-orange-50 text-orange-600" },
      { href: "/admin/os/conversion", icon: TrendingUp, label: "Conversion Analytics", desc: "Track visitor-to-signup and signup-to-paid funnel metrics", color: "bg-green-50 text-green-600" },
    ],
  },
  {
    category: "Feature Control",
    items: [
      { href: "/admin/os/features", icon: Flag, label: "Feature Flags", desc: "Enable, disable, and set beta or coming-soon status for features", color: "bg-pink-50 text-pink-600" },
      { href: "/admin/os/feature-registry", icon: CheckCircle2, label: "Feature Registry", desc: "Full lifecycle management: draft → scheduled → released", color: "bg-red-50 text-red-600" },
      { href: "/admin/os/platform-status", icon: Eye, label: "Platform Status", desc: "Control what users see about system status and availability", color: "bg-gray-50 text-gray-600" },
    ],
  },
  {
    category: "Business Analytics",
    items: [
      { href: "/admin/os/business-analytics", icon: BarChart3, label: "Business Analytics", desc: "Users, subscriptions, conversion rates, waitlist growth", color: "bg-teal-50 text-teal-600", badge: "New" },
      { href: "/admin/os/analytics", icon: TrendingUp, label: "Platform Analytics", desc: "Deep-dive into platform usage, retention, and AI metrics", color: "bg-blue-50 text-blue-600" },
      { href: "/admin/os/audit", icon: FileText, label: "Audit Logs", desc: "Track all administrative actions for transparency and compliance", color: "bg-gray-50 text-gray-600" },
    ],
  },
];

function QuickStat({ label, value, icon: Icon, color }: { label: string; value: any; icon: any; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xl font-bold text-gray-900">{value ?? "—"}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

export default function BusinessOpsCenterPage() {
  const { data: bizData } = useQuery<any>({
    queryKey: ["business-analytics"],
    queryFn: () => fetchJSON("/api/admin/business-analytics"),
    staleTime: 60_000,
  });

  const { data: waitlistStats } = useQuery<any>({
    queryKey: ["signup-waitlist-stats"],
    queryFn: () => fetchJSON("/api/admin/signup-waitlist/stats"),
    staleTime: 60_000,
  });

  const u = bizData?.users ?? {};
  const s = bizData?.subscriptions ?? {};

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Business Operations Center</h1>
          <p className="text-sm text-gray-500 mt-0.5">Phase 15 — Manage Aperti as a SaaS business without developer intervention</p>
        </div>
        <Link href="/" target="_blank">
          <a className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50 transition-colors">
            <Eye className="w-4 h-4" /> View Live Site
          </a>
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <QuickStat label="Total Users" value={parseInt(u.total_users || 0).toLocaleString()} icon={Users} color="bg-teal-50 text-teal-600" />
        <QuickStat label="Active Subscriptions" value={parseInt(s.active || 0).toLocaleString()} icon={CreditCard} color="bg-blue-50 text-blue-600" />
        <QuickStat label="Waitlist Submissions" value={parseInt(waitlistStats?.total || 0).toLocaleString()} icon={Clock} color="bg-amber-50 text-amber-600" />
        <QuickStat label="Conversion Rate" value={`${bizData?.conversion_rate ?? "0"}%`} icon={TrendingUp} color="bg-green-50 text-green-600" />
      </div>

      {/* Tool Grid */}
      {TOOLS.map((group, gi) => (
        <div key={gi} className="space-y-3">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{group.category}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {group.items.map((item, ii) => {
              const Icon = item.icon;
              return (
                <Link key={ii} href={item.href}>
                  <motion.a
                    whileHover={{ y: -2 }}
                    className="block bg-white rounded-xl border border-gray-100 shadow-sm p-4 cursor-pointer hover:shadow-md hover:border-gray-200 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${item.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-gray-900 text-sm">{item.label}</p>
                            {item.badge && (
                              <span className="px-1.5 py-0.5 bg-teal-100 text-teal-700 text-[10px] font-bold rounded-full">{item.badge}</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" />
                    </div>
                  </motion.a>
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      {/* Info Footer */}
      <div className="bg-teal-50 border border-teal-100 rounded-xl p-5 flex items-start gap-4">
        <Globe className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-teal-800">No-code platform management — Phase 15</p>
          <p className="text-xs text-teal-700 mt-1 leading-relaxed">
            All changes made through this center take effect immediately on the live platform. 
            No code deployment, pull requests, or developer involvement required.
            Use the Audit Logs to track every administrative change made through this center.
          </p>
        </div>
      </div>
    </div>
  );
}
