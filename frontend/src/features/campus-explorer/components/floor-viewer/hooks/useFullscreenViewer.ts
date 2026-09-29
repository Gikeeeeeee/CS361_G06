import { useState, useEffect, useCallback } from 'react';

export function useFullscreenViewer(initialState: boolean = false) {
  const [isFullscreen, setIsFullscreen] = useState(initialState);

  const openFullscreen = useCallback(() => setIsFullscreen(true), []);
  const closeFullscreen = useCallback(() => setIsFullscreen(false), []);
  const toggleFullscreen = useCallback(() => setIsFullscreen(prev => !prev), []);

  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, closeFullscreen]);

  return { isFullscreen, openFullscreen, closeFullscreen, toggleFullscreen };
}
