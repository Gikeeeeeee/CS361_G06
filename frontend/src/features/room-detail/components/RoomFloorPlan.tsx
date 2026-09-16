import { MapPin } from 'lucide-react';
import type { Floor } from '../../../shared/types/domain.types';

interface RoomFloorPlanProps {
  floor: Floor | null;
}

export function RoomFloorPlan({ floor }: RoomFloorPlanProps) {
  if (!floor) return null;

  return (
    <section className="px-5 pt-4 pb-6">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-900">Floor Plan & Location</h3>
        </div>
        <span className="text-xs font-semibold text-blue-600">Level {floor.floor_number}</span>
      </div>

      {/* Floor Plan Preview */}
      <div className="w-full rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="w-full aspect-[4/3] flex items-center justify-center p-4">
          {floor.floor_plan_key ? (
            <div className="w-full h-full flex items-center justify-center">
              <img
                src={`/${floor.floor_plan_key}`}
                alt={`Floor ${floor.floor_number} Plan`}
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  const fallback = (e.target as HTMLElement).nextElementSibling;
                  if (fallback) (fallback as HTMLElement).style.display = 'flex';
                }}
              />
              {/* Fallback on error */}
              <div className="flex-col items-center justify-center text-slate-300 gap-2 hidden">
                <MapPin className="w-8 h-8 opacity-40" />
                <span className="text-[10px] font-medium uppercase tracking-wider opacity-40">Floor Plan Unavailable</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-300 gap-2">
              <MapPin className="w-8 h-8 opacity-40" />
              <span className="text-[10px] font-medium uppercase tracking-wider opacity-40">Floor Plan Unavailable</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
