import type { Building } from '../../../shared/types/domain.types';
import { BackButton } from '../../../shared/components/BackButton';
import { Bookmark, Layers, Grid2X2, Clock } from 'lucide-react';
import { Button } from '../../../shared/components/Button';

interface BuildingHeroProps {
  building: Building;
}

export function BuildingHero({ building }: BuildingHeroProps) {
  const totalRooms = building.floors?.reduce((acc, f) => acc + (f.rooms?.length || 0), 0) || 0;
  
  return (
    <div className="flex flex-col">
      {/* Top Header Section */}
      <div className="relative w-full pt-10 pb-14 px-5 bg-primary overflow-hidden">
        {/* Navigation Bar inside Hero Header */}
        <div className="flex justify-between items-center mb-6 relative z-20">
          <BackButton />
          <Button variant="ghost" size="icon" className="h-10 w-10 text-white hover:bg-white/20 rounded-full">
            <Bookmark className="w-5 h-5" />
          </Button>
        </div>

        {/* Building Title & Metadata Info */}
        <div className="relative z-10 space-y-2 mt-auto">
          {/* Opening Hours (Simple & Modern) */}
          {building.opening_hours && (
            <div className="flex items-center gap-1.5 text-xs text-white/90 font-medium">
              <Clock className="w-3.5 h-3.5 text-white/80" />
              <span>{building.opening_hours}</span>
            </div>
          )}

          {/* Building Name (Thai only) */}
          <h1 className="text-3xl font-black text-white tracking-tight drop-shadow-md">
            {building.name.th}
          </h1>

          {/* Description */}
          {building.description && (building.description.th || building.description.en) && (
            <p className="text-slate-200 text-xs sm:text-sm leading-relaxed mt-2 pt-2 border-t border-white/15 drop-shadow line-clamp-3">
              {building.description.th || building.description.en}
            </p>
          )}
        </div>
      </div>

      {/* Overlapping Stats Cards */}
      <div className="px-5 -mt-8 relative z-20">
        <div className="grid grid-cols-2 gap-4">
          
          <div className="flex flex-col items-center justify-center py-5 px-4 rounded-2xl bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] border border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center mb-2">
              <Layers className="w-5 h-5 text-primary" strokeWidth={2} />
            </div>
            <span className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-1">
              {building.floors?.length || 0}
            </span>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              Floors
            </span>
          </div>

          <div className="flex flex-col items-center justify-center py-5 px-4 rounded-2xl bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] border border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center mb-2">
              <Grid2X2 className="w-5 h-5 text-primary" strokeWidth={2} />
            </div>
            <span className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-1">
              {totalRooms}
            </span>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              Rooms
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}
