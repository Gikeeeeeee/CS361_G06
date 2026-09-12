// frontend/src/services/campus.api.ts
import type { ICampusService } from './campus.interface';
import type { Building, BuildingListResponse, Floor, Room, Facility } from '../shared/types/domain.types';
import { buildingService } from './buildingService';
import { floorService } from './floorService';

export class CampusApiService implements ICampusService {
  
  async getBuildings(): Promise<BuildingListResponse> {
    return buildingService.getBuildings();
  }

  async getBuildingById(buildingId: string): Promise<Building | null> {
    return buildingService.getBuildingById(buildingId);
  }

  async getFloorsByBuildingId(buildingId: string): Promise<Floor[]> {
    const building = await buildingService.getBuildingById(buildingId);
    return building?.floors || [];
  }

  async getFloorById(floorId: string): Promise<Floor | null> {
    return floorService.getFloorById(floorId);
  }

  async getRoomsByFloorId(floorId: string): Promise<Room[]> {
    const floor = await floorService.getFloorById(floorId);
    return (floor?.rooms as Room[]) || [];
  }

  async getFacilitiesByFloorId(floorId: string): Promise<Facility[]> {
    const floor = await floorService.getFloorById(floorId);
    return (floor?.facilities as Facility[]) || [];
  }
}