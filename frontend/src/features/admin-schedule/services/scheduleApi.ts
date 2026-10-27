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

const inFlightRequests = new Map<string, Promise<any>>();

async function fetchJsonWithDedup<T>(url: string): Promise<T> {
  const existing = inFlightRequests.get(url);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }
      return await response.json();
    } finally {
      inFlightRequests.delete(url);
    }
  })();

  inFlightRequests.set(url, promise);
  return promise;
}

export const scheduleApi = {
  getAllSchedules: async (nextToken?: string): Promise<import('../types/schedule.types').GlobalScheduleResponse> => {
    const url = new URL(`${API_BASE_URL}/api/v1/schedules`);

    if (nextToken) {
      url.searchParams.append('nextToken', nextToken);
    }

    return fetchJsonWithDedup<import('../types/schedule.types').GlobalScheduleResponse>(url.toString());
  },

  getSchedulesByType: async (type: string, nextToken?: string): Promise<import('../types/schedule.types').GlobalScheduleResponse> => {
    const url = new URL(`${API_BASE_URL}/api/v1/schedules`);

    url.searchParams.append('type', type);

    if (nextToken) {
      url.searchParams.append('nextToken', nextToken);
    }

    return fetchJsonWithDedup<import('../types/schedule.types').GlobalScheduleResponse>(url.toString());
  },

  getBuildings: async (): Promise<{ buildings: Building[] }> => {
    return fetchJsonWithDedup<{ buildings: Building[] }>(`${API_BASE_URL}/api/v1/buildings`);
  },

  getBuildingFloors: async (buildingId: string): Promise<{ floors: Floor[] }> => {
    return fetchJsonWithDedup<{ floors: Floor[] }>(`${API_BASE_URL}/api/v1/buildings/${buildingId}`);
  },

  getFloorRooms: async (floorId: string, label?: string): Promise<{ rooms: Room[] }> => {
    const query = label ? `?floor=${encodeURIComponent(label)}` : '';
    return fetchJsonWithDedup<{ rooms: Room[] }>(`${API_BASE_URL}/api/v1/floors/${floorId}${query}`);
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
      visibility: data.visibility,
    };

    const token = localStorage.getItem('ku_long_auth_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/rooms/${roomId}/schedules/${scheduleId}`, {
      method: 'PUT',
      headers,
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
    const token = localStorage.getItem('ku_long_auth_token');
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/rooms/${roomId}/schedules/${scheduleId}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to delete schedule: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }
    return response.text();
  },

  getScheduleById: async (roomId: string, scheduleId: string): Promise<any> => {
    const cleanRoomId = roomId.includes('_') ? roomId.substring(roomId.indexOf('_') + 1) : roomId;
    const response = await fetch(`${API_BASE_URL}/api/v1/rooms/${cleanRoomId}/schedules/${scheduleId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch schedule: ${response.statusText}`);
    }
    return response.json();
  }
};
