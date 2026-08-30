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

export type RoomStatus = 'AVAILABLE' | 'IN_USE' | 'CLOSED';

export interface RoomAmenity {
  id: string;
  name: string;
  icon: string; // Name of the lucide-react icon to render
}

export interface RoomDetail {
  id: string; // e.g. 'lc4-201'
  number: string; // e.g. 'LC4-201'
  name: string; // e.g. 'Large Lecture Hall'
  type: FacilityType;
  department: string;
  status: RoomStatus;
  
  // Location Breadcrumbs
  buildingCode: string;
  floorLevel: number;
  wingOrZone: string;
  
  // Core Specs
  capacity: number;
  hasAirCon: boolean;
  hasPowerOutlets: boolean;
  
  // Additional Equipment
  amenities: RoomAmenity[];
  
  // Map link info
  buildingId: string; // e.g. 'lc4'
  svgId: string;
}
