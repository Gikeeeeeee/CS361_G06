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

    // Heuristic helper to guess floor level from room ID
    const guessFloorNumber = (id: string): number | null => {
      const match = id.match(/\d+/);
      if (!match) return null;
      const numStr = match[0];
      if (numStr.length >= 3) {
        return parseInt(numStr[0], 10);
      } else if (numStr.length === 1 || numStr.length === 2) {
        return parseInt(numStr, 10);
      }
      return null;
    };

    const fetchRoom = async () => {
      const parts = roomId.toLowerCase().split('-');
      if (parts.length < 2) {
        if (isMounted) { setError('Invalid room ID'); setLoading(false); }
        return;
      }
      
      const bid = parts[0];
      const targetRoomQuery = parts.slice(1).join('-'); // e.g. "room-lab102" or "lab102"
      const rId = targetRoomQuery.startsWith('room-') ? targetRoomQuery : `room-${targetRoomQuery}`;
      
      try {
        const building = await campusService.getBuildingById(bid);
        if (!building) {
          if (isMounted) { setError('Building not found'); setLoading(false); }
          return;
        }

        // Guess the floor number from the room query to prioritize it
        const guessedFloor = guessFloorNumber(targetRoomQuery);
        
        const floors = await campusService.getFloorsByBuildingId(bid);
        
        // Sort floors so the guessed floor is checked first
        const sortedFloors = [...floors].sort((a, b) => {
          if (guessedFloor !== null) {
            const aMatch = a.floor_number === guessedFloor;
            const bMatch = b.floor_number === guessedFloor;
            if (aMatch && !bMatch) return -1;
            if (!aMatch && bMatch) return 1;
          }
          return a.floor_number - b.floor_number;
        });
        
        // Check sorted floors
        for (const floor of sortedFloors) {
          if (!isMounted) return;
          try {
            const rooms = await campusService.getRoomsByFloorId(floor.id);
            const r = rooms.find(room => room.id === rId);
            
            if (r && isMounted) {
              setRoom(r);
              setBuildingId(bid);
              setFloorId(floor.id);
              setLoading(false);
              return;
            }
          } catch (apiErr) {
            // Try next floor
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