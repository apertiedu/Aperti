import { useEffect, useState, useMemo } from 'react';

declare global {
  interface Window {
    startRecording?: () => void;
    stopRecording?: () => void;
  }
}

export function useVideoPlayer({ durations }: { durations: Record<string, number> }) {
  const [currentScene, setCurrentScene] = useState(0);
  const [hasCompletedPass, setHasCompletedPass] = useState(false);
  
  const sceneKeys = useMemo(() => Object.keys(durations), [durations]);
  const sceneDurations = useMemo(() => Object.values(durations), [durations]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    
    // Start recording on mount
    if (currentScene === 0 && !hasCompletedPass) {
      window.startRecording?.();
    }

    const advanceScene = () => {
      setCurrentScene((prev) => {
        const next = prev + 1;
        if (next >= sceneDurations.length) {
          if (!hasCompletedPass) {
            setHasCompletedPass(true);
            window.stopRecording?.();
          }
          return 0; // loop
        }
        return next;
      });
    };

    timeoutId = setTimeout(advanceScene, sceneDurations[currentScene]);

    return () => clearTimeout(timeoutId);
  }, [currentScene, sceneDurations, hasCompletedPass]);

  return { currentScene, sceneKeys };
}