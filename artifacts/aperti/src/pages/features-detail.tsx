import { useState, useEffect, useRef } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, CheckCircle2, Clock, TestTube, AlertCircle, Rocket,
  Users, Star, ExternalLink, GitBranch, Calendar, Package, X, ChevronRight,
} from "lucide-react";

const TEAL = "#0D9488";
const TEAL_LIGHT = "#E6F4F1";

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: React.ComponentType<any> }> = {
  released:    { label: "Available",   color: "text-green-700",  bg: "bg-green-50 border-green-200",  icon: CheckCircle2 },
  beta:        { label: "Beta",        color: "text-orange-700", bg: "bg-orange-50 border-orange-200",icon: TestTube },
  coming_soon: { label: "Coming Soon", color: "text-teal-700",   bg: "bg-teal-50 border-teal-200",   icon: Clock },
  scheduled:   { label: "Scheduled",  color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200",icon: Calendar },
  development: { label: "In Dev",     color: "text-blue-700",   bg: "bg-blue-50 border-blue-200",    icon: Package },
  draft:       { label: "Draft",      color: "text-gray-600",   bg: "bg-gray-50 border-gray-200",    icon: Package },
  deprecated:  { label: "Deprecated", color: "text-red-600",    bg: "bg-red-50 border-red-200",      icon: AlertCircle },
};

/* ── Countdown timer ── */
function CountdownTimer({ seconds }: { seconds: number }) {
  const [remaining, setRemaining] = useState(seconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    intervalRef.current = setInterval(() => setRemaining(r => Math.max(0, r - 1)), 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);
  const days    = Math.floor(remaining / 86400);
  const hours   = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const secs    = remaining % 60;
  if (remaining <= 0) return <span className="text-green-600 font-semibold text-sm">Launching now!</span>;
  return (
    <div className="flex items-center gap-2">
      {[{ v: days, l: "days" }, { v: hours, l: "hrs" }, { v: minutes, l: "min" }, { v: secs, l: "sec" }].map(({ v, l }) => (
        <div key={l} className="text-center">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black text-white" style={{ background: TEAL }}>
            {String(v).padStart(2, "0")}
          </div>
          <p className="text-[10px] text-gray-400 mt-1">{l}</p>
        </div>
      ))}
    </div>
  );
}

/* ── Waitlist modal ── */
function WaitlistModal({ featureId, featureName, onClose }: { featureId: number; featureName: string; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [done, setDone] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/features/${featureId}/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => setDone(true),
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", bounce: 0.2 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        {done ? (
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: TEAL_LIGHT }}>
              <CheckCircle2 className="w-7 h-7" style={{ color: TEAL }} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">You're on the list!</h3>
            <p className="text-sm text-gray-500">We'll notify you the moment <strong>{featureName}</strong> is ready for you.</p>
            <button onClick={onClose} className="mt-6 px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: TEAL }}>Done</button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Join the Waitlist</h3>
                <p className="text-sm text-gray-500 mt-0.5">Join the waitlist for <strong>{featureName}</strong></p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Your Name</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  placeholder="Dr. Ahmed Hassan" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email Address *</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  placeholder="you@school.com" />
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={() => mutation.mutate()} disabled={!email || mutation.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
                style={{ background: TEAL }}>
                {mutation.isPending ? "Joining…" : "Join Waitlist"}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ── MAIN PAGE ── */
export default function FeatureDetailPage() {
  const [, params] = useRoute("/features/:id");
  const featureId = Number(params?.id);
  const [showWaitlist, setShowWaitlist] = useState(false);

  const { data: feature, isLoading, isError } = useQuery({
    queryKey: ["public-feature", featureId],
    queryFn: async () => {
      const res = await fetch(`/api/features/${featureId}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!featureId,
  });

  useEffect(() => {
    if (feature?.name) document.title = `${feature.name} — Aperti`;
    return () => { document.title = "Aperti"; };
  }, [feature?.name]);

  const statusMeta = STATUS_META[feature?.status] ?? STATUS_META.draft;
  const StatusIcon = statusMeta.icon;

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Nav */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-bold text-lg text-gray-900">Aperti<span style={{ color: TEAL }}>.</span></Link>
          <div className="flex items-center gap-4">
            <Link href="/features" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">All Features</Link>
            <Link href="/roadmap" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Roadmap</Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-6 py-10">
        {/* Back */}
        <Link href="/features" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" />Back to Features
        </Link>

        {isLoading && (
          <div className="space-y-4 animate-pulse">
            <div className="h-8 bg-gray-200 rounded-xl w-1/3" />
            <div className="h-4 bg-gray-100 rounded-lg w-1/2" />
            <div className="h-32 bg-gray-100 rounded-2xl" />
          </div>
        )}

        {isError && (
          <div className="text-center py-20">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-gray-700 mb-2">Feature not found</h2>
            <Link href="/features" className="text-sm font-semibold" style={{ color: TEAL }}>Browse all features</Link>
          </div>
        )}

        {feature && (
          <div className="space-y-6">
            {/* Hero card */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
              <div className="flex flex-col md:flex-row md:items-start gap-6">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: TEAL_LIGHT }}>
                  <Rocket className="w-7 h-7" style={{ color: TEAL }} />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusMeta.bg} ${statusMeta.color}`}>
                      <StatusIcon className="w-3.5 h-3.5" />{statusMeta.label}
                    </span>
                    {feature.category && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{feature.category}</span>
                    )}
                    {feature.version && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-gray-100 text-gray-500">v{feature.version}</span>
                    )}
                  </div>
                  <h1 className="text-2xl md:text-3xl font-black text-gray-900 mb-3">{feature.name}</h1>
                  <p className="text-gray-500 leading-relaxed">{feature.description || "No description available."}</p>
                  {feature.owner && (
                    <p className="text-sm text-gray-400 mt-3">Owned by <span className="font-medium text-gray-600">{feature.owner}</span></p>
                  )}
                </div>
              </div>

              {/* Countdown */}
              {feature.launch_countdown_seconds != null && feature.launch_countdown_seconds > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <p className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-1.5">
                    <Clock className="w-4 h-4" style={{ color: TEAL }} />Launching in
                  </p>
                  <CountdownTimer seconds={feature.launch_countdown_seconds} />
                </div>
              )}

              {/* Release date */}
              {feature.release_date && feature.status !== "released" && (
                <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                  <Calendar className="w-4 h-4" />
                  Target release: <strong>{new Date(feature.release_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong>
                </div>
              )}

              {/* CTAs */}
              <div className="mt-6 flex flex-wrap gap-3">
                {(feature.status === "coming_soon" || feature.status === "scheduled") && (
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => setShowWaitlist(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                    style={{ background: TEAL }}>
                    <Users className="w-4 h-4" />Join Waitlist
                    {feature.waitlist_count > 0 && <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded text-xs">{feature.waitlist_count}</span>}
                  </motion.button>
                )}
                {feature.status === "beta" && (
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => setShowWaitlist(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                    style={{ background: "#EA580C" }}>
                    <TestTube className="w-4 h-4" />Apply for Beta
                    {feature.beta_count > 0 && <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded text-xs">{feature.beta_count} testers</span>}
                  </motion.button>
                )}
                {feature.documentation_url && (
                  <a href={feature.documentation_url} target="_blank" rel="noopener noreferrer">
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 bg-white hover:border-gray-300 transition-colors">
                      <ExternalLink className="w-4 h-4" />Documentation
                    </motion.button>
                  </a>
                )}
                {feature.status === "released" && (
                  <Link href="/login">
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                      style={{ background: TEAL }}>
                      <CheckCircle2 className="w-4 h-4" />Use This Feature
                    </motion.button>
                  </Link>
                )}
              </div>
            </motion.div>

            {/* Stats */}
            {(feature.waitlist_count > 0 || feature.beta_count > 0) && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="grid grid-cols-2 gap-4">
                {feature.waitlist_count > 0 && (
                  <div className="bg-white rounded-xl border border-gray-100 p-5 text-center shadow-sm">
                    <Users className="w-5 h-5 mx-auto mb-2" style={{ color: TEAL }} />
                    <p className="text-2xl font-black text-gray-900">{feature.waitlist_count}</p>
                    <p className="text-xs text-gray-500 mt-1">on the waitlist</p>
                  </div>
                )}
                {feature.beta_count > 0 && (
                  <div className="bg-white rounded-xl border border-gray-100 p-5 text-center shadow-sm">
                    <TestTube className="w-5 h-5 mx-auto mb-2 text-orange-500" />
                    <p className="text-2xl font-black text-gray-900">{feature.beta_count}</p>
                    <p className="text-xs text-gray-500 mt-1">beta testers</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Dependencies */}
            {feature.dependencies && feature.dependencies.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <GitBranch className="w-4 h-4" style={{ color: TEAL }} />Dependencies
                </h2>
                <div className="space-y-2">
                  {feature.dependencies.map((dep: any) => {
                    const depMeta = STATUS_META[dep.status] ?? STATUS_META.draft;
                    const DepIcon = depMeta.icon;
                    return (
                      <Link key={dep.id} href={`/features/${dep.id}`}>
                        <motion.div whileHover={{ x: 4 }}
                          className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer border border-transparent hover:border-gray-100">
                          <DepIcon className={`w-4 h-4 ${depMeta.color}`} />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-800">{dep.name}</p>
                            {dep.category && <p className="text-xs text-gray-400">{dep.category}</p>}
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${depMeta.bg} ${depMeta.color}`}>
                            {depMeta.label}
                          </span>
                          <ChevronRight className="w-4 h-4 text-gray-300" />
                        </motion.div>
                      </Link>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Browse more */}
            <div className="text-center py-4">
              <Link href="/features" className="inline-flex items-center gap-1.5 text-sm font-semibold hover:opacity-80 transition-opacity" style={{ color: TEAL }}>
                <Star className="w-4 h-4" />Browse all features
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Waitlist modal */}
      <AnimatePresence>
        {showWaitlist && feature && (
          <WaitlistModal featureId={feature.id} featureName={feature.name} onClose={() => setShowWaitlist(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
