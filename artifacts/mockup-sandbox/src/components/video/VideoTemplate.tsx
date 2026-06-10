import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video/hooks';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';
import { Scene6 } from './video_scenes/Scene6';
import { Scene7 } from './video_scenes/Scene7';

const SCENE_DURATIONS = {
  open: 5000,
  content: 8000,
  echo: 8000,
  ai: 8000,
  analytics: 8000,
  live: 8000,
  close: 5000
};

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({ durations: SCENE_DURATIONS });

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black text-white" style={{ fontFamily: 'var(--font-sans)' }}>
      {/* Persistent Background Layer */}
      <div className="absolute inset-0">
        <motion.div className="absolute inset-0 opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle at center, #0D9488 0%, transparent 60%)' }}
          animate={{ scale: [1, 1.2, 0.9, 1.1, 1], opacity: [0.3, 0.5, 0.3, 0.6, 0.4] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div className="absolute inset-0 opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle at top right, #00796B 0%, transparent 50%)' }}
          animate={{ scale: [1.2, 0.9, 1.1, 0.8, 1], opacity: [0.2, 0.4, 0.2, 0.5, 0.3] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="absolute inset-0 bg-black/50" />
      </div>

      {/* Foreground Content */}
      <AnimatePresence mode="sync">
        {currentScene === 0 && <Scene1 key="open" />}
        {currentScene === 1 && <Scene2 key="content" />}
        {currentScene === 2 && <Scene3 key="echo" />}
        {currentScene === 3 && <Scene4 key="ai" />}
        {currentScene === 4 && <Scene5 key="analytics" />}
        {currentScene === 5 && <Scene6 key="live" />}
        {currentScene === 6 && <Scene7 key="close" />}
      </AnimatePresence>
    </div>
  );
}