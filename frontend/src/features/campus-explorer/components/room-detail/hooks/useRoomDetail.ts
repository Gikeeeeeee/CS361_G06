import { useState, useEffect } from 'react';
import type { Room, Floor, Building } from '../../../../../shared/types/domain.types';
import { campusService } from '../../../services';

export function useRoomDetail(roomId: string | undefined) {
  const [room, setRoom] = useState<Room | null>(null);
  const [floor, setFloor] = useState<Floor | null>(null);
  const [building, setBuilding] = useState<Building | { id: string; code: string; name: any } | null>(null);
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
        const cleanId = roomId.includes('_') ? roomId.substring(roomId.indexOf('_') + 1) : roomId;
        const r = await campusService.getRoomById(cleanId);
        
        if (isMounted) {
          if (r) {
            setRoom(r);
            const bldg = (r as any).building || null;
            setBuilding(bldg);

            const floorInfo = (r as any).floor;
            if (floorInfo?.id) {
              try {
                const floorDetails = await campusService.getFloorById(floorInfo.id);
                if (isMounted) {
                  setFloor(floorDetails || floorInfo);
                }
              } catch (floorErr) {
                console.warn('Failed to fetch full floor details:', floorErr);
                if (isMounted) {
                  setFloor(floorInfo);
                }
              }
            } else {
              setFloor(floorInfo || null);
            }
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

  return { room, building, floorId: floor?.id, floor, loading, error };
}