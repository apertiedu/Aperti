/**
 * LiveAnnouncer — screen-reader announcements for dynamic updates.
 *
 * Usage:
 *   1. Mount <LiveAnnouncerProvider> near the root (inside App.tsx).
 *   2. Call useLiveAnnouncer() anywhere to trigger announcements.
 *
 *   const { announce } = useLiveAnnouncer();
 *   announce("3 results found");
 *   announce("Error: form submission failed", "assertive");
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

type Politeness = "polite" | "assertive";

interface LiveAnnouncerContextValue {
  announce: (message: string, politeness?: Politeness) => void;
}

const LiveAnnouncerContext = createContext<LiveAnnouncerContextValue>({
  announce: () => {},
});

export function LiveAnnouncerProvider({ children }: { children: React.ReactNode }) {
  const [politeMessage, setPoliteMessage] = useState("");
  const [assertiveMessage, setAssertiveMessage] = useState("");
  const politeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const assertiveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const announce = useCallback((message: string, politeness: Politeness = "polite") => {
    if (politeness === "assertive") {
      // Clear then re-set so screen readers re-read the same message
      setAssertiveMessage("");
      clearTimeout(assertiveTimer.current);
      assertiveTimer.current = setTimeout(() => setAssertiveMessage(message), 50);
    } else {
      setPoliteMessage("");
      clearTimeout(politeTimer.current);
      politeTimer.current = setTimeout(() => setPoliteMessage(message), 50);
    }
  }, []);

  return (
    <LiveAnnouncerContext.Provider value={{ announce }}>
      {children}
      {/* aria-live regions — visually hidden but read by screen readers */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          padding: 0,
          margin: "-1px",
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        {politeMessage}
      </div>
      <div
        aria-live="assertive"
        aria-atomic="true"
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          padding: 0,
          margin: "-1px",
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        {assertiveMessage}
      </div>
    </LiveAnnouncerContext.Provider>
  );
}

export function useLiveAnnouncer(): LiveAnnouncerContextValue {
  return useContext(LiveAnnouncerContext);
}

/**
 * RouteChangeAnnouncer — announces page title changes when navigating.
 * Mount once inside the router.
 */
export function RouteChangeAnnouncer() {
  const { announce } = useLiveAnnouncer();
  const prevTitle = useRef<string>("");

  // Announce when the document title changes (set by each page)
  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      const title = document.title;
      if (title && title !== prevTitle.current) {
        prevTitle.current = title;
        announce(`Navigated to ${title}`, "polite");
      }
    });

    const titleEl = document.querySelector("title");
    if (titleEl) {
      observer.observe(titleEl, { subtree: true, characterData: true, childList: true });
    }

    return () => observer.disconnect();
  }, [announce]);

  return null;
}
