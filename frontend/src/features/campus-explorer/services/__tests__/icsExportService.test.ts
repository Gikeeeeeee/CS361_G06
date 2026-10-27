import {
  generateSingleEventIcs,
  generateMultiEventIcs,
  formatBangkokDateString,
  formatDateTimeInTimeZone,
  formatIcsLocation,
  escapeIcsText,
} from '../icsExportService';

/**
 * Self-contained unit tests for icsExportService meeting US3 Acceptance Criteria
 */
export function runIcsExportServiceTests(): boolean {
  let passed = true;

  // Test 1: Fallback when end_at is null or undefined -> defaults to start_at + 1 hour
  try {
    const icsNoEnd = generateSingleEventIcs({
      title: 'Workshop without End Time',
      start_at: '2026-10-19T09:00:00+07:00',
      end_at: null,
      course_code: 'WS101',
    });

    if (!icsNoEnd.includes('DTSTART;TZID=Asia/Bangkok:20261019T090000')) {
      console.error('Test 1 Failed: DTSTART mismatch in no-end event');
      passed = false;
    }
    if (!icsNoEnd.includes('DTEND;TZID=Asia/Bangkok:20261019T100000')) {
      console.error('Test 1 Failed: DTEND should fallback to 1 hour after start_at (10:00:00)');
      passed = false;
    }
  } catch (e) {
    console.error('Test 1 Threw exception:', e);
    passed = false;
  }

  // Test 2: Timezone handling from UTC ISO string to Asia/Bangkok
  try {
    // 02:00:00 UTC = 09:00:00 in Asia/Bangkok (+07:00)
    const icsUtc = generateSingleEventIcs({
      title: 'Software Architecture',
      start_at: '2026-10-19T02:00:00Z',
      end_at: '2026-10-19T05:00:00Z',
      course_code: 'CS361',
    });

    if (!icsUtc.includes('DTSTART;TZID=Asia/Bangkok:20261019T090000')) {
      console.error('Test 2 Failed: UTC 02:00Z should convert to Bangkok 09:00');
      passed = false;
    }
    if (!icsUtc.includes('DTEND;TZID=Asia/Bangkok:20261019T120000')) {
      console.error('Test 2 Failed: UTC 05:00Z should convert to Bangkok 12:00');
      passed = false;
    }
  } catch (e) {
    console.error('Test 2 Threw exception:', e);
    passed = false;
  }

  // Test 3: Escaping special characters in title and description
  try {
    const escaped = escapeIcsText('Hello; world, with\nnewline and \\backslash');
    const expected = 'Hello\\; world\\, with\\nnewline and \\\\backslash';
    if (escaped !== expected) {
      console.error('Test 3 Failed: Escaping mismatch', { escaped, expected });
      passed = false;
    }
  } catch (e) {
    console.error('Test 3 Threw exception:', e);
    passed = false;
  }

  // Test 4: Format Bangkok date string directly
  try {
    const d = new Date('2026-10-19T02:30:00Z');
    const formatted = formatBangkokDateString(d);
    if (formatted !== '20261019T093000') {
      console.error('Test 4 Failed: formatBangkokDateString mismatch', { formatted });
      passed = false;
    }
  } catch (e) {
    console.error('Test 4 Threw exception:', e);
    passed = false;
  }

  // Test 5: Format location as `[room.name] - [room.building_name]` per US3 spec
  try {
    const locationWithRoom = formatIcsLocation({
      title: 'Operating Systems',
      start_at: '2026-10-19T09:00:00+07:00',
      room: {
        name: 'LC4-201',
        building_name: 'LC4',
      },
    });

    if (locationWithRoom !== 'LC4-201 - LC4') {
      console.error('Test 5 Failed: location should be formatted as [room.name] - [room.building_name]', { locationWithRoom });
      passed = false;
    }
  } catch (e) {
    console.error('Test 5 Threw exception:', e);
    passed = false;
  }

  // Test 6: Multi-event .ics calendar generation contains all events and correct structure
  try {
    const multiIcs = generateMultiEventIcs([
      {
        title: 'Software Engineering',
        course_code: 'CS361',
        start_at: '2026-10-19T09:00:00+07:00',
        end_at: '2026-10-19T12:00:00+07:00',
        room: { name: 'LC4-210', building_name: 'LC4' },
        organizer: 'Dr. Somchai',
        description: 'Core SE course',
      },
      {
        title: 'Database Systems',
        course_code: 'CS365',
        start_at: '2026-10-20T13:00:00+07:00',
        end_at: '2026-10-20T15:00:00+07:00',
        room: { name: 'LC4-205', building_name: 'LC4' },
      },
    ], 'Saved Schedules');

    if (!multiIcs.includes('BEGIN:VCALENDAR') || !multiIcs.includes('END:VCALENDAR')) {
      console.error('Test 6 Failed: Missing VCALENDAR wrapper');
      passed = false;
    }
    if (!multiIcs.includes('SUMMARY:CS361 - Software Engineering') || !multiIcs.includes('SUMMARY:CS365 - Database Systems')) {
      console.error('Test 6 Failed: Event summaries missing in multi-event ICS');
      passed = false;
    }
    if (!multiIcs.includes('LOCATION:LC4-210 - LC4') || !multiIcs.includes('LOCATION:LC4-205 - LC4')) {
      console.error('Test 6 Failed: Locations missing or misformatted in multi-event ICS');
      passed = false;
    }
    if (!multiIcs.includes('ORGANIZER;CN=Dr. Somchai:mailto:no-reply@ku.th')) {
      console.error('Test 6 Failed: Organizer missing in multi-event ICS');
      passed = false;
    }
    // Check that there are 2 events
    const eventCount = (multiIcs.match(/BEGIN:VEVENT/g) || []).length;
    if (eventCount !== 2) {
      console.error(`Test 6 Failed: Expected 2 VEVENT blocks, got ${eventCount}`);
      passed = false;
    }
  } catch (e) {
    console.error('Test 6 Threw exception:', e);
    passed = false;
  }

  // Test 7: Custom time_zone parameter is respected
  try {
    const formattedBangkok = formatDateTimeInTimeZone(new Date('2026-10-19T02:00:00Z'), 'Asia/Bangkok');
    if (formattedBangkok !== '20261019T090000') {
      console.error('Test 7 Failed: Bangkok timezone conversion error', { formattedBangkok });
      passed = false;
    }
  } catch (e) {
    console.error('Test 7 Threw exception:', e);
    passed = false;
  }

  return passed;
}

// Auto-run if executed directly via node or tsx
const proc = (globalThis as unknown as { process?: { argv?: string[]; exit?: (code: number) => void } }).process;
const isDirectRun = typeof proc !== 'undefined' && proc.argv && proc.argv[1] && proc.argv[1].includes('icsExportService.test');
if (isDirectRun) {
  const allPassed = runIcsExportServiceTests();
  console.log(`\n========================================`);
  console.log(`ICS Export Service Tests: ${allPassed ? 'ALL PASSED (7/7)' : 'FAILED'}`);
  console.log(`========================================\n`);
  if (!allPassed && proc?.exit) {
    proc.exit(1);
  }
}
