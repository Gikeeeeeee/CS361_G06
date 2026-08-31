export interface FloorMetadata {
  id: string;
  name?: string;
  level?: number;
  floor_number?: number;
  buildingName?: string;
  map: {
    type: "svg";
    url: string;
  };
  rooms: Room[];
  facilities: Facility[];
}

export interface Room {
  id: string; // Should match SVG path/g ID
  name: string;
  type: string;
}

export interface Facility {
  id: string;
  type: string;
  name: string;
}
