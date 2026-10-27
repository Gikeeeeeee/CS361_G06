import type { BookmarkItem } from '../types/bookmark.types';

export interface ParsedTimeSlot {
  dayOfWeek?: number; // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  dayName?: string;
  dateStr?: string; // YYYY-MM-DD
  startMinutes: number; // e.g. 09:00 = 540
  endMinutes: number; // e.g. 12:00 = 720
  formattedTime: string; // '09:00 - 12:00'
  durationHours: number;
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflictingItem?: BookmarkItem;
  candidateSlot?: ParsedTimeSlot;
  conflictingSlot?: ParsedTimeSlot;
  message?: string;
}

const DAY_MAP: Record<string, number> = {
  // English
  mon: 1, monday: 1,
  tue: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
  sun: 0, sunday: 0,
  // Thai
  จันทร์: 1, 'วันจันทร์': 1,
  อังคาร: 2, 'วันอังคาร': 2,
  พุธ: 3, 'วันพุธ': 3,
  พฤหัส: 4, พฤหัสบดี: 4, 'วันพฤหัส': 4, 'วันพฤหัสบดี': 4,
  ศุกร์: 5, 'วันศุกร์': 5,
  เสาร์: 6, 'วันเสาร์': 6,
  อาทิตย์: 0, 'วันอาทิตย์': 0,
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Robust parser to extract day, start minutes, end minutes from a schedule item
 */
export function parseScheduleTime(
  item: Partial<BookmarkItem> | { startAt?: string; endAt?: string; subtitle?: string; title?: string }
): ParsedTimeSlot | null {
  let dayOfWeek: number | undefined;
  let dateStr: string | undefined;
  let startMinutes = 0;
  let endMinutes = 0;
  let formattedTime = '';

  // 1. Try parsing from startAt / endAt ISO strings
  if (item.startAt && item.startAt.includes('T')) {
    const sDate = new Date(item.startAt);
    if (!isNaN(sDate.getTime())) {
      dayOfWeek = sDate.getDay();
      const pad = (n: number) => String(n).padStart(2, '0');
      dateStr = `${sDate.getFullYear()}-${pad(sDate.getMonth() + 1)}-${pad(sDate.getDate())}`;
      startMinutes = sDate.getHours() * 60 + sDate.getMinutes();

      if (item.endAt && item.endAt.includes('T')) {
        const eDate = new Date(item.endAt);
        if (!isNaN(eDate.getTime())) {
          endMinutes = eDate.getHours() * 60 + eDate.getMinutes();
        }
      }
    }
  }

  // 2. Try parsing from subtitle or fallback text (e.g. "Mon 09:00 - 12:00", "จันทร์ 9.00-10.30")
  const textToScan = `${item.subtitle || ''} ${item.startAt || ''} ${item.title || ''}`;
  
  // Extract Day if not found yet
  if (dayOfWeek === undefined) {
    const lower = textToScan.toLowerCase();
    for (const [key, val] of Object.entries(DAY_MAP)) {
      if (lower.includes(key)) {
        dayOfWeek = val;
        break;
      }
    }
  }

  // Extract Time: supports "09:00 - 12:00", "9.00-10.30", "09:00-10:30"
  const timeMatch = textToScan.match(/(\d{1,2})[:.](\d{2})\s*[-–]\s*(\d{1,2})[:.](\d{2})/);
  if (timeMatch) {
    const sH = parseInt(timeMatch[1], 10);
    const sM = parseInt(timeMatch[2], 10);
    const eH = parseInt(timeMatch[3], 10);
    const eM = parseInt(timeMatch[4], 10);

    const parsedStart = sH * 60 + sM;
    const parsedEnd = eH * 60 + eM;

    if (startMinutes === 0) startMinutes = parsedStart;
    if (endMinutes === 0) endMinutes = parsedEnd;

    formattedTime = `${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')} - ${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`;
  }

  if (startMinutes === 0 && endMinutes === 0) {
    return null;
  }

  // If endMinutes is before or equal to startMinutes, assume 2 hours default
  if (endMinutes <= startMinutes) {
    endMinutes = startMinutes + 120;
  }

  const durationHours = Math.max(1, Math.round((endMinutes - startMinutes) / 60));

  if (!formattedTime) {
    const sH = Math.floor(startMinutes / 60);
    const sM = startMinutes % 60;
    const eH = Math.floor(endMinutes / 60);
    const eM = endMinutes % 60;
    formattedTime = `${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')} - ${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`;
  }

  return {
    dayOfWeek,
    dayName: dayOfWeek !== undefined ? DAY_NAMES[dayOfWeek] : undefined,
    dateStr,
    startMinutes,
    endMinutes,
    formattedTime,
    durationHours,
  };
}

/**
 * Checks if a candidate schedule item conflicts with any existing bookmarked schedule
 */
export function detectScheduleConflict(
  candidate: Omit<BookmarkItem, 'id' | 'savedAt'> | BookmarkItem,
  existingBookmarks: BookmarkItem[]
): ConflictCheckResult {
  // Only check conflicts for SCHEDULE items
  if (candidate.entityType !== 'SCHEDULE') {
    return { hasConflict: false };
  }

  const candidateSlot = parseScheduleTime(candidate);
  if (!candidateSlot) {
    // If time cannot be parsed, allow booking
    return { hasConflict: false };
  }

  // Filter only other SCHEDULE items
  const otherSchedules = existingBookmarks.filter(
    (b) => b.entityType === 'SCHEDULE' && b.entityId !== candidate.entityId
  );

  for (const existing of otherSchedules) {
    const existingSlot = parseScheduleTime(existing);
    if (!existingSlot) continue;

    // Check if on the same day
    const isSameDay =
      (candidateSlot.dateStr && existingSlot.dateStr && candidateSlot.dateStr === existingSlot.dateStr) ||
      (candidateSlot.dayOfWeek !== undefined && existingSlot.dayOfWeek !== undefined && candidateSlot.dayOfWeek === existingSlot.dayOfWeek);

    if (isSameDay) {
      // Overlap check: candidateStart < existingEnd AND candidateEnd > existingStart
      const overlaps =
        candidateSlot.startMinutes < existingSlot.endMinutes &&
        candidateSlot.endMinutes > existingSlot.startMinutes;

      if (overlaps) {
        const dayLabel = candidateSlot.dayName || (candidateSlot.dayOfWeek !== undefined ? DAY_NAMES[candidateSlot.dayOfWeek] : 'Same Day');
        const existingCode = existing.courseCode || existing.title;
        const candidateCode = candidate.courseCode || candidate.title;

        return {
          hasConflict: true,
          conflictingItem: existing,
          candidateSlot,
          conflictingSlot: existingSlot,
          message: `Cannot bookmark [${candidateCode}] because it conflicts with [${existingCode}] (${dayLabel} ${existingSlot.formattedTime})`,
        };
      }
    }
  }

  return { hasConflict: false, candidateSlot };
}
