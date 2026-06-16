import { useState, useCallback } from "react";

export type UIState = "idle" | "loading" | "success" | "error";

export interface UseSafeUIReturn<T> {
  state: UIState;
  data: T | null;
  error: string | null;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  run: (fn: () => Promise<T>) => Promise<T | null>;
  reset: () => void;
}

export function useSafeUI<T = unknown>(opts: {
  onSuccess?: (data: T) => void;
  onError?: (err: string) => void;
} = {}): UseSafeUIReturn<T> {
  const [state, setState] = useState<UIState>("idle");
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (fn: () => Promise<T>): Promise<T | null> => {
      setState("loading");
      setError(null);
      try {
        const result = await fn();
        setData(result);
        setState("success");
        opts.onSuccess?.(result);
        return result;
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : "An unexpected error occurred. Please try again.";
        setError(msg);
        setState("error");
        opts.onError?.(msg);
        return null;
      }
    },
    [opts],
  );

  const reset = useCallback(() => {
    setState("idle");
    setData(null);
    setError(null);
  }, []);

  return {
    state,
    data,
    error,
    isLoading: state === "loading",
    isError: state === "error",
    isSuccess: state === "success",
    run,
    reset,
  };
}

export function extractErrorMessage(response: unknown): string {
  if (!response || typeof response !== "object") return "Unexpected error";
  const r = response as Record<string, unknown>;
  if (r.status === "degraded") return "System is temporarily in safe mode. Please try again.";
  if (typeof r.message === "string") return r.message;
  if (typeof r.error === "string") return r.error;
  return "Something went wrong. Please try again.";
}
