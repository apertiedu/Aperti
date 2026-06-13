import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lightbulb, AlertTriangle, Search, BookOpen, TrendingUp, CheckCircle2, Star } from "lucide-react";

const API = "/api";
async function apiFetch(url: string) {
  const res = await fetch(`${API}${url}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const EXAMINER_TIPS: Record<string, any[]> = {
  mathematics: [
    { year: "2023", topic: "Integration", type: "Common Mistake", tip: "Students frequently forget the constant of integration (+C) when integrating indefinitely. This costs a mark in virtually every question." },
    { year: "2023", topic: "Vectors", type: "Examiner Advice", tip: "Many candidates cannot distinguish between a position vector and a direction vector. Always clarify which is being asked for." },
    { year: "2022", topic: "Statistics", type: "Common Mistake", tip: "Probability answers outside [0,1] are still common. Remind students to check their final answer is valid." },
    { year: "2022", topic: "Calculus", type: "High Performance", tip: "Top candidates consistently show all working clearly. Even where a final answer is incorrect, method marks are awarded." },
  ],
  physics: [
    { year: "2023", topic: "Waves", type: "Common Mistake", tip: "Candidates confuse transverse and longitudinal waves. Many cannot correctly describe the oscillation of particles in longitudinal waves." },
    { year: "2023", topic: "Electricity", type: "Examiner Advice", tip: "Show every formula used and every substitution. Calculation errors lose one mark, but errors in formula selection lose all marks." },
    { year: "2022", topic: "Mechanics", type: "High Performance", tip: "Strong candidates always define the positive direction and stick to it throughout a problem." },
  ],
  chemistry: [
    { year: "2023", topic: "Organic Chemistry", type: "Common Mistake", tip: "Functional group identification errors are common. Many candidates write 'alcohol' when the compound is a phenol." },
    { year: "2023", topic: "Electrochemistry", type: "Examiner Advice", tip: "Half-equations must be balanced for both charge and atoms. One of the most common sources of lost marks." },
    { year: "2022", topic: "Equilibrium", type: "High Performance", tip: "Top answers clearly justify the direction of equilibrium shift using Le Chatelier's principle with reference to concentration/pressure/temperature." },
  ],
  biology: [
    { year: "2023", topic: "Cell Biology", type: "Common Mistake", tip: "Students mix up the roles of rough and smooth ER. The distinction is often worth 1-2 marks." },
    { year: "2023", topic: "Genetics", type: "Examiner Advice", tip: "Punnett squares must show the parental genotypes, gametes AND the offspring cross. Missing any step loses marks." },
    { year: "2022", topic: "Ecology", type: "High Performance", tip: "Top candidates explain population dynamics in terms of carrying capacity and named biotic/abiotic factors." },
  ],
};

const TYPE_COLORS: Record<string, string> = {
  "Common Mistake": "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  "Examiner Advice": "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  "High Performance": "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
};
const TYPE_ICONS: Record<string, React.ReactNode> = {
  "Common Mistake": <AlertTriangle className="h-4 w-4" />,
  "Examiner Advice": <Lightbulb className="h-4 w-4" />,
  "High Performance": <Star className="h-4 w-4" />,
};

export default function MarkerMind() {
  const [subject, setSubject] = useState("mathematics");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: subjects } = useQuery<any[]>({
    queryKey: ["subjects"],
    queryFn: () => apiFetch("/subjects"),
  });

  const subjectList: any[] = Array.isArray(subjects) ? subjects : [];
  const tips = EXAMINER_TIPS[subject] ?? [];

  const filtered = tips.filter(t => {
    const matchSearch = !search || t.tip.toLowerCase().includes(search.toLowerCase()) || t.topic.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || t.type === typeFilter;
    return matchSearch && matchType;
  });

  const counts = {
    mistakes: tips.filter(t => t.type === "Common Mistake").length,
    advice: tips.filter(t => t.type === "Examiner Advice").length,
    high: tips.filter(t => t.type === "High Performance").length,
  };

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
            <Lightbulb className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">MarkerMind™</h1>
        </div>
        <p className="text-muted-foreground text-sm ml-12">Examiner insights and marking intelligence from past reports.</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Common Mistakes", count: counts.mistakes, icon: <AlertTriangle className="h-4 w-4 text-red-500" />, color: "text-red-600" },
          { label: "Examiner Advice", count: counts.advice, icon: <Lightbulb className="h-4 w-4 text-blue-500" />, color: "text-blue-600" },
          { label: "High Performance", count: counts.high, icon: <Star className="h-4 w-4 text-emerald-500" />, color: "text-emerald-600" },
        ].map((s, i) => (
          <Card key={i}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">{s.icon}</div>
              <div>
                <p className={`text-xl font-bold ${s.color}`}>{s.count}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="p-3 flex flex-wrap gap-3 items-center">
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(EXAMINER_TIPS).map(s => (
                <SelectItem key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
              ))}
              {subjectList.map((s: any) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="Common Mistake">Common Mistakes</SelectItem>
              <SelectItem value="Examiner Advice">Examiner Advice</SelectItem>
              <SelectItem value="High Performance">High Performance</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1 min-w-40">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search tips…"
              className="pl-8 h-8 text-xs"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tips */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No tips found</p>
              <p className="text-sm mt-1">Try a different subject or search term.</p>
            </CardContent>
          </Card>
        ) : (
          filtered.map((t, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="card-hover">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${TYPE_COLORS[t.type]}`}>
                      {TYPE_ICONS[t.type]}
                      {t.type}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge variant="outline" className="text-xs">{t.topic}</Badge>
                        <span className="text-xs text-muted-foreground">{t.year}</span>
                      </div>
                      <p className="text-sm leading-relaxed">{t.tip}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      <div className="mt-8 p-4 rounded-xl border bg-muted/30 text-center">
        <p className="text-sm font-medium mb-1">Want tips from your own uploaded examiner reports?</p>
        <p className="text-xs text-muted-foreground">Upload past paper examiner reports and AI will extract insights automatically. Coming in Phase 3.</p>
      </div>
    </div>
  );
}
