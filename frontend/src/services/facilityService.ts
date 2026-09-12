// frontend/src/services/facilityService.ts
import { apiClient } from './api/apiClient';
import { endpoints } from './api/endpoints';
import type { FacilityDetailResponse } from '../shared/types/api.contracts';

export const facilityService = {
  // เส้นที่ 5: ดึงข้อมูลรายละเอียดสิ่งอำนวยความสะดวกรายตัวตาม ID
  async getFacilityById(facilityId: string): Promise<FacilityDetailResponse | null> {
    try {
      return await apiClient.get<FacilityDetailResponse>(endpoints.facilities.detail(facilityId));
    } catch (error) {
      console.error(`Failed to fetch facility ${facilityId}:`, error);
      return null;
    }
  },
};