import { useState, useEffect } from 'react';
import type { Room, Floor } from '../../../../../shared/types/domain.types';
import { campusService } from '../../../services';

export function useRoomDetail(roomId: string | undefined) {
  const [room, setRoom] = useState<Room | null>(null);
  const [floor, setFloor] = useState<Floor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) {
      setError('Room ID is required');
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchRoom = async () => {
      setLoading(true);
      setError(null);

      try {
        const r = await campusService.getRoomById(roomId);
        
        if (isMounted) {
          if (r) {
            setRoom(r);
            // We set floor to null since the real API room endpoint doesn't return floor context
            setFloor(null);
          } else {
            setError('Room not found');
          }
        }
      } catch (err: any) {
        if (isMounted) {
          console.error(`Failed to fetch room ${roomId}:`, err);
          setError(err.message || 'Error fetching room');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchRoom();

    return () => {
      isMounted = false;
    };
  }, [roomId]);

  return { room, buildingId: null, floorId: null, floor, loading, error };
}