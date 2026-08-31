import { Users, ThermometerSnowflake, Plug, LayoutDashboard } from 'lucide-react';
import type { RoomDetail } from '../../../shared/types/domain.types';

interface RoomSpecsGridProps {
  room: RoomDetail;
}

export function RoomSpecsGrid({ room }: RoomSpecsGridProps) {
  return (
    <section className="px-5 py-6">
      <h3 className="text-sm font-bold text-slate-800 mb-4">Room Specifications</h3>
      <div className="grid grid-cols-2 gap-3">
        {/* Capacity */}
        <div className="flex items-center gap-3 p-3 rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500">
            <Users size={18} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-800">{room.capacity}</span>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Seats</span>
          </div>
        </div>

        {/* Room Type */}
        <div className="flex items-center gap-3 p-3 rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500">
            <LayoutDashboard size={18} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-800 capitalize">{room.type.toLowerCase()}</span>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Category</span>
          </div>
        </div>

        {/* Air Con */}
        <div className="flex items-center gap-3 p-3 rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500">
            <ThermometerSnowflake size={18} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-800">{room.hasAirCon ? 'Yes' : 'No'}</span>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Air Con</span>
          </div>
        </div>

        {/* Power Outlets */}
        <div className="flex items-center gap-3 p-3 rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500">
            <Plug size={18} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-800">{room.hasPowerOutlets ? 'Available' : 'Limited'}</span>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Outlets</span>
          </div>
        </div>
      </div>
    </section>
  );
}
