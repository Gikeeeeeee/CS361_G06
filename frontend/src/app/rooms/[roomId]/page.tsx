import { useParams } from 'react-router-dom';
import { useRoomDetail } from '../../../features/room-detail/hooks/useRoomDetail';
import { RoomDetailContainer } from '../../../features/room-detail/components/RoomDetailContainer';
import { RoomHeaderSection } from '../../../features/room-detail/components/RoomHeaderSection';
import { RoomSpecsGrid } from '../../../features/room-detail/components/RoomSpecsGrid';
import { RoomEquipmentList } from '../../../features/room-detail/components/RoomEquipmentList';

export default function RoomDetailPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { room, loading, error } = useRoomDetail(roomId);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-slate-100 border-t-primary animate-spin"></div>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-xl font-bold text-slate-800 mb-2">Room not found</h2>
        <p className="text-slate-500">{error || 'The room details could not be loaded.'}</p>
      </div>
    );
  }

  return (
    <RoomDetailContainer roomNumber={room.number}>
      <RoomHeaderSection room={room} />
      <RoomSpecsGrid room={room} />
      <div className="h-px w-full bg-slate-100 my-2" />
      <RoomEquipmentList room={room} />
    </RoomDetailContainer>
  );
}
