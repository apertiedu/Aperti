import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

export const EASE_SMOOTH = [0.22, 1, 0.36, 1] as const;
export const DURATION_FAST = 0.15;
export const DURATION_BASE = 0.2;

export const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION_BASE, ease: EASE_SMOOTH } },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DURATION_BASE, ease: EASE_SMOOTH } },
};

export const slideFromRight = {
  hidden: { opacity: 0, x: 24 },
  show: { opacity: 1, x: 0, transition: { duration: DURATION_BASE, ease: EASE_SMOOTH } },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  show: { opacity: 1, scale: 1, transition: { duration: DURATION_BASE, ease: EASE_SMOOTH } },
};

export const staggerContainer = (stagger = 0.06) => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger } },
});

export const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1, y: 0,
    transition: { type: "spring" as const, stiffness: 260, damping: 24 },
  },
};

export const cardHover = {
  rest: { y: 0, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)" },
  hover: {
    y: -2,
    boxShadow: "0 8px 24px rgba(0,0,0,.08), 0 4px 8px rgba(0,0,0,.06)",
    transition: { duration: DURATION_FAST, type: "spring", stiffness: 400, damping: 28 },
  },
};

export const buttonPress = {
  tap: { scale: 0.98, transition: { duration: 0.1 } },
};

export function useMotionSafety() {
  const prefersReduced = useReducedMotion();
  const [isSlow, setIsSlow] = useState(false);
  const frameTimes = useRef<number[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (prefersReduced) return;
    let last = performance.now();
    let slowCount = 0;

    const check = (now: number) => {
      const dt = now - last;
      last = now;
      frameTimes.current.push(dt);
      if (frameTimes.current.length > 60) frameTimes.current.shift();
      const avg = frameTimes.current.reduce((a, b) => a + b, 0) / frameTimes.current.length;
      if (avg > 20) {
        slowCount++;
        if (slowCount >= 3) setIsSlow(true);
      } else {
        slowCount = 0;
        setIsSlow(false);
      }
      rafRef.current = requestAnimationFrame(check);
    };

    rafRef.current = requestAnimationFrame(check);
    return () => cancelAnimationFrame(rafRef.current);
  }, [prefersReduced]);

  const shouldReduce = prefersReduced || isSlow;

  return {
    shouldReduce,
    safe: (variant: object) => (shouldReduce ? {} : variant),
    safeDuration: (ms: number) => (shouldReduce ? 0 : ms),
  };
}

export function useCountUp(target: number, duration = 800, start = true) {
  const [value, setValue] = useState(0);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    if (!start) return;
    if (prefersReduced || target === 0) { setValue(target); return; }

    let startTime: number | null = null;
    const from = 0;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [target, duration, start, prefersReduced]);

  return value;
}
