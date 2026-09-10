import { useState, useEffect } from 'react';
import type { Room } from '../../../shared/types/domain.types';
import { campusService } from '../../../services';

export function useRoomDetail(roomId: string | undefined) {
  const [room, setRoom] = useState<Room | null>(null);
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [floorId, setFloorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) {
      setError('Room ID is required');
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    const fetchRoom = async () => {
      const parts = roomId.split('_');
      if (parts.length < 2) {
        if (isMounted) { setError('Invalid room identifier format'); setLoading(false); }
        return;
      }
      
      const bid = parts[0];
      const targetRoomId = parts.slice(1).join('_');
      
      try {
        const building = await campusService.getBuildingById(bid);
        if (!building) {
          if (isMounted) { setError('Building not found'); setLoading(false); }
          return;
        }

        const floors = await campusService.getFloorsByBuildingId(bid);
        
        // Search floors for the target room ID
        for (const floor of floors) {
          if (!isMounted) return;
          try {
            const rooms = await campusService.getRoomsByFloorId(floor.id);
            const r = rooms.find(room => room.id === targetRoomId);
            
            if (r && isMounted) {
              setRoom(r);
              setBuildingId(bid);
              setFloorId(floor.id);
              setLoading(false);
              return;
            }
          } catch (apiErr) {
            // Continue searching next floor on error
            continue;
          }
        }
        
        if (isMounted) { setError('Room not found'); setLoading(false); }
      } catch (err: any) {
        if (isMounted) { setError(err.message || 'Error fetching room'); setLoading(false); }
      }
    };

    fetchRoom();

    return () => {
      isMounted = false;
    };
  }, [roomId]);

  return { room, buildingId, floorId, loading, error };
}