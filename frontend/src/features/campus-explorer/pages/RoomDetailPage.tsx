import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useRoomDetail } from '../components/room-detail/hooks/useRoomDetail';
import { RoomHero } from '../components/room-detail/components/RoomHero';
import { RoomAmenities } from '../components/room-detail/components/RoomAmenities';
import { RoomFloorPlan } from '../components/room-detail/components/RoomFloorPlan';
import { RoomSchedule } from '../components/room-detail/components/RoomSchedule';

import { AlertTriangle, Ban } from 'lucide-react';
import { statusApi } from '../../admin-status/services/statusApi';

export default function RoomDetailPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { room, floor, building, loading, error } = useRoomDetail(roomId || '');

  // V4-US2: Dynamic Room Status Indicator with live reactivity (Called at top to adhere to Rules of Hooks)
  const [roomStatus, setRoomStatus] = useState(() => {
    if (!room) return null;
    return statusApi.getRoomStatusSync(room.id) || statusApi.getRoomStatusSync(room.room_number || '');
  });

  useEffect(() => {
    if (!room) return;
    const update = () => {
      setRoomStatus(statusApi.getRoomStatusSync(room.id) || statusApi.getRoomStatusSync(room.room_number || ''));
    };
    update();

    if (floor?.id) {
      statusApi.getFloorStatusOverlay(floor.id).then(update).catch(() => {});
    }

    window.addEventListener('floor-status-updated', update);
    return () => window.removeEventListener('floor-status-updated', update);
  }, [room, floor?.id]);

  useEffect(() => {
    if (room) {
      const roomTitle = room.room_number || room.name.en || room.name.th;
      document.title = `${roomTitle} | Kulong`;
    }
  }, [room]);

  if (loading) {
    return (
      <div className="min-h-full py-20 bg-white flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-slate-100 border-t-blue-600 animate-spin"></div>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-full py-20 bg-white flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-xl font-bold text-slate-800 mb-2">Room not found</h2>
        <p className="text-slate-500">{error || 'The room details could not be loaded.'}</p>
      </div>
    );
  }

  const isMaintenance = roomStatus?.status === 'MAINTENANCE';
  const isClosed = roomStatus?.status === 'CLOSED';

  return (
    <div className="bg-slate-50 min-h-full pb-10">
      <RoomHero room={room} floor={floor} building={building} />

      {/* Dynamic Status Alert Banner */}
      {isMaintenance && (
        <div className="mx-4 mt-3 p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-700">Under Maintenance</div>
            <div className="text-xs text-amber-800 mt-0.5">
              {roomStatus?.status_note || 'This room is currently undergoing maintenance and may be temporarily inaccessible.'}
            </div>
          </div>
        </div>
      )}

      {isClosed && (
        <div className="mx-4 mt-3 p-3.5 rounded-2xl bg-red-50 border border-red-200/80 text-red-900 flex items-start gap-3 shadow-xs">
          <Ban className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold uppercase tracking-wider text-red-700">Room Closed</div>
            <div className="text-xs text-red-800 mt-0.5">
              {roomStatus?.status_note || 'This room is temporarily closed for classes and visits.'}
            </div>
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="h-2 bg-slate-50" />

      <RoomAmenities room={room} />

      {/* Divider */}
      <div className="mx-5 border-t border-slate-100 my-1" />

      <RoomFloorPlan room={room} floor={floor} building={building} />

      {/* Divider */}
      <div className="h-2 bg-slate-50 my-2" />

      <RoomSchedule roomId={room.id} />
    </div>
  );
}
