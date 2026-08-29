export type FacilityType = 'LAB' | 'CLASSROOM' | 'OFFICE' | 'RESTROOM' | 'STAIRS' | 'ELEVATOR' | 'OTHER';

export interface Facility {
  id: string;
  name: string;
  type: FacilityType;
  svgId?: string;
}

export interface Room {
  id: string;
  number: string;
  name: string;
  type: FacilityType;
  svgId?: string;
}

export interface Floor {
  id: string;
  level: number;
  name: string;
  rooms: Room[];
  facilities: Facility[];
}

export interface Building {
  id: string;
  code: string;
  name: string;
  description: string;
  imageUrl: string;
  status: 'OPEN' | 'CLOSED' | 'MAINTENANCE';
  operatingHours: string;
  floors: Floor[];
  stats: {
    totalFloors: number;
    totalRooms: number;
    availableFacilities: FacilityType[];
  };
}
