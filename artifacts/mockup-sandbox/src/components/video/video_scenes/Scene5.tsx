import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1200),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center z-10"
      initial={{ opacity: 0, y: '20vh' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, filter: 'blur(20px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="text-center z-20 mb-16">
        <motion.div className="text-teal-400 font-bold uppercase tracking-widest text-[1.2vw] mb-4">Analytics & Achievements</motion.div>
        <motion.h2 className="text-[4vw] font-bold">Track progress. Celebrate wins.</motion.h2>
      </div>

      <div className="flex gap-8 w-[80vw] justify-center items-end h-[40vh] relative z-20">
        {[40, 75, 55, 90, 65].map((height, i) => (
          <motion.div 
            key={i}
            className="w-[8vw] bg-gradient-to-t from-teal-800 to-teal-400 rounded-t-xl relative group"
            initial={{ height: 0 }}
            animate={phase >= 1 ? { height: `${height}%` } : { height: 0 }}
            transition={{ duration: 1, delay: i * 0.1, ease: 'easeOut' }}
          >
            {i === 3 && phase >= 2 && (
              <motion.div 
                className="absolute -top-16 left-1/2 -translate-x-1/2 bg-yellow-500 text-black font-bold py-2 px-4 rounded-full text-[1vw] shadow-[0_0_20px_rgba(234,179,8,0.6)] whitespace-nowrap"
                initial={{ opacity: 0, scale: 0, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', bounce: 0.6 }}
              >
                Top Performer
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}