import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  Settings, Users, CreditCard, Globe, Shield, Zap,
  ChevronRight, Save, ExternalLink, ToggleLeft, ToggleRight,
  DollarSign, Bell, Database,
} from "lucide-react";

interface ConfigSection {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  href: string;
  color: string;
  badgeCount?: number;
}

function SectionCard({ section }: { section: ConfigSection }) {
  return (
    <Link href={section.href}>
      <a className="block bg-white border border-gray-100 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-primary/25 transition-all group">
        <div className="flex items-start justify-between">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${section.color}`}>
            <section.icon className="w-5 h-5" />
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary transition-colors mt-1" />
        </div>
        <h3 className="text-sm font-bold text-gray-900">{section.label}</h3>
        <p className="text-xs text-gray-500 mt-1">{section.description}</p>
        {section.badgeCount !== undefined && section.badgeCount > 0 && (
          <span className="mt-2 inline-flex text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
            {section.badgeCount} pending
          </span>
        )}
      </a>
    </Link>
  );
}

function QuickToggle({ label, description, value, onToggle, loading }: {
  label: string; description: string; value: boolean; onToggle: () => void; loading?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
      <button
        onClick={onToggle}
        disabled={loading}
        className={`flex-shrink-0 transition-colors ${loading ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
      >
        {value
          ? <ToggleRight className="w-7 h-7 text-primary" />
          : <ToggleLeft className="w-7 h-7 text-gray-300" />
        }
      </button>
    </div>
  );
}

export default function PlatformConfigPage() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [loadingFeature, setLoadingFeature] = useState<string | null>(null);
  const [pendingPayments, setPendingPayments] = useState(0);

  useEffect(() => {
    fetch("/api/admin/features", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          const map: Record<string, boolean> = {};
          data.forEach((f: any) => { map[f.key] = f.enabled; });
          setFeatures(map);
        }
      }).catch(() => {});

    fetch("/api/admin/payments?status=pending", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setPendingPayments(data.length);
        else if (data?.total) setPendingPayments(data.total);
      }).catch(() => {});
  }, [token]);

  const toggleFeature = async (key: string) => {
    setLoadingFeature(key);
    const newVal = !features[key];
    try {
      const res = await fetch(`/api/admin/features/${key}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newVal }),
      });
      if (res.ok) {
        setFeatures(prev => ({ ...prev, [key]: newVal }));
        toast({ title: `Feature ${newVal ? "enabled" : "disabled"}`, description: key });
      } else {
        throw new Error("Failed to update");
      }
    } catch {
      toast({ title: "Update failed", description: "Could not toggle feature flag", variant: "destructive" });
    } finally {
      setLoadingFeature(null);
    }
  };

  const sections: ConfigSection[] = [
    { id: "plans", label: "Subscription Plans", icon: DollarSign, description: "Manage pricing tiers, limits, and trial periods", href: "/admin/os/plans", color: "bg-primary/8 text-primary" },
    { id: "payments", label: "Payment Approvals", icon: CreditCard, description: "Review and approve InstaPay screenshot submissions", href: "/admin/os/payments", color: "bg-emerald-50 text-emerald-600", badgeCount: pendingPayments },
    { id: "users", label: "User Management", icon: Users, description: "Manage accounts, roles, and access permissions", href: "/admin/os/users", color: "bg-blue-50 text-blue-600" },
    { id: "features-matrix", label: "Feature Visibility", icon: Zap, description: "Control which features are visible to which roles", href: "/admin/os/features-matrix", color: "bg-purple-50 text-purple-600" },
    { id: "landing", label: "Landing Page Content", icon: Globe, description: "Edit hero text, testimonials, FAQs, and pricing display", href: "/admin/os/landing-cms", color: "bg-orange-50 text-orange-600" },
    { id: "security", label: "Security Settings", icon: Shield, description: "Session limits, rate limits, password policies", href: "/admin/os/security", color: "bg-red-50 text-red-600" },
    { id: "notifications", label: "Notification Rules", icon: Bell, description: "Configure when and how users receive alerts", href: "/admin/os/notification-rules", color: "bg-amber-50 text-amber-600" },
    { id: "integrity", label: "Database Integrity", icon: Database, description: "Audit orphaned records, broken relationships", href: "/admin/os/integrity", color: "bg-slate-50 text-slate-600" },
    { id: "roles", label: "Roles & Permissions", icon: Settings, description: "Define what each role can see and do", href: "/admin/os/roles", color: "bg-indigo-50 text-indigo-600" },
  ];

  const QUICK_FEATURES = [
    { key: "ai_mentor", label: "AI Mentor", description: "Student-facing AI tutoring assistant" },
    { key: "question_extraction", label: "Question Extraction", description: "AI-powered question extraction from documents" },
    { key: "snapgrade", label: "SnapGrade", description: "Camera-based OCR grading for students" },
    { key: "ascend", label: "Ascend RPG", description: "Gamification and academic progress RPG" },
    { key: "simverse", label: "SimVerse Labs", description: "Interactive science simulations" },
    { key: "peer_review", label: "Peer Review", description: "Student peer assessment workflow" },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Platform Configuration</h1>
        <p className="text-sm text-gray-500 mt-0.5">Central hub for all platform controls — pricing, features, users, and permissions</p>
      </div>

      {/* Config Sections */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sections.map(s => <SectionCard key={s.id} section={s} />)}
      </motion.div>

      {/* Quick Feature Toggles */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Quick Feature Toggles</h2>
            <p className="text-xs text-gray-400 mt-0.5">Enable or disable major platform features instantly</p>
          </div>
          <Link href="/admin/os/features-matrix">
            <a className="text-xs text-primary hover:text-primary flex items-center gap-1">
              Full Matrix <ExternalLink className="w-3 h-3" />
            </a>
          </Link>
        </div>
        <div className="divide-y divide-gray-50">
          {QUICK_FEATURES.map(f => (
            <QuickToggle
              key={f.key}
              label={f.label}
              description={f.description}
              value={features[f.key] ?? false}
              onToggle={() => toggleFeature(f.key)}
              loading={loadingFeature === f.key}
            />
          ))}
        </div>
      </motion.div>

      {/* Launch Links */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
        <h2 className="text-sm font-bold text-gray-900 mb-3">Launch Readiness</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { label: "Launch Dashboard", href: "/admin/os/launch-dashboard" },
            { label: "Route Health", href: "/admin/os/route-health" },
            { label: "Launch Certification", href: "/admin/os/launch-certification" },
            { label: "Error Intelligence", href: "/admin/os/error-intelligence" },
          ].map(l => (
            <Link key={l.href} href={l.href}>
              <a className="flex items-center gap-2 p-2.5 rounded-lg border border-primary/15 bg-primary/8/50 text-primary text-xs font-medium hover:bg-primary/8 transition-colors">
                <ChevronRight className="w-3.5 h-3.5" />
                {l.label}
              </a>
            </Link>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
