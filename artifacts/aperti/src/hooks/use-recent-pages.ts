import { useState, useEffect, useCallback } from "react";

export interface RecentPage {
  href: string;
  label: string;
  visitedAt: number;
}

const KEY = "aperti_recent_pages";
const MAX = 5;

export function useRecentPages() {
  const [recent, setRecent] = useState<RecentPage[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? "[]");
    } catch {
      return [];
    }
  });

  const push = useCallback((href: string, label: string) => {
    setRecent(prev => {
      const filtered = prev.filter(p => p.href !== href);
      const next = [{ href, label, visitedAt: Date.now() }, ...filtered].slice(0, MAX);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setRecent([]);
    try { localStorage.removeItem(KEY); } catch {}
  }, []);

  return { recent, push, clear };
}
