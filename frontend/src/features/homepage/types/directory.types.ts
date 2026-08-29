// สำหรับข้อมูลหมวดหมู่และสถานะ
export type RoomCategory = 'All' | 'Classrooms' | 'Labs' | 'Offices';
export type RoomStatus = 'AVAILABLE' | 'OCCUPIED';

// Type สำหรับระดับห้องพัก (เพื่อแก้แดงใน rooms.mock.ts)
export interface RoomItem {
  id: string;
  code: string;
  name: string;
  building: string;
  category: RoomCategory;
  status: RoomStatus;
  type: 'lab' | 'lecture' | 'office';
}

// Type สำหรับระดับอาคาร
export interface BuildingItem {
  id: string;
  code: string;
  name: string;
  totalRooms: number;
  availableRooms: number;
  type: 'academic' | 'facility' | 'office';
}