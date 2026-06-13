import { useCallback, useEffect, useState } from "react";

export interface RecentItem {
  type: string;
  id: string;
  name: string;
  href: string;
  lastViewed: number;
}

const STORAGE_KEY = "aperti_recently_used";
const MAX_ITEMS = 10;

function load(): RecentItem[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function save(items: RecentItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

export function useRecentlyUsed() {
  const [items, setItems] = useState<RecentItem[]>(load);

  useEffect(() => {
    const onStorage = () => setItems(load());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const track = useCallback((item: Omit<RecentItem, "lastViewed">) => {
    setItems(prev => {
      const filtered = prev.filter(r => !(r.type === item.type && r.id === item.id));
      const next = [{ ...item, lastViewed: Date.now() }, ...filtered].slice(0, MAX_ITEMS);
      save(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    save([]);
    setItems([]);
  }, []);

  return { items, track, clear };
}
