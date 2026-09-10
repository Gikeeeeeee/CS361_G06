import type { ICampusService } from './campus.interface';
import type { Building, Floor, Room, Facility } from '../shared/types/domain.types';

export class CampusApiService implements ICampusService {
  private async fetchApi<T>(endpoint: string): Promise<T> {
    const response = await fetch(`/api/v1${endpoint}`);
    if (!response.ok) {
      throw new Error(`API fetch error for ${endpoint}: ${response.statusText}`);
    }
    return response.json();
  }

  async getBuildings(): Promise<Building[]> {
    return this.fetchApi<Building[]>('/buildings');
  }

  async getBuildingById(buildingId: string): Promise<Building | null> {
    return this.fetchApi<Building | null>(`/buildings/${buildingId}`);
  }

  async getFloorsByBuildingId(buildingId: string): Promise<Floor[]> {
    return this.fetchApi<Floor[]>(`/buildings/${buildingId}/floors`);
  }

  async getFloorById(floorId: string): Promise<Floor | null> {
    return this.fetchApi<Floor | null>(`/floors/${floorId}`);
  }

  async getRoomsByFloorId(floorId: string): Promise<Room[]> {
    return this.fetchApi<Room[]>(`/floors/${floorId}/rooms`);
  }

  async getFacilitiesByFloorId(floorId: string): Promise<Facility[]> {
    return this.fetchApi<Facility[]>(`/floors/${floorId}/facilities`);
  }
}
