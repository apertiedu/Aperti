import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 1000),
      setTimeout(() => setPhase(2), 2500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-between px-[10vw] z-10"
      initial={{ opacity: 0, clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ opacity: 1, clipPath: 'circle(150% at 50% 50%)' }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <img src={`${import.meta.env.BASE_URL}images/ai-brain.png`} className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-screen" />
      
      <div className="w-[45%] relative z-20">
        <motion.div className="text-teal-400 font-bold uppercase tracking-widest text-[1.2vw] mb-4">AI Mentor</motion.div>
        <motion.h2 className="text-[4vw] font-bold leading-tight mb-6">24/7 intelligent<br/>tutoring.</motion.h2>
        <motion.p className="text-[1.5vw] text-teal-100/80">Always there to guide, explain, and support every student's unique learning path.</motion.p>
      </div>

      <div className="w-[45%] relative z-20 h-[50vh] flex flex-col justify-end">
        <motion.div 
          className="bg-gray-900/80 backdrop-blur-xl border border-teal-500/30 p-6 rounded-2xl mb-4 w-4/5 self-end"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ type: 'spring' }}
        >
          <div className="text-[1vw] text-gray-400 mb-2">Student</div>
          <div className="text-[1.2vw]">I don't understand the quadratic formula...</div>
        </motion.div>

        <motion.div 
          className="bg-teal-900/80 backdrop-blur-xl border border-teal-400/40 p-6 rounded-2xl w-4/5 shadow-[0_0_30px_rgba(13,148,136,0.3)]"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ type: 'spring', bounce: 0.4 }}
        >
          <div className="text-[1vw] text-teal-300 mb-2 flex items-center gap-2">
            <div className="w-2 h-2 bg-teal-400 rounded-full animate-pulse" />
            AI Mentor
          </div>
          <div className="text-[1.2vw]">Let's break it down together. Think of it as finding the roots of a parabola. What part trips you up?</div>
        </motion.div>
      </div>
    </motion.div>
  );
}