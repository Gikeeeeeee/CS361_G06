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

    const fetchRoom = async () => {
      const parts = roomId.toLowerCase().split('-');
      if (parts.length < 2) {
        if (isMounted) { setError('Invalid room ID'); setLoading(false); }
        return;
      }
      
      const bid = parts[0];
      const targetRoomQuery = parts.slice(1).join('-'); // เช่น "101" หรือ "room-101"
      
      try {
        const building = await buildingService.getBuildingById(bid);
        if (!building || !building.floors) {
          if (isMounted) { setError('Building not found'); setLoading(false); }
          return;
        }

        // รูปแบบ ID ที่อาจจะเป็นไปได้ในการยิง API เส้น 4
        const possibleRoomIds = [
          targetRoomQuery,
          `room-${targetRoomQuery}`,
          targetRoomQuery.startsWith('room-') ? targetRoomQuery : `room-${targetRoomQuery}`
        ];
        const uniqueRoomIds = Array.from(new Set(possibleRoomIds));
        
        // วนลูปเช็คทุกชั้นในตึก และลองยิงหาห้องด้วยรูปแบบ ID ต่างๆ
        for (const floor of building.floors as any[]) {
          for (const rId of uniqueRoomIds) {
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
                } as RoomDetail);
                setLoading(false);
                return;
              }
            } catch (apiErr) {
              // ถ้าชั้นนี้หรือรหัสนี้ไม่ใช่ ให้ลองเช็คตัวเลือกถัดไปเรื่อยๆ
              continue;
            }
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