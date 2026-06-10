import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center z-10"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
    >
      <img src={`${import.meta.env.BASE_URL}images/abstract-teal.png`} className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-screen" />
      
      <motion.div
        className="w-32 h-32 mb-8 rounded-2xl bg-gradient-to-br from-teal-400 to-teal-700 flex items-center justify-center text-5xl font-bold shadow-[0_0_60px_rgba(13,148,136,0.6)]"
        initial={{ rotate: -90, scale: 0, opacity: 0 }}
        animate={{ rotate: 0, scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
      >
        A
      </motion.div>
      
      <motion.h1 
        className="text-[8vw] font-bold tracking-tight text-white leading-none"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.8 }}
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Aperti
      </motion.h1>
      
      <motion.p
        className="text-[2vw] text-teal-100 mt-4 tracking-wide font-light"
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.8 }}
      >
        Where every mind finds its rhythm.
      </motion.p>
    </motion.div>
  );
}