export interface FloorMetadata {
  id: string; // UUID
  name?: string;
  level?: number;
  floor_number?: number;
  buildingName?: string;
  floor_plan?: {
    type?: string;
    url?: string;
  };
  map?: {
    type?: string;
    url?: string;
  };
  rooms: Room[];
  facilities: Facility[];
}

export interface Room {
  id: string; // Matches SVG path/g ID
  name: string | { th?: string; en?: string };
  type: string;
  room_number?: string | null;
}

export interface Facility {
  id: string;
  type: string;
  name: string | { th?: string; en?: string };
}
