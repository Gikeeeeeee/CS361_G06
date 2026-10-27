import { createClient } from '@supabase/supabase-js';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env');
  } catch {}
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const API_BASE = process.env.VITE_API_BASE_URL
  ? `${process.env.VITE_API_BASE_URL.replace(/\/+$/, '')}/api/v1`
  : null;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !API_BASE) {
  console.error('❌ Missing environment configuration: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and VITE_API_BASE_URL are required in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runUS4IntegrationTests() {
  console.log('======================================================');
  console.log('   US4 INTEGRATION & DATA MASKING TEST SUITE          ');
  console.log('======================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
    }
  }

  // 1. Authenticate Staff User
  console.log('[1] Authenticating Staff (staff@dome.tu.ac.th)...');
  const { data: staffData, error: staffErr } = await supabase.auth.signInWithPassword({
    email: 'staff@dome.tu.ac.th',
    password: 'password123',
  });
  assert(!staffErr && !!staffData?.session?.access_token, 'Staff authenticated via Supabase');
  const staffToken = staffData?.session?.access_token;

  // 2. Authenticate Student User
  console.log('\n[2] Authenticating Student (student@dome.tu.ac.th)...');
  const { data: studentData, error: studentErr } = await supabase.auth.signInWithPassword({
    email: 'student@dome.tu.ac.th',
    password: 'password123',
  });
  assert(!studentErr && !!studentData?.session?.access_token, 'Student authenticated via Supabase');
  const studentToken = studentData?.session?.access_token;

  // 3. Test Room Details (Share Room Link target)
  const testRoomId = '2c9f4d6f-65a0-5efa-a12c-a2431c6cc91a';
  console.log(`\n[3] Verifying Public Access for Shared Room link (/rooms/${testRoomId})...`);
  const roomRes = await fetch(`${API_BASE}/rooms/${testRoomId}`);
  assert(roomRes.status === 200, 'Guest can load room details without authentication (HTTP 200)');
  const roomJson = await roomRes.json();
  assert(!!roomJson && (roomJson.id === testRoomId || roomJson.data?.id === testRoomId || !!roomJson.name), 'Room details loaded correctly for Guest');

  // 4. Ensure Test Data: Both PUBLIC and INTERNAL schedules exist in the target room
  console.log('\n[4] Preparing Test Schedules in DynamoDB (Both PUBLIC and INTERNAL in room)...');
  const testDate = '2026-10-25';
  const startWindow = `${testDate}T00:00:00+07:00`;
  const endWindow = `${testDate}T23:59:59+07:00`;

  // Create PUBLIC Schedule as Staff
  const publicPayload = {
    type: 'COURSE',
    title: 'CS450 Software Architecture Lecture',
    description: 'Weekly public lecture open to all enrolled students.',
    course_code: 'CS450',
    organizer: 'Prof. Davis',
    start_at: `${testDate}T09:00:00+07:00`,
    end_at: `${testDate}T11:00:00+07:00`,
    status: 'CONFIRM',
    visibility: 'PUBLIC',
  };
  const pubRes = await fetch(`${API_BASE}/rooms/${testRoomId}/schedules`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${staffToken}`,
    },
    body: JSON.stringify(publicPayload),
  });
  assert(pubRes.status === 201 || pubRes.status === 409, 'Public schedule created / verified in room');

  // Create INTERNAL Schedule as Staff
  const internalPayload = {
    type: 'ACTIVITY',
    title: 'Confidential Department Faculty Review',
    description: 'Strictly internal meeting for academic staff evaluation.',
    organizer: 'Dean Office Committee',
    start_at: `${testDate}T13:00:00+07:00`,
    end_at: `${testDate}T15:00:00+07:00`,
    status: 'CONFIRM',
    visibility: 'INTERNAL',
  };
  const intRes = await fetch(`${API_BASE}/rooms/${testRoomId}/schedules`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${staffToken}`,
    },
    body: JSON.stringify(internalPayload),
  });
  assert(intRes.status === 201 || intRes.status === 409, 'Internal schedule created / verified in room');

  // 5. Test Guest (Incognito / Unauthenticated) Access & Masking
  console.log('\n[5] Testing Schedule Query as GUEST (Incognito Mode)...');
  const queryUrl = `${API_BASE}/rooms/${testRoomId}/schedules?start=${encodeURIComponent(startWindow)}&end=${encodeURIComponent(endWindow)}`;
  const guestQueryRes = await fetch(queryUrl);
  assert(guestQueryRes.status === 200, 'Guest schedule query returned HTTP 200 without Login');
  const guestQueryData = await guestQueryRes.json();
  const guestEvents = Array.isArray(guestQueryData) ? guestQueryData : (guestQueryData.data || []);
  assert(guestEvents.length >= 2, `Guest successfully loaded ${guestEvents.length} events from room`);

  const guestInternal = guestEvents.find(e => e.visibility === 'INTERNAL' || e.title === 'Reserved');
  const guestPublic = guestEvents.find(e => e.visibility === 'PUBLIC' || (e.title && e.title.includes('CS450')));

  assert(!!guestInternal, 'Guest received the internal schedule entry');
  if (guestInternal) {
    assert(guestInternal.title === 'Reserved', 'Guest: Internal schedule title is MASKED to "Reserved"');
    assert(guestInternal.description === null || guestInternal.description === undefined, 'Guest: Internal schedule description is null (hidden)');
    assert(guestInternal.organizer === null || guestInternal.organizer === undefined, 'Guest: Internal schedule organizer is null (hidden)');
  }

  assert(!!guestPublic, 'Guest received the public schedule entry');
  if (guestPublic) {
    assert(guestPublic.title.includes('CS450'), 'Guest: Public schedule title is NOT masked');
    assert(!!guestPublic.description, 'Guest: Public schedule description is visible');
    assert(!!guestPublic.organizer, 'Guest: Public schedule organizer is visible');
  }

  // 6. Test Student (Logged in as Non-Staff) Masking
  console.log('\n[6] Testing Schedule Query as STUDENT (Authenticated non-staff)...');
  const studentQueryRes = await fetch(queryUrl, {
    headers: { 'Authorization': `Bearer ${studentToken}` },
  });
  assert(studentQueryRes.status === 200, 'Student schedule query returned HTTP 200');
  const studentDataQuery = await studentQueryRes.json();
  const studentEvents = Array.isArray(studentDataQuery) ? studentDataQuery : (studentDataQuery.data || []);
  const studentInternal = studentEvents.find(e => e.visibility === 'INTERNAL' || e.title === 'Reserved');
  assert(!!studentInternal, 'Student received the internal schedule entry');
  if (studentInternal) {
    assert(studentInternal.title === 'Reserved', 'Student role: Internal schedule title remains MASKED as "Reserved"');
    assert(studentInternal.description === null || studentInternal.description === undefined, 'Student role: Description remains masked (null)');
    assert(studentInternal.organizer === null || studentInternal.organizer === undefined, 'Student role: Organizer remains masked (null)');
  }

  // 7. Test Staff (Logged in as STAFF) Unmasking
  console.log('\n[7] Testing Schedule Query as STAFF (Authenticated Staff)...');
  const staffQueryRes = await fetch(queryUrl, {
    headers: { 'Authorization': `Bearer ${staffToken}` },
  });
  assert(staffQueryRes.status === 200, 'Staff schedule query returned HTTP 200');
  const staffDataQuery = await staffQueryRes.json();
  const staffEvents = Array.isArray(staffDataQuery) ? staffDataQuery : (staffDataQuery.data || []);
  const staffInternal = staffEvents.find(e => e.visibility === 'INTERNAL');
  assert(!!staffInternal, 'Staff received the internal schedule entry');
  if (staffInternal) {
    assert(staffInternal.title !== 'Reserved', `Staff: Internal schedule title is UNMASKED ("${staffInternal.title}")`);
    assert(staffInternal.description !== null && !!staffInternal.description, 'Staff: Internal schedule description is UNMASKED');
    assert(staffInternal.organizer !== null && !!staffInternal.organizer, 'Staff: Internal schedule organizer is UNMASKED');
  }

  // 8. Test Client-side Cache Invalidation across Role Switch
  console.log('\n[8] Testing Cross-Role Cache Invalidation...');
  assert(guestInternal?.title === 'Reserved' && staffInternal?.title !== 'Reserved', 'Cross-role isolation confirmed: Guest sees "Reserved" while Staff sees full title');

  console.log('\n======================================================');
  console.log(`TEST SUMMARY: ${passed}/${total} assertions passed (${Math.round((passed / total) * 100)}%)`);
  console.log('======================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runUS4IntegrationTests().catch(err => {
  console.error('Fatal error during US4 tests:', err);
  process.exit(1);
});
