export type ScheduleType = 'COURSE' | 'EXAM' | 'ACTIVITY';
export type ScheduleStatus = 'CONFIRM' | 'CANCELLED';

export interface ScheduleItem {
  id: string;
  type: ScheduleType;
  title: string;
  description: string;
  course_code: string | null;
  organizer: string;
  start_at: string;
  end_at: string;
  time_zone: string;
  recurrence_rule: string | null;
  room_id: string;
  status: ScheduleStatus;
}

export interface ScheduleResponse {
  data: ScheduleItem[];
  meta: {
    room_id: string;
    type: string;
    count: number;
  };
}

export interface GlobalScheduleResponse {
  data: ScheduleItem[];
  meta?: {
    count: number;
    next_token: string | null;
  };
}

export interface UpdateSchedulePayload {
  type: ScheduleType;
  title: string;
  description: string;
  course_code: string | null;
  organizer: string;
  start_at: string;
  end_at: string;
  time_zone: string;
  recurrence_rule: string | null;
  status: ScheduleStatus;
}
