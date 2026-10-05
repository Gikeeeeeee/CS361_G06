import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useRoomDetail } from '../components/room-detail/hooks/useRoomDetail';
import { RoomHero } from '../components/room-detail/components/RoomHero';
import { RoomAmenities } from '../components/room-detail/components/RoomAmenities';
import { RoomFloorPlan } from '../components/room-detail/components/RoomFloorPlan';
import { RoomSchedule } from '../components/room-detail/components/RoomSchedule';

export default function RoomDetailPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { room, floor, building, loading, error } = useRoomDetail(roomId || '');

  useEffect(() => {
    if (room) {
      const roomTitle = room.room_number || room.name.th;
      document.title = `${roomTitle} | KU Long`;
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

  return (
    <div className="bg-slate-50 min-h-full pb-10">
      <RoomHero room={room} />

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
