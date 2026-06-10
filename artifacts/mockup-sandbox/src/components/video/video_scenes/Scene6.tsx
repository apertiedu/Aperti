import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene6() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 800),
      setTimeout(() => setPhase(2), 2000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center px-[10vw] z-10"
      initial={{ opacity: 0, rotateY: -90, perspective: 1000 }}
      animate={{ opacity: 1, rotateY: 0 }}
      exit={{ opacity: 0, scale: 1.5 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-[40%] relative z-20">
        <motion.div className="text-teal-400 font-bold uppercase tracking-widest text-[1.2vw] mb-4">Live Sessions</motion.div>
        <motion.h2 className="text-[4.5vw] font-bold leading-tight mb-6">Connect,<br/>engage,<br/>succeed.</motion.h2>
        <motion.p className="text-[1.5vw] text-gray-400 max-w-md">Flawless video streaming integrated directly into the learning experience.</motion.p>
      </div>

      <div className="w-[60%] relative h-[60vh] flex flex-wrap gap-4 p-8 z-20">
        {[1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            className={`bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden relative ${i === 1 ? 'w-[65%] h-full' : 'w-[30%] h-[calc(50%-0.5rem)]'}`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={phase >= 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.5, delay: i * 0.15 }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-teal-900/40 to-black/60" />
            {i === 1 && phase >= 2 && (
              <motion.div 
                className="absolute top-4 right-4 bg-red-500 text-white text-[0.8vw] px-3 py-1 rounded-full font-bold flex items-center gap-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                LIVE
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}