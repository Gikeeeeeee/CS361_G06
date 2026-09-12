import { apiClient } from './api/apiClient';
import { endpoints } from './api/endpoints';
import type { RoomDetailResponse } from '../shared/types/api.contracts';

export const roomService = {
  async getRoomDetails(buildingId: string, floorId: string, roomId: string): Promise<RoomDetailResponse> {
    return apiClient.get<RoomDetailResponse>(endpoints.rooms.detail(buildingId, floorId, roomId));
  }
};