import type { RoomDetail } from '../../../shared/types/domain.types';

interface RoomHeaderSectionProps {
  room: RoomDetail;
}

export function RoomHeaderSection({ room }: RoomHeaderSectionProps) {
  const isAvailable = room.status === 'AVAILABLE';
  const statusColor = isAvailable ? 'text-emerald-700 bg-emerald-50' : room.status === 'IN_USE' ? 'text-amber-700 bg-amber-50' : 'text-rose-700 bg-rose-50';

  return (
    <section className="flex flex-col">
      {/* Hero Background - Solid Color as requested */}
      <div className="w-full h-56 bg-slate-200 relative">
        <div className="absolute bottom-4 left-4">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full shadow-sm backdrop-blur-md ${statusColor}`}>
            <span className="text-xs font-bold tracking-wide capitalize">
              {room.status?.replace('_', ' ').toLowerCase() || 'available'}
            </span>
          </div>
        </div>
      </div>

      {/* Room Title and Breadcrumbs */}
      <div className="px-5 pt-5 pb-6 bg-white border-b border-slate-100">
        <div className="text-xs font-semibold text-slate-400 mb-2 tracking-wide uppercase">
          {room.buildingCode} &gt; Floor {room.floorLevel} &gt; {room.wingOrZone}
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight mb-1">
          {room.number}
        </h1>
        <p className="text-slate-500 font-medium text-sm">
          {room.name} &bull; {room.department}
        </p>
      </div>
    </section>
  );
}
