import { useEffect, useCallback } from "react";

const PREFIX = "aperti_draft_";

export function useDraftRecovery<T>(key: string, value: T, setValue: (v: T) => void) {
  const storageKey = PREFIX + key;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { data: T; ts: number };
        if (parsed?.data && Date.now() - parsed.ts < 7 * 24 * 60 * 60 * 1000) {
          const confirmed = confirm(
            `You have an unsaved draft from ${new Date(parsed.ts).toLocaleString()}. Would you like to restore it?`
          );
          if (confirmed) setValue(parsed.data);
          else localStorage.removeItem(storageKey);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const serialized = JSON.stringify(value);
      if (serialized === "{}" || serialized === "[]" || serialized === "null" || serialized === '""') return;
      localStorage.setItem(storageKey, JSON.stringify({ data: value, ts: Date.now() }));
    } catch {}
  }, [value, storageKey]);

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(storageKey); } catch {}
  }, [storageKey]);

  return { clearDraft };
}
