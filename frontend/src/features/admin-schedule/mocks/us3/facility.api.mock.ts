export interface BuildingMock {
  id: string;
  name: string;
}

export interface FloorMock {
  id: string;
  building_id: string;
  name: string;
  level: number;
}

export interface RoomMock {
  id: string;
  floor_id: string;
  name: string;
  capacity: number;
}

export const mockBuildings: BuildingMock[] = [
  { id: "b1", name: "Lumen Center (LC4)" },
  { id: "b2", name: "Gymnasium" }
];

export const mockFloors: FloorMock[] = [
  { id: "f1", building_id: "b1", name: "Floor 1 (Ground)", level: 1 },
  { id: "f2", building_id: "b1", name: "Floor 2", level: 2 },
  { id: "f3", building_id: "b2", name: "Main Arena", level: 1 }
];

export const mockRooms: RoomMock[] = [
  { id: "330e8400-e29b-41d4-a716-446655440030", floor_id: "f1", name: "Room LC4-101", capacity: 120 },
  { id: "330e8400-e29b-41d4-a716-446655440031", floor_id: "f1", name: "Room LC4-102", capacity: 60 },
  { id: "r3", floor_id: "f3", name: "GYM-A", capacity: 500 }
];

export const facilityServiceMock = {
  getBuildings: async (): Promise<BuildingMock[]> => {
    return new Promise(resolve => setTimeout(() => resolve(mockBuildings), 300));
  },
  getFloorsByBuilding: async (buildingId: string): Promise<FloorMock[]> => {
    return new Promise(resolve => setTimeout(() => resolve(mockFloors.filter(f => f.building_id === buildingId)), 300));
  },
  getRoomsByFloor: async (floorId: string): Promise<RoomMock[]> => {
    return new Promise(resolve => setTimeout(() => resolve(mockRooms.filter(r => r.floor_id === floorId)), 300));
  }
};
