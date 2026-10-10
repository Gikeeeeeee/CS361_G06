import type { ScheduleItem } from '../types/schedule.types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export interface FetchSchedulesResponse {
  data: ScheduleItem[];
  meta: {
    room_id: string;
    type?: string;
    count: number;
  };
}

export interface Building {
  id: string;
  code: string;
  name: {
    th: string;
    en: string;
  };
}

export interface Floor {
  id: string;
  floor_number: number;
}

export interface Room {
  id: string;
  room_number: string;
  name: {
    th: string;
    en: string;
  };
}

export const scheduleApi = {
  getAllSchedules: async (nextToken?: string): Promise<import('../types/schedule.types').GlobalScheduleResponse> => {
    const url = new URL(`${API_BASE_URL}/api/v1/schedules`);

    if (nextToken) {
      url.searchParams.append('nextToken', nextToken);
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Failed to fetch all schedules: ${response.statusText}`);
    }
    return response.json();
  },

  getSchedulesByType: async (type: string, nextToken?: string): Promise<import('../types/schedule.types').GlobalScheduleResponse> => {
    const url = new URL(`${API_BASE_URL}/api/v1/schedules`);

    url.searchParams.append('type', type);

    if (nextToken) {
      url.searchParams.append('nextToken', nextToken);
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Failed to fetch schedules by type: ${response.statusText}`);
    }
    return response.json();
  },

  getBuildings: async (): Promise<{ buildings: Building[] }> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/buildings`);
    if (!response.ok) {
      throw new Error(`Failed to fetch buildings: ${response.statusText}`);
    }
    return response.json();
  },

  getBuildingFloors: async (buildingId: string): Promise<{ floors: Floor[] }> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/buildings/${buildingId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch building floors: ${response.statusText}`);
    }
    return response.json();
  },

  getFloorRooms: async (floorId: string): Promise<{ rooms: Room[] }> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/floors/${floorId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch floor rooms: ${response.statusText}`);
    }
    return response.json();
  },

  getRoom: async (roomId: string): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/rooms/${roomId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch room: ${response.statusText}`);
    }
    return response.json();
  },

  getSchedulesByRoom: async (
    roomId: string,
    params?: { start?: string; end?: string; type?: string }
  ): Promise<FetchSchedulesResponse> => {
    const url = new URL(`${API_BASE_URL}/api/v1/schedules`);

    url.searchParams.append('roomId', roomId);
    if (params?.start) url.searchParams.append('start', params.start);
    if (params?.end) url.searchParams.append('end', params.end);
    if (params?.type) url.searchParams.append('type', params.type);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Failed to fetch schedules: ${response.statusText}`);
    }
    return response.json();
  },

  updateSchedule: async (roomId: string, scheduleId: string, data: Partial<ScheduleItem>): Promise<string> => {
    const payload = {
      type: data.type,
      title: data.title,
      description: data.description,
      course_code: data.course_code,
      organizer: data.organizer,
      start_at: data.start_at,
      end_at: data.end_at,
      time_zone: data.time_zone,
      recurrence_rule: data.recurrence_rule,
      status: data.status,
    };

    const response = await fetch(`${API_BASE_URL}/api/v1/rooms/${roomId}/schedules/${scheduleId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to update schedule: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }
    return response.text();
  },

  deleteSchedule: async (roomId: string, scheduleId: string): Promise<string> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/rooms/${roomId}/schedules/${scheduleId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete schedule: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }
    return response.text();
  }
};
