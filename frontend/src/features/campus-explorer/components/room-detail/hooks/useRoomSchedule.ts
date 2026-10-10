import { useState, useEffect } from 'react';
import { apiClient } from '../../../../../services/api/apiClient';

export interface ScheduleEvent {
  id: string;
  room_id: string;
  type: 'COURSE' | 'EXAM' | 'ACTIVITY';
  title: string;
  description?: string;
  organizer?: string;
  start_at: string;
  end_at: string;
  course_code?: string;
}

export function useRoomSchedule(roomId: string, type?: 'COURSE' | 'EXAM' | 'ACTIVITY', startDate?: Date, endDate?: Date) {
  const [schedules, setSchedules] = useState<ScheduleEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId || !startDate || !endDate) return;

    let isMounted = true;
    const fetchSchedule = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Clean ID logic in case it's in format "lc3_uuid"
        const cleanId = roomId.includes('_') ? roomId.substring(roomId.indexOf('_') + 1) : roomId;
        
        // Format to ISO 8601 with +07:00
        const formatISOWithOffset = (date: Date) => {
          const pad = (n: number) => String(n).padStart(2, '0');
          const Y = date.getFullYear();
          const M = pad(date.getMonth() + 1);
          const D = pad(date.getDate());
          const H = pad(date.getHours());
          const m = pad(date.getMinutes());
          const s = pad(date.getSeconds());
          return `${Y}-${M}-${D}T${H}:${m}:${s}+07:00`;
        };

        const query = new URLSearchParams({
          start: formatISOWithOffset(startDate),
          end: formatISOWithOffset(endDate),
        });

        if (type) {
          query.append('type', type);
        }

        const data = await apiClient.get<ScheduleEvent[]>(`/rooms/${cleanId}/schedules?${query.toString()}`);
        
        if (isMounted) {
          if (Array.isArray(data)) {
            setSchedules(data);
          } else if (data && typeof data === 'object' && Array.isArray((data as any).data)) {
            setSchedules((data as any).data);
          } else if (data && typeof data === 'object' && Array.isArray((data as any).schedules)) {
            setSchedules((data as any).schedules);
          } else {
            setSchedules([]);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to fetch schedule');
          setSchedules([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchSchedule();

    return () => {
      isMounted = false;
    };
  }, [roomId, type, startDate?.toISOString(), endDate?.toISOString()]);

  return { schedules, isLoading, error };
}
