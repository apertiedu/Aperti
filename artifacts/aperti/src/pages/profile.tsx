import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { motion } from "framer-motion";
import { MapPin, Calendar, GraduationCap, BookOpen, Users, Shield } from "lucide-react";


const ROLE_META: Record<string, { label: string; Icon: any; color: string }> = {
  teacher:   { label: "Teacher",          Icon: GraduationCap, color: "hsl(var(--primary))" },
  student:   { label: "Student",          Icon: BookOpen,       color: "#3b82f6" },
  parent:    { label: "Parent / Guardian",Icon: Users,          color: "#8b5cf6" },
  admin:     { label: "Administrator",    Icon: Shield,         color: "#111"    },
  assistant: { label: "Assistant Teacher",Icon: GraduationCap, color: "hsl(var(--primary))" },
};

export default function Profile() {
  const [, params] = useRoute("/profile/:id");
  const id = params?.id;

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ["profile", id],
    queryFn: async () => {
      const res = await fetch(`/api/settings/profile/${id}`);
      if (!res.ok) throw new Error("Profile not found");
      return res.json();
    },
    enabled: !!id,
  });

  if (isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" className="border-primary" />
    </div>
  );

  if (isError || !profile) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-2xl">🔍</div>
      <p className="font-semibold text-gray-700">Profile not found</p>
      <p className="text-gray-400 text-sm">This account may not exist or is not public.</p>
      <Link href="/" className="text-sm font-medium hover:underline" className="text-primary">← Go home</Link>
    </div>
  );

  const meta = ROLE_META[profile.role] || ROLE_META.teacher;
  const initials = (profile.display_name || "?").split(" ").slice(0,2).map((n: string) => n[0]).join("").toUpperCase();

  return (
    <div className="min-h-screen bg-background py-10" style={{ fontFamily: "Inter, sans-serif" }}>
      <div className="max-w-lg mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          {/* Banner */}
          <div className="h-28 relative" style={{ background: `linear-gradient(135deg, ${"hsl(var(--primary))"} 0%, #0f766e 100%)` }}>
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
          </div>

          <div className="px-6 pb-6">
            {/* Avatar */}
            <div className="-mt-10 mb-3 flex items-end justify-between">
              <div className="w-20 h-20 rounded-2xl border-4 border-white shadow-sm flex items-center justify-center text-2xl font-bold text-white overflow-hidden flex-shrink-0"
                className="bg-primary">
                {profile.avatar_url
                  ? <img src={profile.avatar_url} alt={profile.display_name} className="w-full h-full object-cover" onError={() => {}} />
                  : initials}
              </div>
            </div>

            <h1 className="text-xl font-bold text-gray-900">{profile.display_name}</h1>

            <div className="flex items-center gap-1.5 mt-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: "#f0fdfa", color: meta.color }}>
                <meta.Icon className="w-3 h-3" />{meta.label}
              </div>
            </div>

            {profile.bio && (
              <p className="text-gray-600 text-sm mt-3 leading-relaxed">{profile.bio}</p>
            )}

            <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-4">
              {profile.country && (
                <div className="flex items-center gap-1.5 text-gray-500 text-sm">
                  <MapPin className="w-3.5 h-3.5" />{profile.country}
                </div>
              )}
              <div className="flex items-center gap-1.5 text-gray-500 text-sm">
                <Calendar className="w-3.5 h-3.5" />
                Member since {new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </div>
            </div>
          </div>
        </motion.div>

        <p className="text-center text-xs text-gray-400 mt-6">
          <Link href="/" className="hover:underline" className="text-primary">Aperti.</Link> — The Educational Operating System
        </p>
      </div>
    </div>
  );
}
