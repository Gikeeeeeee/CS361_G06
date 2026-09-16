import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bookmark, Building as BuildingIcon } from 'lucide-react';
import type { Room } from '../../../shared/types/domain.types';

interface RoomHeroProps {
  room: Room;
}

export function RoomHero({ room }: RoomHeroProps) {
  const navigate = useNavigate();
  const displayNumber = room.room_number || room.name.en || room.id;

  return (
    <div className="flex flex-col">
      {/* Blue Hero Header */}
      <div className="relative h-44 w-full overflow-hidden bg-blue-600 flex flex-col justify-between pt-8 pb-10 px-5">
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

        {/* Room number — large bottom-left label */}
        <h1 className="text-3xl font-extrabold text-white tracking-tight relative z-10">
          {displayNumber}
        </h1>
      </div>

      {/* Room Image Card */}
      <div className="-mt-6 mx-4 relative z-20">
        <div className="w-full aspect-[16/10] rounded-2xl overflow-hidden bg-slate-100 border border-slate-100/80 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
          {room.image_key ? (
            <div className="relative w-full h-full">
              <img
                src={`/${room.image_key}`}
                alt={room.name.th}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Hide the broken image and show fallback
                  (e.target as HTMLImageElement).style.display = 'none';
                  const fallback = (e.target as HTMLElement).nextElementSibling;
                  if (fallback) (fallback as HTMLElement).style.display = 'flex';
                }}
              />
              {/* Fallback shown on error */}
              <div className="absolute inset-0 items-center justify-center text-slate-300 hidden" style={{ display: 'none' }}>
                <BuildingIcon className="w-12 h-12 opacity-50" />
              </div>
              {/* Photo count badge */}
              <div className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-black/50 backdrop-blur-sm text-white text-[10px] font-semibold">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                <span>1/1</span>
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-1.5">
              <BuildingIcon className="w-10 h-10 opacity-40" />
              <span className="text-[10px] font-medium uppercase tracking-wider opacity-40">No Image</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
