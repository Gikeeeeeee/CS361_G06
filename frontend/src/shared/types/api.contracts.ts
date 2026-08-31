export interface BuildingItem {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface BuildingDetailResponse {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  floors: {
    id: string;
    floor_number: number;
  }[];
}

export interface FloorDetailResponse {
  id: string;
  floor_number: number;
  map: {
    type: string;
    url: string;
  };
  rooms: {
    id: string;
    name: string;
    type: string;
  }[];
  facilities: {
    id: string;
    name: string;
    type: string;
  }[];
}

export interface RoomDetailResponse {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  capacity?: number;
  opening_hours?: Record<string, string>;
}

export interface FacilityDetailResponse {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
}
