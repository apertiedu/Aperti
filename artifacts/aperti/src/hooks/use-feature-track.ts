import { useCallback } from "react";

export function useFeatureTrack() {
  const track = useCallback((featureKey: string, category = "general") => {
    if (!featureKey) return;
    fetch("/api/feature/track", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featureKey: featureKey.slice(0, 100), category }),
    }).catch(() => {});
  }, []);

  return track;
}
