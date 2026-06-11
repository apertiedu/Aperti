import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Sparkles, ChevronRight, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api";

interface NextItem {
  type: string;
  icon: string;
  title: string;
  subtitle: string;
  href: string;
  priority: number;
}

const TEAL = "#0D9488";

export default function WhatNextCard() {
  const { data, isLoading } = useQuery<{ items: NextItem[] }>({
    queryKey: ["student-what-next"],
    queryFn: () => apiFetch("/api/student/what-next").then(r => r.ok ? r.json() : { items: [] }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
        <div className="h-4 w-28 bg-slate-100 rounded animate-pulse mb-3" />
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-slate-50 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  const items = data?.items ?? [];
  if (!items.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="bg-white rounded-2xl border border-border p-5 shadow-sm"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" style={{ color: TEAL }} />
          <h3 className="text-sm font-bold text-foreground">What to do next</h3>
        </div>
        <span className="text-[10px] text-muted-foreground">{items.length} items</span>
      </div>

      <div className="space-y-2">
        {items.map((item, i) => (
          <Link key={i} href={item.href}>
            <motion.div
              whileHover={{ scale: 1.01, x: 2 }}
              transition={{ duration: 0.12 }}
              className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-teal-50 border border-transparent hover:border-teal-100 cursor-pointer transition-all group"
            >
              <span className="text-lg leading-none flex-shrink-0">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
                <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-teal-500 transition-colors flex-shrink-0" />
            </motion.div>
          </Link>
        ))}
      </div>
    </motion.div>
  );
}
