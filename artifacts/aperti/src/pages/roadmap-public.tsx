import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useInView } from "framer-motion";
import { Link } from "wouter";
import { Map, CheckCircle2, FlaskConical, Pencil, Hammer, TestTube, Rocket, Lightbulb, Calendar } from "lucide-react";

const TEAL = "#0D9488";

const STATUS_META: Record<string, { label: string; color: string; bg: string; dotColor: string; icon: any }> = {
  planned:     { label: "Planned",     color: "#6B7280", bg: "#F9FAFB", dotColor: "#9CA3AF", icon: Lightbulb },
  researching: { label: "Researching", color: "#2563EB", bg: "#EFF6FF", dotColor: "#3B82F6", icon: FlaskConical },
  designing:   { label: "Designing",   color: "#7C3AED", bg: "#F5F3FF", dotColor: "#8B5CF6", icon: Pencil },
  building:    { label: "Building",    color: "#D97706", bg: "#FFFBEB", dotColor: "#F59E0B", icon: Hammer },
  testing:     { label: "Testing",     color: "#EA580C", bg: "#FFF7ED", dotColor: "#F97316", icon: TestTube },
  beta:        { label: "Beta",        color: "#0D9488", bg: "#F0FDFA", dotColor: "#14B8A6", icon: Rocket },
  released:    { label: "Released",    color: "#059669", bg: "#ECFDF5", dotColor: "#10B981", icon: CheckCircle2 },
};

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

export default function RoadmapPublicPage() {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["public-roadmap"],
    queryFn: () => fetch("/api/roadmap").then((r) => r.json()),
  });

  const groups = Object.entries(STATUS_META).map(([key, meta]) => ({
    ...meta,
    key,
    items: items.filter((i: any) => i.status === key),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Nav */}
      <div className="bg-background/95 border-b border-border sticky top-0 z-40 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-bold text-lg text-gray-900">Aperti<span style={{ color: TEAL }}>.</span></Link>
          <div className="flex items-center gap-4">
            <Link href="/features" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Features</Link>
            <Link href="/release-notes" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">What's New</Link>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="bg-background border-b border-border">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-16 text-center">
          <Reveal>
            <div className="flex items-center justify-center gap-2 mb-6">
              <Map className="w-5 h-5" style={{ color: TEAL }} />
              <span className="text-sm font-medium" style={{ color: TEAL }}>Public Roadmap</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">What we're building next</h1>
            <p className="text-lg text-gray-500">Our public roadmap — see what's planned, in progress, and recently shipped.</p>
          </Reveal>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-6 py-12 space-y-10">
        {isLoading ? (
          <div className="text-center text-gray-400 py-16">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: TEAL, borderTopColor: "transparent" }} />
            Loading roadmap...
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center text-gray-400 py-16">Roadmap coming soon.</div>
        ) : (
          groups.map((group) => {
            const GroupIcon = group.icon;
            return (
              <Reveal key={group.key}>
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: group.bg }}>
                      <GroupIcon className="w-4 h-4" style={{ color: group.color }} />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900">{group.label}</h2>
                    <span className="text-xs text-gray-400 font-medium">{group.items.length} items</span>
                  </div>
                  <div className="space-y-3 pl-4 border-l-2" style={{ borderColor: group.dotColor + "40" }}>
                    {group.items.map((item: any, i: number) => (
                      <motion.div key={item.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }} className="bg-card rounded-xl p-4 shadow-sm border border-border -ml-px">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-gray-900">{item.title}</h3>
                            {item.description && <p className="text-sm text-gray-500 mt-1">{item.description}</p>}
                            {item.category && <span className="text-xs text-gray-400 mt-1 block">{item.category}</span>}
                          </div>
                          {item.target_date && (
                            <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                              <Calendar className="w-3 h-3" />
                              {new Date(item.target_date).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </Reveal>
            );
          })
        )}
      </div>
    </div>
  );
}
