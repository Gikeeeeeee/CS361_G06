import { useState, useEffect } from 'react';
import type { RoomDetail, RoomStatus } from '../../../shared/types/domain.types';
import { mockBuildings } from '../../../data/buildingData';

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

    const fetchRoom = async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const parts = roomId.toLowerCase().split('-');
      if (parts.length < 2) {
        if (isMounted) { setError('Invalid room ID'); setLoading(false); }
        return;
      }
      
      const bid = parts[0];
      const roomNumber = parts[1];
      const building = mockBuildings[bid];
      
      if (!building) {
        if (isMounted) { setError('Building not found'); setLoading(false); }
        return;
      }
      
      for (const floor of building.floors) {
        const r = floor.rooms.find(r => 
          r.name.toLowerCase().includes(roomNumber) || 
          r.id.toLowerCase() === roomId.toLowerCase()
        );
        
        if (r) {
          if (isMounted) {
            const isLab = r.type === 'LAB';
            const isClassroom = r.type === 'CLASSROOM';
            const isOffice = r.type === 'OFFICE';
            
            let status: RoomStatus = 'AVAILABLE';
            if (r.id === 'room-4202' || r.id === 'room-202') status = 'IN_USE';
            else if (building.status === 'CLOSED') status = 'CLOSED';
            
            setRoom({
              ...r,
              department: isLab ? 'Faculty of Science and Technology' : isOffice ? 'Faculty Administration' : 'General Education Department',
              status,
              buildingCode: building.code,
              floorLevel: floor.floor_number,
              wingOrZone: floor.floor_number === 1 ? 'Ground Floor' : floor.floor_number === 2 ? 'West Wing' : 'East Wing',
              capacity: isLab ? 40 : isClassroom ? 60 : 15,
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
            });
            setLoading(false);
          }
          return;
        }
      }
      
      if (isMounted) { setError('Room not found'); setLoading(false); }
    };

    fetchRoom();

    return () => {
      isMounted = false;
    };
  }, [roomId]);

  return { room, loading, error };
}
