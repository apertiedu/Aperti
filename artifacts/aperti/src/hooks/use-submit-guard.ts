import { useRef, useState, useCallback } from "react";

export function useSubmitGuard<T = void>(
  fn: (args: T) => Promise<any>,
  opts?: { onError?: (e: Error) => void }
) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inFlightRef = useRef(false);

  const submit = useCallback(async (args: T) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsSubmitting(true);
    try {
      await fn(args);
    } catch (e) {
      opts?.onError?.(e as Error);
    } finally {
      inFlightRef.current = false;
      setIsSubmitting(false);
    }
  }, [fn, opts]);

  return { isSubmitting, submit };
}
