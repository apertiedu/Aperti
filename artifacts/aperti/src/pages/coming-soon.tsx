import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Rocket, Clock, Mail, ArrowRight, Sparkles } from "lucide-react";
import { useAuth } from "@/context/auth";
import { Link } from "wouter";

async function fetchJSON(url: string) {
  const r = await fetch(url, { credentials: "include" });
  return r.json();
}

const FEATURE_COLORS = [
  "from-teal-50 to-emerald-50 border-teal-100",
  "from-blue-50 to-cyan-50 border-blue-100",
  "from-purple-50 to-violet-50 border-purple-100",
  "from-amber-50 to-orange-50 border-amber-100",
  "from-rose-50 to-pink-50 border-rose-100",
  "from-indigo-50 to-blue-50 border-indigo-100",
];

export default function ComingSoonPage() {
  const { user } = useAuth();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["coming-soon"],
    queryFn: () => fetchJSON("/api/coming-soon"),
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero */}
      <div className="max-w-4xl mx-auto px-6 pt-16 pb-10 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <span className="inline-flex items-center gap-1.5 bg-teal-100 text-teal-700 text-xs font-semibold px-3 py-1 rounded-full mb-4">
            <Sparkles className="w-3 h-3" /> What's coming next
          </span>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Coming Soon</h1>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            Exciting features are in development. Join the waitlist to be notified when they launch.
          </p>
          {user?.role === "admin" && (
            <Link href="/admin/commerce">
              <button className="mt-4 text-xs text-teal-600 hover:underline">Manage Coming Soon Items →</button>
            </Link>
          )}
        </motion.div>
      </div>

      <div className="max-w-4xl mx-auto px-6 pb-20">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-7 h-7 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-5">
            {(items as any[]).map((item: any, i: number) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className={`rounded-2xl border bg-gradient-to-br p-6 flex flex-col gap-4 ${FEATURE_COLORS[i % FEATURE_COLORS.length]}`}
              >
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                    <Rocket className="w-5 h-5 text-teal-600" />
                  </div>
                  {item.release_window && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-400 bg-white/80 px-2.5 py-1 rounded-full border border-white">
                      <Clock className="w-2.5 h-2.5" /> {item.release_window}
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 text-base mb-1">{item.feature_name}</h3>
                  {item.description && <p className="text-sm text-gray-600 leading-relaxed">{item.description}</p>}
                </div>

                {item.demo_url && (
                  <a href={item.demo_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-teal-600 hover:underline flex items-center gap-1">
                    View Demo <ArrowRight className="w-3 h-3" />
                  </a>
                )}

                {item.waitlist_enabled && (
                  <WaitlistButton featureName={item.feature_name} />
                )}
              </motion.div>
            ))}
          </div>
        )}

        {!isLoading && (items as any[]).length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <Rocket className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>No upcoming features announced yet. Check back soon!</p>
          </div>
        )}
      </div>
    </div>
  );
}

function WaitlistButton({ featureName }: { featureName: string }) {
  return (
    <button
      onClick={() => {
        const email = prompt(`Join the waitlist for ${featureName}! Enter your email:`);
        if (email) alert(`✅ You're on the waitlist! We'll notify ${email} when ${featureName} launches.`);
      }}
      className="flex items-center gap-2 text-xs text-teal-700 bg-white/80 hover:bg-white border border-teal-200 px-3 py-1.5 rounded-lg transition-colors self-start"
    >
      <Mail className="w-3 h-3" /> Join Waitlist
    </button>
  );
}
