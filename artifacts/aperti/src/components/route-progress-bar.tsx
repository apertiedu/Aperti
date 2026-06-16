import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

export function RouteProgressBar() {
  const [location] = useLocation();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevLocation = useRef(location);

  useEffect(() => {
    if (location === prevLocation.current) return;
    prevLocation.current = location;

    if (timerRef.current) clearInterval(timerRef.current);
    if (completeRef.current) clearTimeout(completeRef.current);

    setVisible(true);
    setProgress(5);

    let current = 5;
    timerRef.current = setInterval(() => {
      current = current >= 80 ? current + 1 : current + Math.random() * 12;
      if (current >= 90) {
        clearInterval(timerRef.current!);
        current = 90;
      }
      setProgress(current);
    }, 120);

    completeRef.current = setTimeout(() => {
      if (timerRef.current) clearInterval(timerRef.current);
      setProgress(100);
      setTimeout(() => setVisible(false), 280);
    }, 600);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (completeRef.current) clearTimeout(completeRef.current);
    };
  }, [location]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 z-[9999] h-[2.5px] transition-all"
      style={{
        width: `${progress}%`,
        background: "linear-gradient(90deg, hsl(var(--primary)), #14b8a6, hsl(var(--primary)))",
        backgroundSize: "200% 100%",
        animation: "shimmer-sweep 1.2s linear infinite",
        opacity: progress >= 100 ? 0 : 1,
        transition: "width 180ms ease, opacity 280ms ease",
        boxShadow: "0 0 8px hsl(var(--primary) / 0.6), 0 0 2px hsl(var(--primary) / 0.4)",
      }}
    />
  );
}
