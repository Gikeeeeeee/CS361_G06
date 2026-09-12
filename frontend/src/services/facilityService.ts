import { apiClient } from './api/apiClient';
import { endpoints } from './api/endpoints';
import type { FacilityDetailResponse } from '../shared/types/api.contracts';

export const facilityService = {
  async getFacilityDetails(buildingId: string, floorId: string, facilityId: string): Promise<FacilityDetailResponse> {
    return apiClient.get<FacilityDetailResponse>(endpoints.facilities.detail(buildingId, floorId, facilityId));
  }
};