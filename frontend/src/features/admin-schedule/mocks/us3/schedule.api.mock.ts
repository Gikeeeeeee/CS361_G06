import type { ScheduleItem, ScheduleResponse, UpdateSchedulePayload } from '../../types/schedule.types';

export let mockSchedulesData: ScheduleItem[] = [
  {
    id: "550e8400-e29b-41d4-a716-446655440050",
    type: "EXAM",
    title: "CS361 Midterm Exam",
    description: "Midterm examination",
    course_code: "CS361",
    organizer: "Aj. Example",
    start_at: "2026-10-20T09:00:00+07:00",
    end_at: "2026-10-20T12:00:00+07:00",
    time_zone: "Asia/Bangkok",
    recurrence_rule: null,
    room_id: "330e8400-e29b-41d4-a716-446655440030",
    status: "CONFIRM"
  },
  {
    id: "660e8400-e29b-41d4-a716-446655440051",
    type: "COURSE",
    title: "Algorithms & Complexity",
    description: "Weekly lecture",
    course_code: "CS361",
    organizer: "Aj. Example",
    start_at: "2026-09-16T10:00:00+07:00",
    end_at: "2026-09-16T11:30:00+07:00",
    time_zone: "Asia/Bangkok",
    recurrence_rule: "FREQ=WEEKLY;BYDAY=MO,WE;COUNT=15",
    room_id: "330e8400-e29b-41d4-a716-446655440030",
    status: "CONFIRM"
  },
  {
    id: "770e8400-e29b-41d4-a716-446655440052",
    type: "EVENT",
    title: "Dept. Distinguished Seminar",
    description: "Guest Speaker Series",
    course_code: null,
    organizer: "CS Department",
    start_at: "2026-12-15T14:00:00+07:00",
    end_at: "2026-12-15T16:00:00+07:00",
    time_zone: "Asia/Bangkok",
    recurrence_rule: null,
    room_id: "330e8400-e29b-41d4-a716-446655440031",
    status: "CONFIRM"
  }
];

export const scheduleServiceMock = {
  fetchSchedulesByRoom: async (roomId: string, params?: { start?: string; end?: string; type?: string }): Promise<ScheduleResponse> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        let filtered = mockSchedulesData.filter(s => s.room_id === roomId);
        
        if (params?.type && params.type !== 'ALL') {
          filtered = filtered.filter(s => s.type === params.type);
        }
        
        // Simple date filtering (mock)
        if (params?.start) {
          filtered = filtered.filter(s => new Date(s.start_at) >= new Date(params.start!));
        }
        if (params?.end) {
          filtered = filtered.filter(s => new Date(s.end_at) <= new Date(params.end!));
        }

        resolve({
          data: filtered,
          meta: {
            room_id: roomId,
            type: params?.type || 'ALL',
            count: filtered.length
          }
        });
      }, 500); // 500ms delay
    });
  },

  updateSchedule: async (roomId: string, scheduleId: string, payload: UpdateSchedulePayload): Promise<{ status: string }> => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const index = mockSchedulesData.findIndex(s => s.id === scheduleId && s.room_id === roomId);
        if (index === -1) {
          return reject(new Error('Schedule not found'));
        }
        mockSchedulesData[index] = { ...mockSchedulesData[index], ...payload };
        resolve({ status: "updated" });
      }, 500);
    });
  },

  deleteSchedule: async (roomId: string, scheduleId: string): Promise<{ status: string }> => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const index = mockSchedulesData.findIndex(s => s.id === scheduleId && s.room_id === roomId);
        if (index === -1) {
          return reject(new Error('Schedule not found'));
        }
        mockSchedulesData = mockSchedulesData.filter(s => s.id !== scheduleId);
        resolve({ status: "deleted" });
      }, 500);
    });
  }
};
