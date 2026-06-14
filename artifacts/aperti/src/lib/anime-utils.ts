import { useEffect, useRef, useState } from "react";
import { animate, stagger } from "animejs";

export function useAnimeCounter(
  target: number,
  options: { duration?: number; delay?: number; ease?: string } = {}
) {
  const { duration = 1400, delay = 0, ease = "outExpo" } = options;
  const [value, setValue] = useState(0);
  const obj = useRef({ v: 0 });
  const instRef = useRef<ReturnType<typeof animate> | null>(null);

  useEffect(() => {
    obj.current.v = 0;
    setValue(0);
    const timeout = setTimeout(() => {
      instRef.current = animate(obj.current, {
        v: target,
        duration,
        ease,
        onUpdate() {
          setValue(Math.round(obj.current.v));
        },
      });
    }, delay);
    return () => {
      clearTimeout(timeout);
      instRef.current?.pause();
    };
  }, [target, duration, delay, ease]);

  return value;
}

export function useStaggerEntrance(
  ref: React.RefObject<HTMLElement | null>,
  options: { selector?: string; stagger?: number; duration?: number; delay?: number } = {}
) {
  const { selector = "[data-s]", stagger: staggerMs = 80, duration = 550, delay = 0 } = options;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const items = Array.from(el.querySelectorAll<HTMLElement>(selector));
    if (!items.length) return;
    animate(items, {
      opacity: [0, 1],
      translateY: [20, 0],
      delay: stagger(staggerMs, { start: delay }),
      duration,
      ease: "outCubic",
    });
  }, []);
}

export function useHeroEntrance(
  containerRef: React.RefObject<HTMLElement | null>,
  selector = "[data-hero]"
) {
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const items = Array.from(el.querySelectorAll<HTMLElement>(selector));
    if (!items.length) return;
    animate(items, {
      opacity: [0, 1],
      translateY: [40, 0],
      delay: stagger(150),
      duration: 900,
      ease: "outExpo",
    });
  }, []);
}

export function animeStaggerIn(
  container: HTMLElement | null,
  selector: string,
  staggerMs = 80
) {
  if (!container) return;
  const items = Array.from(container.querySelectorAll<HTMLElement>(selector));
  if (!items.length) return;
  animate(items, {
    opacity: [0, 1],
    translateY: [16, 0],
    delay: stagger(staggerMs),
    duration: 480,
    ease: "outCubic",
  });
}

export function animePulse(target: string | HTMLElement, color = "#0D9488") {
  animate(target as HTMLElement, {
    boxShadow: [
      `0 0 0 0px ${color}40`,
      `0 0 0 10px ${color}00`,
    ],
    duration: 800,
    ease: "outQuad",
    loop: false,
  });
}
