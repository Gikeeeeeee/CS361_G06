import { useState, useRef, useEffect, useCallback } from 'react';
import type { PanInfo } from 'framer-motion';
import { useAnimation } from 'framer-motion';
import type { BottomSheetState } from '../types/mapDirectory.types';

interface UseBottomSheetGestureProps {
  onSnap?: (snapPoint: BottomSheetState) => void;
}

export function useBottomSheetGesture({ onSnap }: UseBottomSheetGestureProps = {}) {
  const [snap, setSnap] = useState<BottomSheetState>('peek');
  const controls = useAnimation();
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Layout Constants for precise positioning
  const NAV_HEIGHT = 64; // Fixed Bottom Nav height
  const PEEK_HEADER_HEIGHT = 80; // Drag Handle + Header Height

  const getWindowHeight = () => typeof window !== 'undefined' ? window.innerHeight : 800;
  const [windowHeight, setWindowHeight] = useState(getWindowHeight);

  useEffect(() => {
    const handleResize = () => setWindowHeight(window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Calculate absolute Y offsets from the top of the viewport
  const peekY = windowHeight - NAV_HEIGHT - PEEK_HEADER_HEIGHT;
  const halfY = windowHeight * 0.50; // ~50vh height
  const expandedY = windowHeight * 0.15; // ~85vh height

  const snapTo = useCallback(
    async (target: BottomSheetState) => {
      const y = target === 'peek' 
        ? peekY 
        : target === 'half' 
        ? halfY 
        : expandedY;
      setSnap(target);
      if (onSnap) onSnap(target);
      
      // Dispatch event to sync with global layout components like BottomNavbar
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bottom-sheet-snap', { detail: target }));
      }
      
      await controls.start({
        y,
        transition: { type: 'spring', damping: 26, stiffness: 280, mass: 0.8 },
      });
    },
    [controls, peekY, halfY, expandedY, onSnap]
  );

  // Initialize position
  useEffect(() => {
    if (windowHeight > 0) {
      controls.set({ 
        y: snap === 'peek' 
          ? peekY 
          : snap === 'half' 
          ? halfY 
          : expandedY 
      });
      // Initial sync with layout components
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bottom-sheet-snap', { detail: snap }));
      }
    }
  }, [windowHeight, peekY, halfY, expandedY, controls, snap]);

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const { offset, velocity } = info;
    const velocityThreshold = 180;
    const distanceThreshold = 60;

    if (snap === 'expanded') {
      if (offset.y > distanceThreshold || velocity.y > velocityThreshold) {
        snapTo('half');
      } else {
        snapTo('expanded');
      }
    } else if (snap === 'half') {
      if (offset.y > distanceThreshold || velocity.y > velocityThreshold) {
        snapTo('peek');
      } else if (offset.y < -distanceThreshold || velocity.y < -velocityThreshold) {
        snapTo('expanded');
      } else {
        snapTo('half');
      }
    } else if (snap === 'peek') {
      if (offset.y < -distanceThreshold || velocity.y < -velocityThreshold) {
        // Flick up from peek state snaps to half
        snapTo('half');
      } else {
        snapTo('peek');
      }
    }
  };

  const toggleSnap = () => {
    if (snap === 'peek') {
      snapTo('half');
    } else if (snap === 'half') {
      snapTo('expanded');
    } else {
      snapTo('peek');
    }
  };

  return {
    snap,
    snapTo,
    controls,
    containerRef,
    scrollRef,
    handleDragEnd,
    toggleSnap,
    expandedY,
    halfY,
    peekY
  };
}
