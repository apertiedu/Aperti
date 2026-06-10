import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 800),
      setTimeout(() => setPhase(2), 2000),
      setTimeout(() => setPhase(3), 3500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center px-[10vw] z-10"
      initial={{ opacity: 0, x: '10vw' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '-10vw' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <img src={`${import.meta.env.BASE_URL}images/blocks-ui.png`} className="absolute right-0 top-0 w-[60%] h-full object-cover opacity-60 mask-image-gradient-l" style={{ WebkitMaskImage: 'linear-gradient(to right, transparent, black)' }} />
      
      <div className="w-1/2 relative z-20">
        <motion.div 
          className="text-teal-400 font-bold tracking-widest uppercase mb-4 text-[1.2vw]"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          ContentCraft
        </motion.div>
        
        <motion.h2 
          className="text-[4.5vw] font-bold leading-tight mb-6"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Build lessons<br/>at the speed<br/>of thought.
        </motion.h2>

        <motion.div className="space-y-4" initial={{ opacity: 0 }} animate={phase >= 1 ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.5 }}>
          {[
            "Block-based visual editor",
            "Slash commands for speed",
            "Rich media integration"
          ].map((text, i) => (
            <motion.div 
              key={i}
              className="flex items-center gap-4 text-[1.5vw] text-gray-300"
              initial={{ x: -20, opacity: 0 }}
              animate={phase >= 2 ? { x: 0, opacity: 1 } : { x: -20, opacity: 0 }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
            >
              <div className="w-2 h-2 rounded-full bg-teal-500" />
              {text}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}