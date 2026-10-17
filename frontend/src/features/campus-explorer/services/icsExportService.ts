/**
 * Service for generating and downloading RFC 5545 compliant .ics calendar files
 * with timezone support (e.g., Asia/Bangkok) and automatic fallback for missing end_at.
 * 
 * Supports:
 * - Single schedule export (US3)
 * - Multi-schedule export from Saved Schedules (/saved)
 * - Detail fetching from GET /api/v1/rooms/{roomId}/schedules/{scheduleId}
 */

import { apiClient } from '../../../services/api/apiClient';
import type { BookmarkItem } from '../../bookmarks/types/bookmark.types';

export interface IcsEventOptions {
  title: string;
  start_at: string;
  end_at?: string | null;
  course_code?: string | null;
  description?: string | null;
  organizer?: string | null;
  location?: string | null;
  type?: string | null;
  time_zone?: string | null;
  room?: {
    id?: string;
    name?: string | null;
    building_name?: string | null;
  } | null;
}

/**
 * Format a Date object into local time YYYYMMDDTHHMMSS string for a given timezone
 */
export function formatDateTimeInTimeZone(d: Date, timeZone: string = 'Asia/Bangkok'): string {
  const tz = timeZone || 'Asia/Bangkok';
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(d);
    const partMap: Record<string, string> = {};
    for (const p of parts) {
      partMap[p.type] = p.value;
    }

    // Handle hour "24" edge case in some Intl implementations
    const hour = partMap.hour === '24' ? '00' : partMap.hour;

    return `${partMap.year}${partMap.month}${partMap.day}T${hour}${partMap.minute}${partMap.second}`;
  } catch {
    // Fallback to Bangkok
    return formatBangkokDateString(d);
  }
}

/**
 * Format a Date object into Bangkok local time YYYYMMDDTHHMMSS string
 */
export function formatBangkokDateString(d: Date): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(d);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  const hour = partMap.hour === '24' ? '00' : partMap.hour;
  return `${partMap.year}${partMap.month}${partMap.day}T${hour}${partMap.minute}${partMap.second}`;
}

/**
 * Sanitize text strings according to RFC 5545 escaping rules
 */
export function escapeIcsText(text?: string | null): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
    .trim();
}

/**
 * Format schedule location as `[room.name] - [room.building_name]` per US3 spec
 */
export function formatIcsLocation(event: IcsEventOptions): string {
  if (event.room?.name && event.room?.building_name) {
    return `${event.room.name} - ${event.room.building_name}`;
  }
  if (event.room?.name) {
    return event.room.name;
  }
  if (event.room?.building_name) {
    return event.room.building_name;
  }
  if (event.location) {
    return event.location.toLowerCase().includes('kasetsart')
      ? event.location
      : `Room ${event.location}, Kasetsart University`;
  }
  return 'Kasetsart University';
}

/**
 * Generate VTIMEZONE block for standard RFC 5545 calendar
 */
function getVTimezoneBlock(timeZone: string = 'Asia/Bangkok'): string {
  const tz = timeZone || 'Asia/Bangkok';
  const offset = tz === 'Asia/Bangkok' ? '+0700' : '+0700';
  const tzName = tz === 'Asia/Bangkok' ? 'ICT' : tz;

  return [
    'BEGIN:VTIMEZONE',
    `TZID:${tz}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    `TZOFFSETFROM:${offset}`,
    `TZOFFSETTO:${offset}`,
    `TZNAME:${tzName}`,
    'END:STANDARD',
    'END:VTIMEZONE',
  ].join('\r\n');
}

/**
 * Generate a single VEVENT block for an event
 */
export function generateVEventBlock(event: IcsEventOptions): string {
  const tz = event.time_zone || 'Asia/Bangkok';

  const startDate = new Date(event.start_at);
  const validStart = !isNaN(startDate.getTime()) ? startDate : new Date();

  // Fallback Rule: If end_at is null/empty or invalid, default to start_at + 1 hour
  let validEnd: Date;
  if (event.end_at) {
    const parsedEnd = new Date(event.end_at);
    if (!isNaN(parsedEnd.getTime()) && parsedEnd.getTime() > validStart.getTime()) {
      validEnd = parsedEnd;
    } else {
      validEnd = new Date(validStart.getTime() + 60 * 60 * 1000);
    }
  } else {
    validEnd = new Date(validStart.getTime() + 60 * 60 * 1000);
  }

  const dtStart = formatDateTimeInTimeZone(validStart, tz);
  const dtEnd = formatDateTimeInTimeZone(validEnd, tz);
  const dtStamp = formatDateTimeInTimeZone(new Date(), 'UTC') + 'Z';

  const eventSummary = [event.course_code, event.title].filter(Boolean).join(' - ');
  const escapedSummary = escapeIcsText(eventSummary || 'Saved Schedule');
  const rawLoc = formatIcsLocation(event);
  const escapedLocation = escapeIcsText(rawLoc);
  const escapedOrganizer = escapeIcsText(event.organizer || 'KU Long');
  const escapedDescription = escapeIcsText(
    [
      event.description,
      event.organizer ? `Organizer: ${event.organizer}` : null,
      event.type ? `Event Type: ${event.type}` : null,
      'Exported from KU Long Campus Companion',
    ]
      .filter(Boolean)
      .join('\n')
  );

  const uid = `kulong-${Date.now()}-${Math.random().toString(36).substring(2, 9)}@kulong.ku.th`;

  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;TZID=${tz}:${dtStart}`,
    `DTEND;TZID=${tz}:${dtEnd}`,
    `SUMMARY:${escapedSummary}`,
    `LOCATION:${escapedLocation}`,
    `DESCRIPTION:${escapedDescription}`,
    `ORGANIZER;CN=${escapedOrganizer}:mailto:no-reply@ku.th`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
  ].join('\r\n');
}

/**
 * Generate RFC 5545 .ics calendar string containing multiple events
 */
export function generateMultiEventIcs(
  events: IcsEventOptions[],
  calendarName = 'KU Long Saved Schedules'
): string {
  const timezones = Array.from(
    new Set(events.map((e) => e.time_zone || 'Asia/Bangkok'))
  );
  if (timezones.length === 0) timezones.push('Asia/Bangkok');

  const vtimezones = timezones.map((tz) => getVTimezoneBlock(tz)).join('\r\n');
  const vevents = events.map((e) => generateVEventBlock(e)).join('\r\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KU Long//Saved Schedules Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    `X-WR-TIMEZONE:${timezones[0]}`,
    vtimezones,
    vevents,
    'END:VCALENDAR',
  ].join('\r\n');
}

/**
 * Generate RFC 5545 .ics calendar string with VTIMEZONE (Asia/Bangkok) for a single event
 */
export function generateSingleEventIcs(event: IcsEventOptions): string {
  const tz = event.time_zone || 'Asia/Bangkok';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KU Long//Campus Companion Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-TIMEZONE:${tz}`,
    getVTimezoneBlock(tz),
    generateVEventBlock(event),
    'END:VCALENDAR',
  ].join('\r\n');
}

/**
 * Trigger browser download for given .ics content
 */
export function downloadIcsFile(icsContent: string, filename = 'saved-schedules.ics'): boolean {
  try {
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 200);

    return true;
  } catch (error) {
    console.error('Failed to download .ics file:', error);
    return false;
  }
}

/**
 * Client-side download of single event as .ics file
 */
export function downloadIcsEvent(event: IcsEventOptions): boolean {
  const safeTitle = (event.course_code || event.title || 'event')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 30);
  const filename = `${safeTitle}_schedule.ics`;
  const icsContent = generateSingleEventIcs(event);
  return downloadIcsFile(icsContent, filename);
}

/**
 * Fetch full details for a single schedule from GET /api/v1/rooms/{roomId}/schedules/{scheduleId}
 */
export async function fetchScheduleDetail(roomId: string, scheduleId: string): Promise<any> {
  const cleanRoomId = roomId.includes('_') ? roomId.substring(roomId.indexOf('_') + 1) : roomId;
  const endpoint = `/rooms/${cleanRoomId}/schedules/${scheduleId}`;
  const res = await apiClient.get<any>(endpoint);
  if (res && typeof res === 'object' && 'data' in res && res.data) {
    return res.data;
  }
  return res;
}

/**
 * US3: Export selected saved schedules to .ics
 * 1. Concurrently fetches full schedule details via GET /api/v1/rooms/{roomId}/schedules/{scheduleId}
 * 2. Uses time_zone, description, organizer, and room (room.name, room.building_name)
 * 3. Formats location as `[room.name] - [room.building_name]` and respects time_zone
 * 4. Downloads `saved-schedules.ics`
 */
export async function exportSavedSchedules(
  selectedSchedules: BookmarkItem[],
  filename = 'saved-schedules.ics'
): Promise<boolean> {
  if (!selectedSchedules || selectedSchedules.length === 0) {
    return false;
  }

  const eventOptionsList: IcsEventOptions[] = await Promise.all(
    selectedSchedules.map(async (s) => {
      const scheduleId = s.entityId || s.id;
      const roomId = s.roomId || (s as any).room_id || s.roomName || s.building || 'room-uuid-1';

      try {
        const detail = await fetchScheduleDetail(roomId, scheduleId);
        if (detail && (detail.title || detail.start_at)) {
          return {
            title: detail.title || s.title,
            start_at: detail.start_at || s.startAt || new Date().toISOString(),
            end_at: detail.end_at || s.endAt,
            course_code: detail.course_code || s.courseCode,
            description: detail.description,
            organizer: detail.organizer,
            time_zone: detail.time_zone || 'Asia/Bangkok',
            type: detail.type,
            room: detail.room || {
              name: s.roomName,
              building_name: s.building,
            },
          };
        }
      } catch (err) {
        console.warn(`[ICS Export] Failed to fetch schedule detail (${roomId}/${scheduleId}), using local bookmark:`, err);
      }

      // Fallback to bookmark item data
      return {
        title: s.title,
        start_at: s.startAt || new Date().toISOString(),
        end_at: s.endAt,
        course_code: s.courseCode,
        description: s.subtitle || 'Exported from KU Long Saved Schedules',
        organizer: 'KU Long',
        time_zone: 'Asia/Bangkok',
        room: {
          name: s.roomName,
          building_name: s.building,
        },
      };
    })
  );

  const icsContent = generateMultiEventIcs(eventOptionsList, 'KU Long Saved Schedules');
  return downloadIcsFile(icsContent, filename);
}
