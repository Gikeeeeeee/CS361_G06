import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useRoomDetail } from '../features/room-detail/hooks/useRoomDetail';
import { RoomHero } from '../features/room-detail/components/RoomHero';
import { RoomAmenities } from '../features/room-detail/components/RoomAmenities';
import { RoomFloorPlan } from '../features/room-detail/components/RoomFloorPlan';

export default function RoomDetailPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { room, floor, loading, error } = useRoomDetail(roomId || '');

  useEffect(() => {
    if (room) {
      const roomTitle = room.room_number || room.name.th;
      document.title = `${roomTitle} | KU Long`;
    }
  }, [room]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-slate-100 border-t-blue-600 animate-spin"></div>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-xl font-bold text-slate-800 mb-2">Room not found</h2>
        <p className="text-slate-500">{error || 'The room details could not be loaded.'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <RoomHero room={room} />

      {/* Divider */}
      <div className="h-2 bg-slate-50" />

      <RoomAmenities room={room} />

      {/* Divider */}
      <div className="mx-5 border-t border-slate-100 my-1" />

      <RoomFloorPlan floor={floor} />
    </div>
  );
}
