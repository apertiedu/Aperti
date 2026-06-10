import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 600),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2400),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center z-10"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: '-20vh' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="text-center z-20 mb-12">
        <motion.div className="text-teal-400 font-bold uppercase tracking-widest text-[1.2vw] mb-4">ECHO Flashcards</motion.div>
        <motion.h2 className="text-[4vw] font-bold">Active recall, automated.</motion.h2>
      </div>

      <div className="relative w-[50vw] h-[40vh] flex items-center justify-center perspective-1000">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute w-[30vw] h-[25vh] bg-white text-black rounded-3xl p-8 flex items-center justify-center shadow-2xl border-b-8 border-teal-600"
            initial={{ 
              opacity: 0, 
              y: 50, 
              rotateX: 45, 
              scale: 0.8 
            }}
            animate={phase >= 1 ? { 
              opacity: 1 - (i * 0.2), 
              y: i * 20, 
              rotateZ: (i % 2 === 0 ? 1 : -1) * i * 3,
              scale: 1 - (i * 0.1),
              zIndex: 10 - i
            } : {}}
            transition={{ type: 'spring', damping: 20, delay: i * 0.15 }}
          >
            {i === 0 && (
              <motion.div 
                className="text-[2vw] font-bold text-center"
                initial={{ opacity: 0 }}
                animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
              >
                What is the powerhouse of the cell?
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}