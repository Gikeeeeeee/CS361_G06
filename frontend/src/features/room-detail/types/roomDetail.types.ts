import type { FacilityType } from '../../../shared/types/building.types';

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
