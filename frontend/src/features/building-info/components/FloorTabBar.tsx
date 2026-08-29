import type { Floor } from '../types/buildingInfo.types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface FloorTabBarProps {
  floors: Floor[];
  selectedFloorId: string;
  onSelectFloor: (floorId: string) => void;
}

export function FloorTabBar({ floors, selectedFloorId, onSelectFloor }: FloorTabBarProps) {
  // Sort floors ascending by level just to be sure
  const sortedFloors = [...floors].sort((a, b) => a.level - b.level);

  return (
    <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-xl border-b border-slate-100 pt-2 pb-2">
      <div className="flex overflow-x-auto px-4 hide-scrollbar gap-2 snap-x">
        {sortedFloors.map((floor) => {
          const isActive = floor.id === selectedFloorId;
          return (
            <button
              key={floor.id}
              onClick={() => onSelectFloor(floor.id)}
              className={cn(
                'snap-start flex-shrink-0 px-5 py-2 rounded-full text-sm font-semibold transition-all duration-300 border shadow-sm',
                isActive
                  ? 'bg-blue-600 border-blue-600 text-white shadow-blue-200'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              )}
            >
              {floor.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
