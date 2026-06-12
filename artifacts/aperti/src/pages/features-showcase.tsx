import { useState, useRef, FormEvent } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { Link } from "wouter";
import { Search, CheckCircle2, Clock, TestTube, AlertCircle, Package, ArrowRight, Users, Timer } from "lucide-react";
import { postJSON } from "@/lib/api";
import { toast } from "sonner";

const TEAL = "#0D9488";

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  released:    { label: "Available",   color: "#059669", bg: "#ECFDF5", icon: CheckCircle2 },
  beta:        { label: "Beta",        color: "#D97706", bg: "#FFFBEB", icon: TestTube },
  coming_soon: { label: "Coming Soon", color: "#0D9488", bg: "#F0FDFA", icon: Clock },
  scheduled:   { label: "Launching",  color: "#6366F1", bg: "#EEF2FF", icon: Timer },
  internal:    { label: "Internal",   color: "#6B7280", bg: "#F9FAFB", icon: Package },
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

function WaitlistModal({ feature, onClose }: { feature: any; onClose: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", role: "", organization: "" });
  const [done, setDone] = useState(false);

  const mutation = useMutation({
    mutationFn: () => postJSON(`/api/features/${feature.id}/waitlist`, form),
    onSuccess: () => setDone(true),
    onError: () => toast.error("Failed to join waitlist"),
  });

  function handleSubmit(e: FormEvent) { e.preventDefault(); mutation.mutate(); }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {done ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-teal-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">You're on the list!</h3>
            <p className="text-gray-500 text-sm mb-6">We'll notify you when <strong>{feature.name}</strong> becomes available.</p>
            <button onClick={onClose} className="px-6 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition-colors">Done</button>
          </div>
        ) : (
          <>
            <div className="px-6 py-5 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Join Waitlist</h3>
              <p className="text-sm text-gray-500 mt-0.5">Be first to access <strong>{feature.name}</strong></p>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Email *</label><input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                    <option value="">Select...</option><option value="teacher">Teacher</option><option value="student">Student</option><option value="admin">Admin</option><option value="parent">Parent</option>
                  </select>
                </div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Organization</label><input value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={!form.email || mutation.isPending} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50" style={{ backgroundColor: TEAL }}>
                  {mutation.isPending ? "Joining..." : "Join Waitlist"}
                </button>
              </div>
            </form>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

function CountdownTimer({ seconds }: { seconds: number }) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return (
    <div className="flex gap-2 text-xs">
      {d > 0 && <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded font-mono font-bold">{d}d</span>}
      <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded font-mono font-bold">{h}h</span>
      <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded font-mono font-bold">{m}m</span>
    </div>
  );
}

export default function FeatureShowcasePage() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [waitlistFeature, setWaitlistFeature] = useState<any>(null);

  const { data: features = [], isLoading } = useQuery({
    queryKey: ["public-features"],
    queryFn: () => fetch("/api/features/public").then((r) => r.json()),
  });

  const filtered = features.filter((f: any) => {
    const matchSearch = !search || f.name.toLowerCase().includes(search.toLowerCase()) || (f.description || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || f.status === filterStatus;
    const matchCat = !filterCat || f.category === filterCat;
    return matchSearch && matchStatus && matchCat;
  });

  const categories = [...new Set(features.map((f: any) => f.category).filter(Boolean))];

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-bold text-lg text-gray-900">Aperti<span className="text-teal-600">.</span></Link>
          <div className="flex items-center gap-4">
            <Link href="/roadmap" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Roadmap</Link>
            <Link href="/release-notes" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">What's New</Link>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-16 text-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-teal-50 text-teal-700 rounded-full text-xs font-medium mb-6">
              <Package className="w-3 h-3" /> {features.length} Features
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">Platform Features</h1>
            <p className="text-lg text-gray-500">Everything Aperti can do — from AI-powered grading to live classrooms.</p>
          </Reveal>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        {/* Filters */}
        <Reveal>
          <div className="flex flex-wrap gap-3 mb-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search features..." className="pl-9 pr-4 py-2 bg-white rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 w-56" />
            </div>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 bg-white rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">All Statuses</option>
              {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            {categories.length > 0 && (
              <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="px-3 py-2 bg-white rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option value="">All Categories</option>
                {categories.map((c: any) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>
        </Reveal>

        {isLoading ? (
          <div className="text-center text-gray-400 py-20">
            <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading features...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((feature: any, i: number) => {
              const meta = STATUS_META[feature.status] || STATUS_META.released;
              const Icon = meta.icon;
              return (
                <Reveal key={feature.id} delay={i * 0.05}>
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col gap-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ color: meta.color, backgroundColor: meta.bg }}>
                            <Icon className="w-3 h-3" />{meta.label}
                          </span>
                          {feature.category && <span className="text-xs text-gray-400">{feature.category}</span>}
                        </div>
                        <h3 className="font-bold text-gray-900">{feature.name}</h3>
                      </div>
                    </div>
                    {feature.description && <p className="text-sm text-gray-500 line-clamp-2">{feature.description}</p>}
                    {feature.launch_countdown_seconds && (
                      <CountdownTimer seconds={feature.launch_countdown_seconds} />
                    )}
                    <div className="flex items-center justify-between mt-auto pt-2">
                      {feature.version && <span className="text-xs text-gray-400 font-mono">v{feature.version}</span>}
                      {(feature.status === "coming_soon" || feature.status === "scheduled") ? (
                        <button onClick={() => setWaitlistFeature(feature)} className="flex items-center gap-1 text-sm font-medium transition-colors hover:opacity-80" style={{ color: TEAL }}>
                          <Users className="w-4 h-4" /> Join Waitlist
                        </button>
                      ) : (
                        <Link href={`/features/${feature.id}`} className="flex items-center gap-1 text-sm font-medium transition-colors hover:opacity-80" style={{ color: TEAL }}>
                          Learn More <ArrowRight className="w-4 h-4" />
                        </Link>
                      )}
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="text-center text-gray-400 py-16">No features match your filters.</div>
        )}
      </div>

      <AnimatePresence>
        {waitlistFeature && <WaitlistModal feature={waitlistFeature} onClose={() => setWaitlistFeature(null)} />}
      </AnimatePresence>
    </div>
  );
}
