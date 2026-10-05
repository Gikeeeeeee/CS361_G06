import type { ICampusService } from './campus.interface';
import type { Building, BuildingListResponse, Floor, Room, Facility } from '../../../shared/types/domain.types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export class CampusApiService implements ICampusService {
  private async fetchApi<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${BASE_URL}/api/v1${endpoint}`);
    if (!response.ok) {
      throw new Error(`API fetch error for ${endpoint}: ${response.statusText}`);
    }
    return response.json();
  }

  async getBuildings(): Promise<BuildingListResponse> {
    return this.fetchApi<BuildingListResponse>('/buildings');
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

  async getRoomById(roomId: string): Promise<Room | null> {
    return this.fetchApi<Room | null>(`/rooms/${roomId}`);
  }

  async getFacilityById(facilityId: string): Promise<Facility | null> {
    return this.fetchApi<Facility | null>(`/facilities/${facilityId}`);
  }
}
