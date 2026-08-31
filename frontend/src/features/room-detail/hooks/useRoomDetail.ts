import { useState, useEffect } from 'react';
import type { RoomDetail } from '../../../shared/types/domain.types';
import { buildingService } from '../../../services/buildingService';
import { roomService } from '../../../services/roomService';

export function useRoomDetail(roomId: string | undefined) {
  const [room, setRoom] = useState<RoomDetail | null>(null);
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
        const building = await buildingService.getBuildingById(bid);
        if (!building || !building.floors) {
          if (isMounted) { setError('Building not found'); setLoading(false); }
          return;
        }

        // Guess the floor number from the room query to prioritize it
        const guessedFloor = guessFloorNumber(targetRoomQuery);
        
        // Sort floors so the guessed floor is checked first
        const sortedFloors = [...building.floors].sort((a, b) => {
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
            const r = await roomService.getRoomDetails(bid, floor.id, rId);
            
            if (r && isMounted) {
              const isLab = r.type === 'LAB';
              const isClassroom = r.type === 'CLASSROOM';
              const isOffice = r.type === 'OFFICE';
              
              setRoom({
                ...r,
                number: r.name || rId.replace('room-', '').toUpperCase(),
                department: isLab ? 'Faculty of Science and Technology' : isOffice ? 'Faculty Administration' : 'General Education Department',
                status: 'AVAILABLE',
                buildingCode: building.name,
                floorLevel: floor.floor_number,
                wingOrZone: floor.floor_number === 1 ? 'Ground Floor' : floor.floor_number === 2 ? 'West Wing' : 'East Wing',
                capacity: r.capacity || (isLab ? 40 : isClassroom ? 60 : 15),
                hasAirCon: true,
                hasPowerOutlets: !isClassroom,
                amenities: isLab ? [
                  { id: 'am-1', name: 'Chemical Fume Hood', icon: 'Shield' },
                  { id: 'am-2', name: 'Emergency Eyewash', icon: 'Heart' },
                  { id: 'am-3', name: 'Lab Bench Equipment', icon: 'Wrench' }
                ] : isClassroom ? [
                  { id: 'am-1', name: 'Projector', icon: 'Projector' },
                  { id: 'am-2', name: 'Whiteboard', icon: 'Square' },
                  { id: 'am-3', name: 'Audio System', icon: 'Speaker' }
                ] : [
                  { id: 'am-1', name: 'Desk Phone', icon: 'Phone' },
                  { id: 'am-2', name: 'Meeting Table', icon: 'Grid' }
                ],
                buildingId: building.id,
                floorId: floor.id,
              } as RoomDetail);
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

  return { room, loading, error };
}