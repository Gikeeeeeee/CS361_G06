import { apiClient } from './api/apiClient';
import { endpoints } from './api/endpoints';
import type { BuildingItem, BuildingDetailResponse } from '../shared/types/api.contracts';

export const buildingService = {
  async getBuildings(): Promise<BuildingItem[]> {
    const response = await apiClient.get<{buildings: BuildingItem[]}>(endpoints.buildings.list());
    return response.buildings;
  },

  async getBuildingById(buildingId: string): Promise<BuildingDetailResponse> {
    return apiClient.get<BuildingDetailResponse>(endpoints.buildings.detail(buildingId));
  }
};
