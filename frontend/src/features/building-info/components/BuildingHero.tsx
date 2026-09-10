import type { Building } from '../../../shared/types/domain.types';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bookmark, Clock, Layers, Grid2X2 } from 'lucide-react';

interface BuildingHeroProps {
  building: Building;
}

export function BuildingHero({ building }: BuildingHeroProps) {
  const navigate = useNavigate();
  const totalRooms =
    building.floors?.reduce((acc, f) => acc + (f.rooms?.length || 0), 0) || 0;

  return (
    <div className="flex flex-col w-full">
      {/* Hero Header — Blue background (Supports future image) */}
      <div className="relative h-44 w-full overflow-hidden bg-blue-600 flex flex-col justify-between pt-8 pb-10 px-5">
        {/* Background image when provided */}
        {building.image_url && (
          <>
            <img
              src={building.image_url}
              alt={building.name.th}
              className="absolute inset-0 w-full h-full object-cover z-0"
            />
            <div className="absolute inset-0 bg-black/40 z-0" />
          </>
        )}

        {/* Floating nav row */}
        <div className="flex items-center justify-between relative z-10">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 -ml-1 rounded-full flex items-center justify-center text-white hover:bg-white/10 active:scale-95 transition"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6 stroke-[2.2]" />
          </button>
          <button
            className="w-10 h-10 -mr-1 rounded-full flex items-center justify-center text-white hover:bg-white/10 active:scale-95 transition"
            aria-label="Bookmark"
          >
            <Bookmark className="w-5 h-5 stroke-[2]" />
          </button>
        </div>

        {/* Building code */}
        <h1 className="text-3xl font-extrabold text-white tracking-tight relative z-10">
          {building.code}
        </h1>
      </div>

      {/* Floating Card Content */}
      <div className="-mt-6 mx-4 relative z-20">
        <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.06)] border border-slate-100/80">
          {/* Building Name */}
          <h2 className="text-base font-bold text-slate-900">
            {building.name.th}
          </h2>

          {/* Description */}
          {(building.description?.th || building.description?.en) && (
            <div className="mt-2 text-xs text-slate-500 leading-relaxed">
              {building.description.th && (
                <p className="line-clamp-2">{building.description.th}</p>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-slate-100 my-3.5" />

          {/* Operating Hours */}
          {building.opening_hours && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
              <Clock className="w-3.5 h-3.5 text-slate-400 stroke-[2]" />
              <span>{building.opening_hours}</span>
            </div>
          )}

          {/* Floor & Room Pills */}
          <div className="flex items-center gap-2 mt-2.5">
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-semibold">
              <Layers className="w-3 h-3 text-slate-500 stroke-[2.2]" />
              <span>{building.floors?.length || 0} Floors</span>
            </div>

            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-semibold">
              <Grid2X2 className="w-3 h-3 text-slate-500 stroke-[2.2]" />
              <span>{totalRooms} Rooms</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}