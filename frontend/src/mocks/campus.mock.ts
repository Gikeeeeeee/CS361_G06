import type { ICampusService } from '../services/campus.interface';
import type { Building, Floor, Room, Facility } from '../shared/types/domain.types';
import { mockBuildings, mockFloors } from './campus.data';

export class CampusMockService implements ICampusService {
  private delay<T>(data: T, ms = 300): Promise<T> {
    return new Promise((resolve) => setTimeout(() => resolve(data), ms));
  }

  async getBuildings(): Promise<Building[]> {
    return this.delay(mockBuildings);
  }

  async getBuildingById(buildingId: string): Promise<Building | null> {
    const building = mockBuildings.find((b) => b.id === buildingId) || null;
    return this.delay(building);
  }

  async getFloorsByBuildingId(buildingId: string): Promise<Floor[]> {
    const building = mockBuildings.find((b) => b.id === buildingId);
    return this.delay(building?.floors || []);
  }

  async getFloorById(floorId: string): Promise<Floor | null> {
    const floor = mockFloors.find((f) => f.id === floorId) || null;
    return this.delay(floor);
  }

  async getRoomsByFloorId(floorId: string): Promise<Room[]> {
    const floor = mockFloors.find((f) => f.id === floorId);
    return this.delay(floor?.rooms || []);
  }

  async getFacilitiesByFloorId(floorId: string): Promise<Facility[]> {
    const floor = mockFloors.find((f) => f.id === floorId);
    return this.delay(floor?.facilities || []);
  }
}
