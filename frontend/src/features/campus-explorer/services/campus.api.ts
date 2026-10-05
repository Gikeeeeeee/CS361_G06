import type { ICampusService } from './campus.interface';
import type { Building, BuildingListResponse, Floor, Room, Facility } from '../../../shared/types/domain.types';
import { apiClient } from '../../../services/api/apiClient';

export class CampusApiService implements ICampusService {
  async getBuildings(): Promise<BuildingListResponse> {
    return apiClient.get<BuildingListResponse>('/buildings');
  }

  async getBuildingById(buildingId: string): Promise<Building | null> {
    try {
      return await apiClient.get<Building>(`/buildings/${buildingId}`);
    } catch (err) {
      console.error(`Failed to get building ${buildingId}:`, err);
      return null;
    }
  }

  async getFloorsByBuildingId(buildingId: string): Promise<Floor[]> {
    try {
      const bldg = await this.getBuildingById(buildingId);
      return bldg?.floors || [];
    } catch {
      return [];
    }
  }

  async getFloorById(floorId: string): Promise<Floor | null> {
    try {
      return await apiClient.get<Floor>(`/floors/${floorId}`);
    } catch (err) {
      console.error(`Failed to get floor ${floorId}:`, err);
      return null;
    }
  }

  async getRoomsByFloorId(floorId: string): Promise<Room[]> {
    try {
      const floor = await this.getFloorById(floorId);
      return floor?.rooms || [];
    } catch {
      return [];
    }
  }

  async getFacilitiesByFloorId(floorId: string): Promise<Facility[]> {
    try {
      const floor = await this.getFloorById(floorId);
      return floor?.facilities || [];
    } catch {
      return [];
    }
  }

  async getRoomById(roomId: string): Promise<Room | null> {
    try {
      const cleanId = roomId.includes('_') ? roomId.substring(roomId.indexOf('_') + 1) : roomId;
      return await apiClient.get<Room>(`/rooms/${cleanId}`);
    } catch (err) {
      console.error(`Failed to get room ${roomId}:`, err);
      return null;
    }
  }

  async getFacilityById(facilityId: string): Promise<Facility | null> {
    try {
      const cleanId = facilityId.includes('_') ? facilityId.substring(facilityId.indexOf('_') + 1) : facilityId;
      return await apiClient.get<Facility>(`/facilities/${cleanId}`);
    } catch (err) {
      console.error(`Failed to get facility ${facilityId}:`, err);
      return null;
    }
  }
}

