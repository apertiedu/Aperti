import { useEffect, useRef, useState } from "react";
import anime from "animejs";

export function useAnimeCounter(
  target: number,
  options: { duration?: number; delay?: number; easing?: string } = {}
) {
  const { duration = 1400, delay = 0, easing = "easeOutExpo" } = options;
  const [value, setValue] = useState(0);
  const obj = useRef({ v: 0 });
  const inst = useRef<anime.AnimeInstance | null>(null);

  useEffect(() => {
    obj.current.v = 0;
    setValue(0);
    const timeout = setTimeout(() => {
      inst.current = anime({
        targets: obj.current,
        v: target,
        duration,
        easing,
        round: 1,
        update() {
          setValue(Math.round(obj.current.v));
        },
      });
    }, delay);
    return () => {
      clearTimeout(timeout);
      inst.current?.pause();
    };
  }, [target, duration, delay, easing]);

  return value;
}

export function useStaggerEntrance(
  ref: React.RefObject<HTMLElement | null>,
  options: { selector?: string; stagger?: number; duration?: number; delay?: number } = {}
) {
  const { selector = "[data-s]", stagger = 80, duration = 550, delay = 0 } = options;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const items = el.querySelectorAll(selector);
    if (!items.length) return;
    anime({
      targets: Array.from(items),
      opacity: [0, 1],
      translateY: [20, 0],
      delay: anime.stagger(stagger, { start: delay }),
      duration,
      easing: "easeOutCubic",
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
    const items = el.querySelectorAll(selector);
    if (!items.length) return;
    anime({
      targets: Array.from(items),
      opacity: [0, 1],
      translateY: [40, 0],
      delay: anime.stagger(150),
      duration: 900,
      easing: "easeOutExpo",
    });
  }, []);
}

export function animeStaggerIn(
  container: HTMLElement | null,
  selector: string,
  staggerMs = 80
) {
  if (!container) return;
  const items = container.querySelectorAll(selector);
  if (!items.length) return;
  anime({
    targets: Array.from(items),
    opacity: [0, 1],
    translateY: [16, 0],
    delay: anime.stagger(staggerMs),
    duration: 480,
    easing: "easeOutCubic",
  });
}

export function animePulse(target: string | HTMLElement, color = "#0D9488") {
  anime({
    targets: target,
    boxShadow: [
      `0 0 0 0px ${color}40`,
      `0 0 0 10px ${color}00`,
    ],
    duration: 800,
    easing: "easeOutQuad",
    loop: false,
  });
}
