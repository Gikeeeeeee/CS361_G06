// frontend/src/services/buildingService.ts
import { apiClient } from './api/apiClient';
import { endpoints } from './api/endpoints';
import type { BuildingListResponse, Building } from '../shared/types/domain.types';

export const buildingService = {
  // เส้นที่ 1: ดึงรายชื่อตึกทั้งหมด
  async getBuildings(): Promise<BuildingListResponse> {
    return apiClient.get<BuildingListResponse>(endpoints.buildings.list());
  },

  // เส้นที่ 2: ดึงรายละเอียดตึกรายตัวตาม ID
  async getBuildingById(buildingId: string): Promise<Building | null> {
    try {
      return await apiClient.get<Building>(endpoints.buildings.detail(buildingId));
    } catch (error) {
      console.error(`Failed to fetch building ${buildingId}:`, error);
      return null;
    }
  },
};