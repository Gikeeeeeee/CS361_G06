// frontend/src/services/floorService.ts
import { apiClient } from './api/apiClient';
import { endpoints } from './api/endpoints';
import type { Floor } from '../shared/types/domain.types';

export const floorService = {
  // เส้นที่ 3: ดึงข้อมูลรายละเอียดชั้นตาม ID
  async getFloorById(floorId: string): Promise<Floor | null> {
    try {
      return await apiClient.get<Floor>(endpoints.floors.detail(floorId));
    } catch (error) {
      console.error(`Failed to fetch floor ${floorId}:`, error);
      return null;
    }
  },
};