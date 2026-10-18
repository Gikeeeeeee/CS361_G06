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
  console.error('❌ Environment configuration missing: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and VITE_API_BASE_URL must be defined in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runTests() {
  console.log('--- STARTING US1 E2E INTEGRATION TESTS ---\n');
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

  // 1. Test Student Authentication with Supabase
  console.log('[1] Testing Student Login...');
  const { data: studentData, error: studentErr } = await supabase.auth.signInWithPassword({
    email: 'student@dome.tu.ac.th',
    password: 'password123',
  });
  assert(!studentErr && !!studentData?.session?.access_token, 'Student can sign in with valid credentials via Supabase Auth');
  const studentToken = studentData?.session?.access_token;

  // 2. Test Backend Profile Endpoint for Student
  console.log('\n[2] Testing GET /api/v1/users/me with Student Token...');
  const studentProfileRes = await fetch(`${API_BASE}/users/me`, {
    headers: {
      Authorization: `Bearer ${studentToken}`,
      Accept: 'application/json',
    },
  });
  const studentProfile = await studentProfileRes.json();
  assert(studentProfileRes.status === 200, 'GET /api/v1/users/me returns 200 OK');
  assert(studentProfile.success === true, 'Response payload has success: true');
  assert(studentProfile.data.role === 'STUDENT', `User role is STUDENT (got: ${studentProfile.data?.role})`);
  assert(studentProfile.data.email === 'student@dome.tu.ac.th', 'Profile email matches student email');

  // 3. Test Student Attempting Protected Write Endpoint (Should be 403 Forbidden)
  console.log('\n[3] Testing Student Role Protection on Protected Write Endpoint...');
  const studentWriteRes = await fetch(`${API_BASE}/rooms/b1-f1-r1/schedules`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      course_id: 'CS361-TEST',
      day_of_week: 1,
      start_time: '09:00',
      end_time: '12:00',
      academic_year: '2026',
      semester: '1',
    }),
  });
  const studentWriteBody = await studentWriteRes.json();
  assert(studentWriteRes.status === 403, `Student write operation is blocked with 403 Forbidden (got: ${studentWriteRes.status})`);
  assert(studentWriteBody.error?.code === 'FORBIDDEN', `Error code is FORBIDDEN (got: ${studentWriteBody.error?.code})`);

  // 4. Test Staff Authentication with Supabase
  console.log('\n[4] Testing Staff Login...');
  const { data: staffData, error: staffErr } = await supabase.auth.signInWithPassword({
    email: 'staff@dome.tu.ac.th',
    password: 'password123',
  });
  assert(!staffErr && !!staffData?.session?.access_token, 'Staff can sign in with valid credentials via Supabase Auth');
  const staffToken = staffData?.session?.access_token;

  // 5. Test Backend Profile Endpoint for Staff
  console.log('\n[5] Testing GET /api/v1/users/me with Staff Token...');
  const staffProfileRes = await fetch(`${API_BASE}/users/me`, {
    headers: {
      Authorization: `Bearer ${staffToken}`,
      Accept: 'application/json',
    },
  });
  const staffProfile = await staffProfileRes.json();
  assert(staffProfileRes.status === 200, 'GET /api/v1/users/me returns 200 OK for staff');
  assert(staffProfile.data.role === 'STAFF', `User role is STAFF (got: ${staffProfile.data?.role})`);
  assert(staffProfile.data.email === 'staff@dome.tu.ac.th', 'Profile email matches staff email');

  // 6. Test Expired / Invalid Token (Should return 401 Unauthorized)
  console.log('\n[6] Testing Expired / Invalid Token handling...');
  const invalidRes = await fetch(`${API_BASE}/users/me`, {
    headers: {
      Authorization: 'Bearer dummy.expired.token',
      Accept: 'application/json',
    },
  });
  const invalidBody = await invalidRes.json();
  assert(invalidRes.status === 401, `Invalid/Expired token returns 401 Unauthorized (got: ${invalidRes.status})`);
  assert(invalidBody.error?.code === 'UNAUTHORIZED', `Error code is UNAUTHORIZED (got: ${invalidBody.error?.code})`);

  // 7. Test Missing Token (Guest access to protected profile)
  console.log('\n[7] Testing Guest Access (No Token)...');
  const guestRes = await fetch(`${API_BASE}/users/me`, {
    headers: {
      Accept: 'application/json',
    },
  });
  const guestBody = await guestRes.json();
  assert(guestRes.status === 401, `Guest access without token returns 401 (got: ${guestRes.status})`);
  assert(guestBody.error?.code === 'UNAUTHORIZED', 'Guest access returns code UNAUTHORIZED');

  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${passed} / ${total} tests passed (${Math.round((passed / total) * 100)}%)`);
  console.log(`========================================`);
}

runTests().catch(console.error);
