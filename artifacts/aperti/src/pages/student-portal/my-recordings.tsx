import { apiFetch } from "@/lib/api";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Video, ExternalLink, Lock, Users, Unlock, Copy, Check, Search } from "lucide-react";
import { format } from "date-fns";

type Recording = {
  id: number;
  title: string;
  description: string | null;
  url: string;
  passcode: string | null;
  platform: string;
  accessType: string;
  duration: string | null;
  recordedAt: string | null;
  createdAt: string;
  subjectName: string | null;
  viewCount: number;
};

const PLATFORM_COLORS: Record<string, string> = {
  zoom: "text-blue-600 bg-blue-50",
  meet: "text-green-600 bg-green-50",
  teams: "text-indigo-600 bg-indigo-50",
  other: "text-gray-500 bg-gray-50",
};

const PLATFORM_LABELS: Record<string, string> = {
  zoom: "Zoom", meet: "Google Meet", teams: "MS Teams", other: "Recording",
};

const PLATFORMS = ["all", "zoom", "meet", "teams", "other"] as const;
type PlatformFilter = typeof PLATFORMS[number];

export default function MyRecordings() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    apiFetch("/api/portal/recordings", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(setRecordings)
      .catch(() => setRecordings([]))
      .finally(() => setLoading(false));
  }, []);

  const handleCopy = async (rec: Recording) => {
    const text = rec.passcode ? `${rec.url}\nPasscode: ${rec.passcode}` : rec.url;
    await navigator.clipboard.writeText(text);
    setCopiedId(rec.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = recordings.filter(r => {
    const matchSearch = !search || r.title.toLowerCase().includes(search.toLowerCase()) || (r.subjectName?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchPlatform = platformFilter === "all" || r.platform === platformFilter;
    return matchSearch && matchPlatform;
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-white/80 animate-pulse rounded-2xl w-48" />
        {[...Array(3)].map((_, i) => <div key={i} className="h-28 bg-white/80 animate-pulse rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
          <Video className="h-6 w-6 text-indigo-500" />Session Recordings
        </h1>
        <p className="text-gray-500 text-sm mt-1">Access past lesson recordings shared by your teacher.</p>
      </motion.div>

      {recordings.length > 0 && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-4 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search recordings..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-card rounded-2xl border border-indigo-100 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {PLATFORMS.map(p => {
              const labels: Record<string, string> = { all: "All", zoom: "Zoom", meet: "Meet", teams: "Teams", other: "Other" };
              const count = p === "all" ? recordings.length : recordings.filter(r => r.platform === p).length;
              if (p !== "all" && count === 0) return null;
              return (
                <button
                  key={p}
                  onClick={() => setPlatformFilter(p)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all border ${
                    platformFilter === p
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : "bg-card text-muted-foreground border-border hover:border-indigo-200"
                  }`}
                >
                  {labels[p]} {count > 0 && <span className="opacity-60 ml-0.5">({count})</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-card rounded-2xl p-12 text-center shadow-sm border border-indigo-50">
          <Video className="h-12 w-12 text-indigo-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">{search ? "No matching recordings" : "No recordings available"}</p>
          <p className="text-gray-300 text-sm mt-1">Your teacher will share lesson recordings here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((rec, i) => {
            const platColor = PLATFORM_COLORS[rec.platform] ?? PLATFORM_COLORS.other;
            const platLabel = PLATFORM_LABELS[rec.platform] ?? "Recording";
            return (
              <motion.div key={rec.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                className="bg-card rounded-2xl p-4 shadow-sm border border-indigo-50 hover:border-indigo-200 transition-colors">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl ${platColor} flex items-center justify-center flex-shrink-0`}>
                    <Video className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 truncate">{rec.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${platColor}`}>{platLabel}</span>
                          {rec.subjectName && <span className="text-xs text-gray-400">{rec.subjectName}</span>}
                          {rec.duration && <span className="text-xs text-gray-400">⏱ {rec.duration}</span>}
                          {rec.accessType === "paid" && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 font-semibold flex items-center gap-1">
                              <Lock className="h-2.5 w-2.5" />Paid
                            </span>
                          )}
                        </div>
                        {rec.description && <p className="text-xs text-gray-500 mt-1">{rec.description}</p>}
                        <p className="text-[10px] text-gray-400 mt-1.5">
                          {rec.recordedAt ? format(new Date(rec.recordedAt), "dd MMM yyyy") : format(new Date(rec.createdAt), "dd MMM yyyy")}
                        </p>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleCopy(rec)}
                          className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-indigo-50 flex items-center justify-center transition-colors text-gray-400 hover:text-indigo-500"
                          title="Copy link"
                        >
                          {copiedId === rec.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                        <a
                          href={rec.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center transition-colors text-white"
                          title="Open recording"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                    {rec.passcode && (
                      <div className="mt-2 px-3 py-1.5 bg-amber-50 rounded-xl text-xs text-amber-700 flex items-center gap-1.5">
                        <Lock className="h-3 w-3" />
                        Passcode: <span className="font-mono font-bold">{rec.passcode}</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
