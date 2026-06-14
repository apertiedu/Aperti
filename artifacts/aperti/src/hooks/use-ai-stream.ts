/**
 * useAIStream — React hook for Server-Sent Events AI streaming
 *
 * Usage:
 *   const { text, isStreaming, error, stream, abort, reset } = useAIStream();
 *   await stream("/api/ai/chat", { message: "Explain photosynthesis" });
 *
 * The `text` state accumulates progressively as chunks arrive.
 * Call `reset()` to clear state before a new question.
 * Call `abort()` to cancel an in-flight stream.
 */
import { useState, useRef, useCallback } from "react";

export interface UseAIStreamReturn {
  text: string;
  isStreaming: boolean;
  error: string | null;
  stream: (endpoint: string, body: object) => Promise<void>;
  abort: () => void;
  reset: () => void;
}

export function useAIStream(): UseAIStreamReturn {
  const [text, setText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setText("");
    setError(null);
    setIsStreaming(false);
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const stream = useCallback(async (endpoint: string, body: object): Promise<void> => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setIsStreaming(true);
    setText("");
    setError(null);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => `HTTP ${res.status}`);
        throw new Error(errText || `HTTP ${res.status}`);
      }

      const contentType = res.headers.get("content-type") ?? "";

      if (contentType.includes("text/event-stream")) {
        const reader = res.body?.getReader();
        if (!reader) throw new Error("No readable stream in response");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (!raw || raw === "[DONE]") continue;

            try {
              const chunk = JSON.parse(raw) as { text?: string; done?: boolean; error?: string };
              if (chunk.error) throw new Error(chunk.error);
              if (chunk.text) setText(prev => prev + chunk.text);
              if (chunk.done) return;
            } catch (parseErr) {
              // Ignore malformed SSE chunks — keep reading
            }
          }
        }
      } else {
        // Non-streaming fallback — just parse JSON and set text
        const data = await res.json() as { result?: string; text?: string; error?: string };
        if (data.error) throw new Error(data.error);
        setText(data.result ?? data.text ?? "");
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "AI request failed";
      setError(msg);
    } finally {
      setIsStreaming(false);
    }
  }, []);

  return { text, isStreaming, error, stream, abort, reset };
}
