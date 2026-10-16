/**
 * Service for generating and downloading RFC 5545 compliant .ics calendar files
 * with Asia/Bangkok (UTC+7) timezone support and automatic 1-hour fallback for missing end_at.
 */

export interface IcsEventOptions {
  title: string;
  start_at: string;
  end_at?: string | null;
  course_code?: string | null;
  description?: string | null;
  organizer?: string | null;
  location?: string | null;
  type?: string | null;
}

/**
 * Format a Date object into Bangkok local time YYYYMMDDTHHMMSS string
 */
export function formatBangkokDateString(d: Date): string {
  // Format to Bangkok timezone parts
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

  // Handle hour "24" edge case in some Intl implementations
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
 * Generate RFC 5545 .ics calendar string with VTIMEZONE (Asia/Bangkok)
 */
export function generateSingleEventIcs(event: IcsEventOptions): string {
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

  const dtStart = formatBangkokDateString(validStart);
  const dtEnd = formatBangkokDateString(validEnd);
  const dtStamp = formatBangkokDateString(new Date());

  const eventSummary = [event.course_code, event.title].filter(Boolean).join(' - ');
  const escapedSummary = escapeIcsText(eventSummary);
  const rawLoc = event.location
    ? (event.location.toLowerCase().includes('kasetsart') ? event.location : `Room ${event.location}, Kasetsart University`)
    : 'Kasetsart University';
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
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KU Long//Campus Companion Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-TIMEZONE:Asia/Bangkok',
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Bangkok',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0700',
    'TZOFFSETTO:+0700',
    'TZNAME:ICT',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}Z`,
    `DTSTART;TZID=Asia/Bangkok:${dtStart}`,
    `DTEND;TZID=Asia/Bangkok:${dtEnd}`,
    `SUMMARY:${escapedSummary}`,
    `LOCATION:${escapedLocation}`,
    `DESCRIPTION:${escapedDescription}`,
    `ORGANIZER;CN=${escapedOrganizer}:mailto:no-reply@ku.th`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/**
 * Client-side download of single event as .ics file
 */
export function downloadIcsEvent(event: IcsEventOptions): boolean {
  try {
    const icsContent = generateSingleEventIcs(event);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const safeTitle = (event.course_code || event.title || 'event')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 30);
    const filename = `${safeTitle}_schedule.ics`;

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
    console.error('Failed to download .ics event:', error);
    return false;
  }
}
