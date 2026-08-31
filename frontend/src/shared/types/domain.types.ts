import type { RoomDetailResponse, FacilityDetailResponse } from './api.contracts';

export type RoomStatus = 'AVAILABLE' | 'IN_USE' | 'CLOSED';

export interface RoomDetail extends RoomDetailResponse {
  // Extended fields used specifically in UI components
  department?: string;
  status?: RoomStatus;
  buildingCode?: string;
  floorLevel?: number;
  wingOrZone?: string;
  hasAirCon?: boolean;
  hasPowerOutlets?: boolean;
  amenities?: { id: string; name: string; icon: string }[];
  buildingId?: string;
  floorId?: string;
  number?: string;
  imageUrl?: string;
}

export interface Facility extends FacilityDetailResponse {
  icon?: string;
  svgId?: string;
}

export interface Floor {
  id: string;
  floor_number: number;
  name?: string;
  map: {
    type: string;
    url: string;
  };
  rooms: RoomDetail[];
  facilities: Facility[];
}

export interface Building {
  id: string;
  code: string;
  name: string;
  description?: string;
  imageUrl?: string;
  status: 'OPEN' | 'CLOSED';
  opening_hours: Record<string, string>;
  latitude: number;
  longitude: number;
  stats?: {
    totalFloors: number;
    totalRooms: number;
    availableFacilities: string[];
  };
  floors: Floor[];
}
