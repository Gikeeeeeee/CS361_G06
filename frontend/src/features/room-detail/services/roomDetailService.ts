import { mockBuildings } from '../../../data';
import type { RoomDetail, RoomStatus } from '../types/roomDetail.types';

export const roomDetailService = {
  getRoomById: async (roomId: string): Promise<RoomDetail | null> => {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 300));
    
    const parts = roomId.toLowerCase().split('-');
    if (parts.length < 2) return null;
    const buildingId = parts[0];
    const roomNumber = parts[1];
    
    const building = mockBuildings[buildingId];
    if (!building) return null;
    
    // Find room inside building floors
    for (const floor of building.floors) {
      const room = floor.rooms.find(r => 
        r.number.toLowerCase() === roomNumber || 
        r.id.toLowerCase() === roomId.toLowerCase() ||
        r.number.toLowerCase().endsWith(roomNumber)
      );
      
      if (room) {
        const isLab = room.type === 'LAB';
        const isClassroom = room.type === 'CLASSROOM';
        const isOffice = room.type === 'OFFICE';
        
        // Dynamic status based on building status or hardcoded rules for specific mock rooms
        let status: RoomStatus = 'AVAILABLE';
        if (room.number === '4202' || room.number === '202') {
          status = 'IN_USE';
        } else if (building.status === 'CLOSED') {
          status = 'CLOSED';
        }
        
        return {
          id: `${buildingId}-${room.number.toLowerCase()}`,
          number: `${building.code}-${room.number}`,
          name: room.name,
          type: room.type,
          department: isLab 
            ? 'Faculty of Science and Technology' 
            : isOffice 
            ? 'Faculty Administration' 
            : 'General Education Department',
          status,
          buildingCode: building.code,
          floorLevel: floor.level,
          wingOrZone: floor.level === 1 
            ? 'Ground Floor' 
            : floor.level === 2 
            ? 'West Wing' 
            : 'East Wing',
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
          svgId: room.svgId || `room-${room.number}`,
        };
      }
    }
    
    return null;
  }
};
