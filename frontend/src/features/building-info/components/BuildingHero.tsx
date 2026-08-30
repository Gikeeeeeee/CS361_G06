import type { Building } from '../../../shared/types/domain.types';
import { Badge } from '../../../shared/components/Badge';
import { Clock, Layers, Grid2X2 } from 'lucide-react';
import { getTodayOpeningHours } from '../../../shared/utils/date';

interface BuildingHeroProps {
  building: Building;
}

export function BuildingHero({ building }: BuildingHeroProps) {
  return (
    <div className="flex flex-col">
      {/* Hero Header Section */}
      <div className="relative w-full pt-20 pb-8 px-5 bg-gradient-to-br from-primary to-indigo-800">
        
        <div className="relative z-10 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-white/20 text-white border-none backdrop-blur-md px-3 py-1 text-sm font-bold">
              {building.code}
            </Badge>
            <Badge
              variant="default"
              className={
                building.status === 'OPEN'
                  ? 'bg-emerald-400/90 text-emerald-950 border-none px-3 py-1 text-sm font-bold shadow-sm'
                  : building.status === 'CLOSED'
                  ? 'bg-rose-400/90 text-rose-950 border-none px-3 py-1 text-sm font-bold shadow-sm'
                  : 'bg-amber-400/90 text-amber-950 border-none px-3 py-1 text-sm font-bold shadow-sm'
              }
            >
              {building.status}
            </Badge>
          </div>
          <h1 className="text-3xl font-extrabold text-white leading-tight tracking-tight mt-1">
            {building.name}
          </h1>
          <div className="flex items-center text-primary-100 font-medium text-sm mt-1 bg-black/10 w-fit px-3 py-1.5 rounded-full backdrop-blur-sm">
            <Clock className="w-4 h-4 mr-1.5 opacity-80" />
            <span>{getTodayOpeningHours(building.opening_hours)}</span>
          </div>
        </div>
      </div>

      {/* Details & Stats */}
      <div className="p-5 space-y-5 bg-slate-50/50">
        <p className="text-slate-600 text-sm leading-relaxed font-medium">
          {building.description}
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border-none">
            <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center mb-2">
              <Layers className="w-5 h-5 text-primary" />
            </div>
            <span className="text-2xl font-bold text-slate-800 tracking-tight">{building.stats.totalFloors}</span>
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider mt-0.5">Floors</span>
          </div>
          <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border-none">
            <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center mb-2">
              <Grid2X2 className="w-5 h-5 text-primary" />
            </div>
            <span className="text-2xl font-bold text-slate-800 tracking-tight">{building.stats.totalRooms}</span>
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider mt-0.5">Rooms</span>
          </div>
        </div>
      </div>
    </div>
  );
}
