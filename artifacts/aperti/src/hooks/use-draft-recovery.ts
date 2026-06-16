import { useEffect, useCallback } from "react";
import React from "react";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

const PREFIX = "aperti_draft_";

export function useDraftRecovery<T>(key: string, value: T, setValue: (v: T) => void) {
  const storageKey = PREFIX + key;
  const { toast } = useToast();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { data: T; ts: number };
        if (parsed?.data && Date.now() - parsed.ts < 7 * 24 * 60 * 60 * 1000) {
          const savedData = parsed.data;
          const savedDate = new Date(parsed.ts).toLocaleString();
          toast({
            title: "Unsaved draft found",
            description: `From ${savedDate}`,
            action: React.createElement(
              ToastAction,
              {
                altText: "Restore",
                onClick: () => { setValue(savedData); localStorage.removeItem(storageKey); },
              },
              "Restore"
            ) as any,
          });
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
