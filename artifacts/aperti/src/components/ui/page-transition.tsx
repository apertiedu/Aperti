import { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";

const VARIANTS = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit:    { opacity: 0 },
  },
  fadeUp: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit:    { opacity: 0, y: -6 },
  },
  slide: {
    initial: { opacity: 0, x: 16 },
    animate: { opacity: 1, x: 0 },
    exit:    { opacity: 0, x: -8 },
  },
};

interface PageTransitionProps {
  children: ReactNode;
  variant?: keyof typeof VARIANTS;
  duration?: number;
  className?: string;
}

export function PageTransition({
  children,
  variant = "fadeUp",
  duration = 0.18,
  className,
}: PageTransitionProps) {
  const [location] = useLocation();
  const v = VARIANTS[variant];

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location}
        initial={v.initial}
        animate={v.animate}
        exit={v.exit}
        transition={{ duration, ease: [0.22, 1, 0.36, 1] }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export function SectionReveal({
  children,
  delay = 0,
  className,
}: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerList({
  children,
  stagger = 0.06,
  className,
}: { children: ReactNode; stagger?: number; className?: string }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger } } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
