/**
 * useApi — typed imperative API hook for Aperti
 *
 * Wraps the low-level api.ts primitives (fetchJSON, postJSON, putJSON,
 * patchJSON, deleteJSON) in React state so components get consistent
 * loading / error / data lifecycle without TanStack Query overhead.
 *
 * Use TanStack Query (useQuery / useMutation) for data that belongs in
 * the query cache. Use useApi for one-shot imperative calls (e.g. form
 * submissions, file uploads, triggered side-effects).
 *
 * Usage:
 *   const { data, loading, error, execute } = useApi<MyType>("/api/things");
 *   // trigger manually:
 *   await execute();
 *
 *   const { loading, error, execute } = useApiMutation<In, Out>("/api/things", "POST");
 *   await execute({ name: "value" });
 */
import { useState, useCallback, useRef } from "react";
import { fetchJSON, postJSON, putJSON, patchJSON, deleteJSON, ApiError } from "@/lib/api";

export type ApiStatus = "idle" | "loading" | "success" | "error";

export interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  status: ApiStatus;
  execute: () => Promise<T | null>;
  reset: () => void;
}

export function useApi<T>(url: string): UseApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ApiStatus>("idle");
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setStatus("idle");
    setLoading(false);
  }, []);

  const execute = useCallback(async (): Promise<T | null> => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);
    setStatus("loading");

    try {
      const result = await fetchJSON<T>(url);
      setData(result);
      setStatus("success");
      return result;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return null;
      const msg =
        err instanceof ApiError ? err.message :
        err instanceof Error   ? err.message :
        "An unexpected error occurred";
      setError(msg);
      setStatus("error");
      return null;
    } finally {
      setLoading(false);
    }
  }, [url]);

  return { data, loading, error, status, execute, reset };
}

export interface UseApiMutationState<TBody, TResult> {
  data: TResult | null;
  loading: boolean;
  error: string | null;
  status: ApiStatus;
  execute: (body?: TBody) => Promise<TResult | null>;
  reset: () => void;
}

type HttpMethod = "POST" | "PUT" | "PATCH" | "DELETE";

const methodFn: Record<HttpMethod, (url: string, body?: unknown) => Promise<unknown>> = {
  POST:   (url, body) => postJSON(url, body),
  PUT:    (url, body) => putJSON(url, body),
  PATCH:  (url, body) => patchJSON(url, body),
  DELETE: (url)       => deleteJSON(url),
};

export function useApiMutation<TBody = unknown, TResult = unknown>(
  url: string,
  method: HttpMethod = "POST",
): UseApiMutationState<TBody, TResult> {
  const [data, setData] = useState<TResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ApiStatus>("idle");

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setStatus("idle");
    setLoading(false);
  }, []);

  const execute = useCallback(async (body?: TBody): Promise<TResult | null> => {
    setLoading(true);
    setError(null);
    setStatus("loading");

    try {
      const fn = methodFn[method];
      const result = (await fn(url, body)) as TResult;
      setData(result);
      setStatus("success");
      return result;
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError ? err.message :
        err instanceof Error   ? err.message :
        "An unexpected error occurred";
      setError(msg);
      setStatus("error");
      return null;
    } finally {
      setLoading(false);
    }
  }, [url, method]);

  return { data, loading, error, status, execute, reset };
}
