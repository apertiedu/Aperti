import { motion } from 'framer-motion';

export function Scene7() {
  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-teal-900"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
    >
      <motion.div
        className="w-40 h-40 mb-8 rounded-3xl bg-white text-teal-800 flex items-center justify-center text-6xl font-bold shadow-[0_0_80px_rgba(255,255,255,0.2)]"
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 20, delay: 0.5 }}
      >
        A
      </motion.div>
      
      <motion.h1 
        className="text-[6vw] font-bold text-white tracking-tight"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.8 }}
      >
        Aperti
      </motion.h1>

      <motion.div 
        className="mt-8 text-[1.5vw] text-teal-200 font-medium tracking-widest uppercase"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.5 }}
      >
        The Educational OS
      </motion.div>
    </motion.div>
  );
}