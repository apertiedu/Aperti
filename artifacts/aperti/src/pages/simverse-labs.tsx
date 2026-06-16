import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  FlaskConical, Zap, Atom, Leaf, Calculator, Waves, Droplets,
  Dna, ChevronRight, Play, BookOpen, Star, Clock, Filter, Search,
  ExternalLink, X, Plus, Settings,
} from "lucide-react";

const API = "/api";
async function fetchJSON(url: string, opts?: RequestInit) {
  const res = await fetch(`${API}${url}`, {
    headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) },
    ...opts,
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const LAB_ICONS: Record<string, any> = {
  "forge-field": Zap, "react-sphere": Atom, "biosphere": Leaf, "geometrix": Calculator,
  "circuit-builder": Zap, "wave-lab": Waves, "titration": Droplets, "genetics": Dna,
};
const CATEGORY_COLORS: Record<string, string> = {
  Physics: "bg-blue-100 text-blue-700 border-blue-200",
  Chemistry: "bg-green-100 text-green-700 border-green-200",
  Biology: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Mathematics: "bg-purple-100 text-purple-700 border-purple-200",
};
const DIFF_COLORS: Record<string, string> = { easy: "bg-green-100 text-green-700", medium: "bg-amber-100 text-amber-700", hard: "bg-red-100 text-red-700" };

function LabCard({ lab, onLaunch }: { lab: any; onLaunch: (lab: any) => void }) {
  const Icon = LAB_ICONS[lab.id] || FlaskConical;
  return (
    <motion.div layout whileHover={{ y: -3 }} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
      className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/25 hover:shadow-md transition-all cursor-pointer group"
      onClick={() => onLaunch(lab)}>
      <div className={`h-2 ${lab.category === "Physics" ? "bg-gradient-to-r from-blue-400 to-blue-600" : lab.category === "Chemistry" ? "bg-gradient-to-r from-green-400 to-primary/80" : lab.category === "Biology" ? "bg-gradient-to-r from-emerald-400 to-green-500" : "bg-gradient-to-r from-purple-400 to-indigo-500"}`} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${CATEGORY_COLORS[lab.category] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
            <Icon size={22} />
          </div>
          <Badge className={`text-xs ${DIFF_COLORS[lab.difficulty] || "bg-gray-100 text-gray-600"}`}>{lab.difficulty}</Badge>
        </div>
        <h3 className="font-bold text-gray-800 mb-1">{lab.name}</h3>
        <p className="text-xs text-gray-500 leading-relaxed mb-4">{lab.description}</p>
        <div className="flex items-center justify-between">
          <Badge className={`text-xs ${CATEGORY_COLORS[lab.category] || "bg-gray-100 text-gray-600"}`}>{lab.category}</Badge>
          <Button size="sm" className="h-7 text-xs bg-primary hover:bg-primary/80 text-white opacity-0 group-hover:opacity-100 transition-opacity">
            <Play size={11} className="mr-1" /> Launch
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function SimulationRunner({ lab, onClose }: { lab: any; onClose: () => void }) {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  const [conclusion, setConclusion] = useState("");

  const startSession = useMutation({
    mutationFn: () => fetchJSON(`/simverse/labs/${lab.id}/sessions`, { method: "POST", body: JSON.stringify({ config: {} }) }),
    onSuccess: (data) => { setSessionId(data.id); setStarted(true); },
  });

  const endSession = useMutation({
    mutationFn: () => fetchJSON(`/simverse/sessions/${sessionId}`, { method: "PUT", body: JSON.stringify({ conclusion, actions: [] }) }),
    onSuccess: onClose,
  });

  const Icon = LAB_ICONS[lab.id] || FlaskConical;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
      <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92 }}
        className="bg-card rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${CATEGORY_COLORS[lab.category] || "bg-gray-100 text-gray-600"}`}><Icon size={18} /></div>
            <div>
              <h2 className="font-bold text-gray-800">{lab.name}</h2>
              <p className="text-xs text-gray-500">{lab.category} · {lab.difficulty}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X size={18} /></Button>
        </div>
        <div className="p-6 space-y-5">
          {!started ? (
            <>
              <p className="text-sm text-gray-600 leading-relaxed">{lab.description}</p>
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">Available Tools</p>
                <div className="flex flex-wrap gap-2">
                  {(lab.tools || []).map((t: string) => (
                    <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                  ))}
                </div>
              </div>
              <div className="bg-gradient-to-r from-primary to-blue-50 border border-primary/25 rounded-xl p-4 space-y-2">
                <p className="text-sm font-semibold text-foreground">Simulation Environment</p>
                <p className="text-xs text-primary">This interactive lab will open a guided simulation session. Complete observations and submit your conclusion.</p>
              </div>
              <Button onClick={() => startSession.mutate()} disabled={startSession.isPending} className="w-full bg-primary hover:bg-primary/80 text-white h-12">
                <Play size={16} className="mr-2" /> {startSession.isPending ? "Starting..." : "Start Lab Session"}
              </Button>
            </>
          ) : (
            <>
              <div className="bg-gray-900 rounded-xl h-72 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 10, repeat: Infinity, ease: "linear" }} className="w-64 h-64 border-4 border-primary/60 rounded-full absolute top-4 left-4" />
                  <motion.div animate={{ rotate: -360 }} transition={{ duration: 7, repeat: Infinity, ease: "linear" }} className="w-40 h-40 border-2 border-blue-400 rounded-full absolute bottom-8 right-8" />
                </div>
                <div className="text-center text-white z-10">
                  <Icon size={48} className="mx-auto mb-3 opacity-80" />
                  <p className="text-lg font-bold">{lab.name}</p>
                  <p className="text-sm text-gray-400 mt-1">Interactive simulation active</p>
                  <div className="flex gap-2 justify-center mt-4 flex-wrap">
                    {(lab.tools || []).map((t: string) => (
                      <button key={t} className="px-3 py-1 bg-primary/80 hover:bg-primary text-xs text-white rounded-lg transition-colors">{t}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-2 block">Your Observations & Conclusion</label>
                <textarea value={conclusion} onChange={e => setConclusion(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:ring-2 focus:ring-primary/30 focus:border-transparent"
                  rows={4} placeholder="Record your observations and write your conclusion here..." />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={onClose} className="flex-1">Save & Continue Later</Button>
                <Button onClick={() => endSession.mutate()} disabled={endSession.isPending || !conclusion.trim()} className="flex-1 bg-primary hover:bg-primary/80 text-white">
                  {endSession.isPending ? "Submitting..." : "Submit Lab Report"}
                </Button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function SimverseLabs() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [activeLab, setActiveLab] = useState<any>(null);

  const { data: labs, isLoading } = useQuery({
    queryKey: ["simverse-labs"],
    queryFn: () => fetchJSON("/simverse/labs"),
  });

  const categories = ["all", "Physics", "Chemistry", "Biology", "Mathematics"];
  const filtered = (labs || []).filter((lab: any) => {
    const matchSearch = !search || lab.name.toLowerCase().includes(search.toLowerCase()) || lab.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "all" || lab.category === category;
    return matchSearch && matchCat;
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3"><FlaskConical className="text-primary" size={28} /> SimVerse Labs</h1>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate("/simverse/geometrix")}><Calculator size={14} className="mr-1" /> Geometrix</Button>
            </div>
          </div>
          <p className="text-gray-500">Interactive simulations across Physics, Chemistry, Biology and Mathematics</p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Physics Labs", count: (labs || []).filter((l: any) => l.category === "Physics").length, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Chemistry Labs", count: (labs || []).filter((l: any) => l.category === "Chemistry").length, color: "text-green-600", bg: "bg-green-50" },
            { label: "Biology Labs", count: (labs || []).filter((l: any) => l.category === "Biology").length, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Maths Labs", count: (labs || []).filter((l: any) => l.category === "Mathematics").length, color: "text-purple-600", bg: "bg-purple-50" },
          ].map((s, i) => (
            <Card key={i} className="bg-card border-0 shadow-sm">
              <CardContent className={`pt-5 pb-4 ${s.bg} rounded-xl`}>
                <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                <p className={`text-3xl font-bold ${s.color}`}>{s.count}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search labs..." className="pl-9 bg-card" />
          </div>
          <div className="flex gap-2">
            {categories.map(c => (
              <button key={c} onClick={() => setCategory(c)}
                className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all ${category === c ? "bg-primary text-white border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/40"}`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Labs grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-52 rounded-2xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <FlaskConical size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No labs match your search</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <AnimatePresence>
              {filtered.map((lab: any) => (
                <LabCard key={lab.id} lab={lab} onLaunch={setActiveLab} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <AnimatePresence>
        {activeLab && <SimulationRunner lab={activeLab} onClose={() => setActiveLab(null)} />}
      </AnimatePresence>
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}
