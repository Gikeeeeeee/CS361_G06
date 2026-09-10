import type { Floor } from '../../../shared/types/domain.types';
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
  const sortedFloors = [...floors].sort((a, b) => a.floor_number - b.floor_number);

  return (
    <div className="pt-8 pb-4">
      <div className="flex overflow-x-auto px-5 hide-scrollbar gap-3 snap-x">
        {sortedFloors.map((floor) => {
          const isActive = floor.id === selectedFloorId;
          return (
            <button
              key={floor.id}
              onClick={() => onSelectFloor(floor.id)}
              className={cn(
                'snap-start flex-shrink-0 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 border',
                isActive
                  ? 'bg-primary border-primary text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              )}
            >
              {`Floor ${floor.floor_number}`}
            </button>
          );
        })}
      </div>
    </div>
  );
}
