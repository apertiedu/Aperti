import { useCallback } from "react";

export function useFeatureTrack() {
  const track = useCallback((featureKey: string, category = "general") => {
    const token = localStorage.getItem("aperti_token");
    if (!token || !featureKey) return;
    fetch("/api/feature/track", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ featureKey: featureKey.slice(0, 100), category }),
    }).catch(() => {});
  }, []);

  return track;
}
