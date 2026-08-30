import React, { useImperativeHandle, forwardRef } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { useBottomSheetGesture } from '../hooks/useBottomSheetGesture';
import { SheetDragHeader } from './SheetDragHeader';
import { BuildingDirectoryCard } from './BuildingDirectoryCard';
import type { BottomSheetState } from '../types/mapDirectory.types';
import type { BuildingItem } from '../../../shared/types/api.contracts';

interface PeekBottomSheetProps {
  buildings: BuildingItem[];
  onSelectBuilding: (building: BuildingItem) => void;
}

export interface PeekBottomSheetRef {
  snapTo: (state: BottomSheetState) => void;
}

export const PeekBottomSheet = forwardRef<PeekBottomSheetRef, PeekBottomSheetProps>(
  ({ buildings, onSelectBuilding }, ref) => {
    const {
      snap,
      snapTo,
      controls,
      containerRef,
      scrollRef,
      handleDragEnd,
      toggleSnap,
      expandedY,
      peekY
    } = useBottomSheetGesture();

    const dragControls = useDragControls();

    // Expose control to parent so search focus triggers expansion
    useImperativeHandle(ref, () => ({
      snapTo: (state: BottomSheetState) => {
        snapTo(state);
      }
    }));

    // Calculate total rooms across all listed buildings (Mocked as API doesn't provide stats)
    const totalRooms = buildings.length * 10;

    const handlePointerDown = (e: React.PointerEvent) => {
      const target = e.target as HTMLElement;
      // Drag only works on header/handle. If it's the scroll list, ignore so we can scroll natively
      const isHeader = containerRef.current?.children[0]?.contains(target);
      
      if (isHeader) {
        dragControls.start(e);
      }
    };

    return (
      <motion.div
        ref={containerRef}
        className="fixed inset-x-0 bottom-0 z-20 flex flex-col bg-white/95 backdrop-blur-md rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.08)] border-t border-slate-100/50 touch-none max-w-md mx-auto"
        style={{ height: '100vh', y: peekY }}
        initial={{ y: window.innerHeight }}
        animate={controls}
        drag="y"
        dragDirectionLock
        dragControls={dragControls}
        dragListener={false} // Only drag via handle/header pointer events
        onPointerDown={handlePointerDown}
        dragConstraints={{ top: expandedY, bottom: peekY }}
        dragElastic={0.03}
        onDragEnd={handleDragEnd}
      >
        <SheetDragHeader 
          isExpanded={snap === 'expanded'} 
          totalBuildings={buildings.length} 
          totalRooms={totalRooms}
          onToggle={toggleSnap} 
        />

        {/* List Content Area: only scrolls natively when snapped to expanded */}
        <div 
          ref={scrollRef}
          className={`flex-1 w-full px-5 pt-3 pb-28 overscroll-contain custom-scrollbar ${
            snap !== 'expanded' ? 'overflow-hidden' : 'overflow-y-auto'
          }`}
          onPointerDown={(e) => {
            // Stop scroll events from triggering bottom sheet dragging
            e.stopPropagation();
          }}
        >
          <div className="flex flex-col gap-3 pb-safe">
            {buildings.map((building) => (
              <BuildingDirectoryCard 
                key={building.id}
                building={building}
                onClick={() => onSelectBuilding(building)}
              />
            ))}
          </div>
        </div>
      </motion.div>
    );
  }
);

PeekBottomSheet.displayName = 'PeekBottomSheet';
