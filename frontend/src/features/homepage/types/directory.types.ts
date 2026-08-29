export type RoomCategory = 'All' | 'Classrooms' | 'Labs' | 'Offices';
export type BuildingFilter = 'LC.4' | 'LC.3' | 'All';
export type RoomStatus = 'AVAILABLE' | 'OCCUPIED';

export interface RoomItem {
  id: string;
  code: string;
  name: string;
  building: string;
  category: RoomCategory;
  status: RoomStatus;
  type: 'lab' | 'lecture' | 'office';
}