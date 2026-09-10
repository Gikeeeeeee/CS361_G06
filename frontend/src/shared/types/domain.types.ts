export type RoomType =
  | 'CLASSROOM'
  | 'MEETING_ROOM'
  | 'LAB'
  | 'OFFICE'
  | 'STORAGE'
  | 'RESTROOM'
  | 'COMMON_ROOM'
  | 'LANDMARK';

export type FacilityType =
  | 'STAIR'
  | 'ELEVATOR'
  | 'WATER_DISPENSER'
  | 'BENCH'
  | 'EMERGENCY_EXIT'
  | 'SECURITY_POST';

export interface LocalizedString {
  th: string;
  en: string;
}

export interface Building {
  id: string; // UUID
  code: string;
  name: LocalizedString;
  description: LocalizedString;
  image_key: string;
  opening_hours: string;
  latitude: number;
  longitude: number;
  // A building typically contains floors. Adding it here to reflect relationship,
  // or it could be fetched separately. We'll include it for the UI to consume easily if returned.
  floors?: Floor[]; 
}

export interface Floor {
  id: string; // UUID
  floor_number: number;
  floor_plan_key: string;
  // Relationships
  rooms?: Room[];
  facilities?: Facility[];
}

export interface Room {
  id: string; // UUID
  room_number: string | null;
  name: LocalizedString;
  type: RoomType;
  facilities: Record<string, boolean> | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schedule: Record<string, any> | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  event: Record<string, any> | null;
  image_key: string;
  latitude: number;
  longitude: number;
}

export interface Facility {
  id: string; // UUID
  name: LocalizedString;
  description: LocalizedString | null;
  type: FacilityType;
  latitude: number;
  longitude: number;
}
