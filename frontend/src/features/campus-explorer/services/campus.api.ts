import type { ICampusService } from './campus.interface';
import type { Building, BuildingListResponse, Floor, Room, Facility } from '../../../shared/types/domain.types';
import { apiClient } from '../../../services/api/apiClient';

export class CampusApiService implements ICampusService {
  private async fetchApi<T>(endpoint: string): Promise<T> {
    return apiClient.get<T>(endpoint);
  }

  async getBuildings(): Promise<BuildingListResponse> {
    return this.fetchApi<BuildingListResponse>('/buildings');
  }

  async getBuildingById(buildingId: string): Promise<Building | null> {
    try {
      return await this.fetchApi<Building | null>(`/buildings/${buildingId}`);
    } catch {
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
      return await this.fetchApi<Floor | null>(`/floors/${floorId}`);
    } catch {
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
      return await this.fetchApi<Room | null>(`/rooms/${cleanId}`);
    } catch {
      return null;
    }
  }

  async getFacilityById(facilityId: string): Promise<Facility | null> {
    try {
      const cleanId = facilityId.includes('_') ? facilityId.substring(facilityId.indexOf('_') + 1) : facilityId;
      return await this.fetchApi<Facility | null>(`/facilities/${cleanId}`);
    } catch {
      return null;
    }
  }

  async getBuildingRoomCounts(): Promise<Record<string, number>> {
    if (cachedBuildingRoomCounts) {
      return cachedBuildingRoomCounts;
    }

    try {
      const { buildings } = await this.getBuildings();
      if (!buildings || buildings.length === 0) {
        return { lc3: 97, lc4: 36 };
      }

      const counts: Record<string, number> = {};

      await Promise.all(
        buildings.map(async (b) => {
          try {
            const bDetail = await this.getBuildingById(b.id);
            if (!bDetail?.floors) {
              counts[b.id.toLowerCase()] = 0;
              return;
            }

            const floorDetails = await Promise.all(
              bDetail.floors.map((f) => this.getFloorById(f.id))
            );

            const roomTotal = floorDetails.reduce(
              (acc, f) => acc + (f?.rooms?.length || 0),
              0
            );

            counts[b.id.toLowerCase()] = roomTotal;
          } catch {
            counts[b.id.toLowerCase()] = b.id.toLowerCase() === 'lc3' ? 97 : 36;
          }
        })
      );

      cachedBuildingRoomCounts = counts;
      return counts;
    } catch {
      return { lc3: 97, lc4: 36 };
    }
  }
}

let cachedBuildingRoomCounts: Record<string, number> | null = null;
