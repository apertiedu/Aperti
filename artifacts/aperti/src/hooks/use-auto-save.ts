import { useEffect, useRef, useState, useCallback } from "react";
import { authFetch } from "@/lib/api-utils";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface UseAutoSaveOptions<T> {
  url: string;
  data: T;
  method?: "POST" | "PUT" | "PATCH";
  debounceMs?: number;
  enabled?: boolean;
  onSaved?: () => void;
  onError?: (err: Error) => void;
}

export function useAutoSave<T>({
  url,
  data,
  method = "PATCH",
  debounceMs = 5000,
  enabled = true,
  onSaved,
  onError,
}: UseAutoSaveOptions<T>) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const prevDataRef = useRef<string>("");

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const save = useCallback(async (payload: T) => {
    if (!enabled) return;
    setStatus("saving");
    try {
      const res = await authFetch(url, {
        method,
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (mountedRef.current) { setStatus("saved"); onSaved?.(); }
      setTimeout(() => { if (mountedRef.current) setStatus("idle"); }, 2000);
    } catch (err) {
      if (mountedRef.current) {
        setStatus("error");
        onError?.(err as Error);
      }
    }
  }, [url, method, enabled, onSaved, onError]);

  useEffect(() => {
    if (!enabled) return;
    const serialized = JSON.stringify(data);
    if (serialized === prevDataRef.current) return;
    prevDataRef.current = serialized;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { save(data); }, debounceMs);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [data, debounceMs, enabled, save]);

  const saveNow = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    save(data);
  }, [data, save]);

  return { status, saveNow };
}

export function useUnsavedChanges(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);
}
