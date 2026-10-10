import { apiClient, ApiError } from '../../../services/api/apiClient';

export interface CreateSchedulePayload {
  type: 'COURSE' | 'EXAM' | 'ACTIVITY';
  title: string;
  start_at: string;
  end_at: string;
  time_zone: string;
  status: 'CONFIRM' | 'TENTATIVE' | 'CANCELLED';
  course_code?: string;
  organizer?: string;
  description?: string;
  recurrence_rule?: string;
}

export interface RoomOption {
  id: string;
  name: string;
  buildingCode: string;
  buildingName: string;
  floorNumber: number;
}

/**
 * US2: Create Single Schedule Manually
 * @param roomId - ID of the room to book
 * @param data - Schedule payload
 */
export async function createManualSchedule(roomId: string, data: CreateSchedulePayload) {
  try {
    const endpoint = `/api/v1/rooms/${roomId}/schedules`;
    const response = await apiClient.post(endpoint, data);
    return { status: 201, body: response };
  } catch (error: any) {
    if (error instanceof ApiError) {
      return { status: error.status, body: error.body };
    }
    return {
      status: 500,
      body: { error: { message: error?.message || 'Network error, please try again.' } },
    };
  }
}

/**
 * Helper for US2: Fetch all available rooms across buildings for the room selection dropdown
 */
export async function getAvailableRooms(): Promise<RoomOption[]> {
  try {
    const buildingsRes = await apiClient.get<{
      buildings: Array<{ id: string; code: string; name: { th: string; en: string } }>;
    }>('/buildings');
    const buildings = buildingsRes?.buildings || [];
    const roomsList: RoomOption[] = [];

    // Fetch details for each building
    await Promise.all(
      buildings.map(async (building) => {
        try {
          const detailRes = await apiClient.get<{
            floors?: Array<{ id: string; floor_number: number }>;
          }>(`/buildings/${building.code || building.id}`);
          const floors = detailRes?.floors || [];

          await Promise.all(
            floors.map(async (floor) => {
              try {
                const floorRes = await apiClient.get<{
                  rooms?: Array<{ id: string; name: { th: string; en: string }; type: string }>;
                }>(`/floors/${floor.id}`);
                const rooms = floorRes?.rooms || [];

                rooms.forEach((r) => {
                  roomsList.push({
                    id: r.id,
                    name: r.name?.en || r.name?.th || r.id,
                    buildingCode: building.code || building.id,
                    buildingName: building.name?.en || building.name?.th,
                    floorNumber: floor.floor_number,
                  });
                });
              } catch {
                // Ignore individual floor error
              }
            })
          );
        } catch {
          // Ignore individual building error
        }
      })
    );

    return roomsList.sort(
      (a, b) => a.buildingCode.localeCompare(b.buildingCode) || a.name.localeCompare(b.name)
    );
  } catch (err) {
    console.warn('[ManualScheduleService] Failed to fetch rooms from API, fallback to manual input', err);
    return [];
  }
}
