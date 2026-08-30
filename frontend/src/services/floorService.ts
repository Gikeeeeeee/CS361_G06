import { apiClient } from './api/apiClient';
import { endpoints } from './api/endpoints';
import type { FloorDetailResponse } from '../shared/types/api.contracts';

export const floorService = {
  async getFloorDetails(buildingId: string, floorId: string): Promise<FloorDetailResponse> {
    return apiClient.get<FloorDetailResponse>(endpoints.floors.detail(buildingId, floorId));
  }
};
