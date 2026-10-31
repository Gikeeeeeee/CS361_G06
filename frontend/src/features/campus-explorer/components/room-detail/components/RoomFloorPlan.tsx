import { MapPin, Loader2, Navigation } from 'lucide-react';
import type { Floor, Room, Building } from '../../../../../shared/types/domain.types';
import { useSvgFloorPlan } from '../../floor-viewer/hooks/useSvgFloorPlan';
import { InteractiveSvgMap } from '../../floor-viewer/components/InteractiveSvgMap';
import { useNavigation } from '../../../../navigation/context/NavigationContext';

interface RoomFloorPlanProps {
  room?: Room | null;
  floor: Floor | null;
  building?: Building | { id: string; code: string; name: any } | null;
}

export function RoomFloorPlan({ room, floor, building }: RoomFloorPlanProps) {
  const { navigateToRoom } = useNavigation();
  const buildingCode = building?.code || (room as any)?.building?.code || 'LC3';
  const floorNumber = floor?.floor_number || (room as any)?.floor?.floor_number || 1;
  const svgUrl = floor?.floor_plan?.url || floor?.map?.url;

  const { svgContent, loading, error } = useSvgFloorPlan(svgUrl);

  if (!floor && !room) return null;

  let highlightedRoomId = room?.room_number || null;
  if (!highlightedRoomId && room) {
    highlightedRoomId = room.name?.en || room.name?.th || (room as any).id || null;
  }

  return (
    <section className="px-5 pt-4 pb-6">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-900">Floor Plan & Location</h3>
        </div>
        <span className="text-xs font-semibold text-blue-600">Level {floorNumber}</span>
      </div>

      {/* Floor Plan Preview with Interactive SVG */}
      <div className="w-full rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs min-h-[340px] h-[360px] sm:h-[420px] flex items-center justify-center relative">
        {loading && (
          <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-xs font-medium text-slate-500">Loading floor plan...</span>
          </div>
        )}

        {error && !svgContent && (
          <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 gap-2">
            <MapPin className="w-8 h-8 opacity-40 text-slate-400" />
            <span className="text-xs font-medium">Floor Plan Unavailable</span>
          </div>
        )}

        {svgContent && (
          <div className="w-full h-full flex items-center justify-center">
            <InteractiveSvgMap
              svgContent={svgContent}
              highlightedRoomId={highlightedRoomId}
            />
          </div>
        )}
      </div>

      {/* Legend & Room Info */}
      <div className="flex items-center justify-between text-xs text-slate-500 mt-3 px-1">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-blue-600 inline-block"></span>
            <span className="font-semibold text-slate-700">Room {room?.room_number || ''}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-slate-200 border border-slate-300 inline-block"></span>
            <span>Other Rooms</span>
          </div>
        </div>
        <span className="font-medium text-slate-600">
          {buildingCode} • Floor {floorNumber}
        </span>
      </div>

      {/* Navigate Action Button */}
      <button
        type="button"
        onClick={() => {
          const roomTitle = room?.room_number || room?.name?.en || room?.name?.th || room?.id || '';
          navigateToRoom(room?.id || '', roomTitle);
        }}
        className="w-full mt-4 py-3 px-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
      >
        <Navigation className="w-4 h-4" />
        <span>Navigate to Room</span>
      </button>
    </section>
  );
}
