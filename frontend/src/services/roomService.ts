// frontend/src/services/roomService.ts
import { apiClient } from './api/apiClient';
import { endpoints } from './api/endpoints';
import type { RoomDetailResponse } from '../shared/types/api.contracts';

export const roomService = {
  // เส้นที่ 4: ดึงข้อมูลรายละเอียดห้องรายตัวตาม ID
  async getRoomById(roomId: string): Promise<RoomDetailResponse | null> {
    try {
      return await apiClient.get<RoomDetailResponse>(endpoints.rooms.detail(roomId));
    } catch (error) {
      console.error(`Failed to fetch room ${roomId}:`, error);
      return null;
    }
  },
};