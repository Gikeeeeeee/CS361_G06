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

async function runBookmarkTests() {
  console.log('--- STARTING US2 BOOKMARK INTEGRATION TESTS ---\n');
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

  // 1. Authenticate Student (User A)
  console.log('[1] Signing in User A (student@dome.tu.ac.th)...');
  const { data: userAData, error: userAErr } = await supabase.auth.signInWithPassword({
    email: 'student@dome.tu.ac.th',
    password: 'password123',
  });
  assert(!userAErr && !!userAData?.session?.access_token, 'User A authenticated via Supabase');
  const userAToken = userAData?.session?.access_token;

  // 2. Authenticate Staff (User B) for isolation check
  console.log('\n[2] Signing in User B (staff@dome.tu.ac.th)...');
  const { data: userBData, error: userBErr } = await supabase.auth.signInWithPassword({
    email: 'staff@dome.tu.ac.th',
    password: 'password123',
  });
  assert(!userBErr && !!userBData?.session?.access_token, 'User B authenticated via Supabase');
  const userBToken = userBData?.session?.access_token;

  // Target schedule ID for testing
  const testScheduleId = '15cb09ad-d418-4aa8-bb76-fbde055ea60d';

  // Ensure clean initial state (delete if existing from prior test)
  await fetch(`${API_BASE}/bookmarks/${testScheduleId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${userAToken}` },
  });

  // 3. Test POST /api/v1/bookmarks (Add Bookmark)
  console.log('\n[3] Testing POST /api/v1/bookmarks (Save Schedule Bookmark)...');
  const postRes = await fetch(`${API_BASE}/bookmarks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${userAToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      entity_id: testScheduleId,
      entity_type: 'SCHEDULE',
    }),
  });
  const postBody = await postRes.json();
  assert(postRes.status === 201, `POST /bookmarks returned 201 Created (got: ${postRes.status})`);
  assert(postBody.success === true, 'Response payload has success: true');
  assert(postBody.data?.entity_id === testScheduleId, `Saved entity_id matches requested schedule`);
  assert(postBody.data?.entity_type === 'SCHEDULE', `Saved entity_type is SCHEDULE`);

  // 4. Test Duplicate POST /api/v1/bookmarks (Expect 409 Conflict)
  console.log('\n[4] Testing Duplicate POST /api/v1/bookmarks (Conflict Prevention)...');
  const dupRes = await fetch(`${API_BASE}/bookmarks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${userAToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      entity_id: testScheduleId,
      entity_type: 'SCHEDULE',
    }),
  });
  const dupBody = await dupRes.json();
  assert(dupRes.status === 409, `Duplicate POST returned 409 Conflict (got: ${dupRes.status})`);
  assert(dupBody.error?.code === 'ALREADY_BOOKMARKED', `Error code is ALREADY_BOOKMARKED (got: ${dupBody.error?.code})`);

  // 5. Test GET /api/v1/bookmarks for User A
  console.log('\n[5] Testing GET /api/v1/bookmarks for User A...');
  const getARes = await fetch(`${API_BASE}/bookmarks`, {
    headers: {
      Authorization: `Bearer ${userAToken}`,
      Accept: 'application/json',
    },
  });
  const getABody = await getARes.json();
  assert(getARes.status === 200, `GET /bookmarks returned 200 OK`);
  assert(Array.isArray(getABody.data), 'Data is an array of bookmarks');
  const foundInA = getABody.data.some((b) => b.entity_id === testScheduleId);
  assert(foundInA, `User A bookmarks contains saved schedule (${testScheduleId})`);

  // 6. Test User Isolation (User B should NOT see User A's bookmark)
  console.log('\n[6] Testing User Isolation (User B checking bookmarks)...');
  const getBRes = await fetch(`${API_BASE}/bookmarks`, {
    headers: {
      Authorization: `Bearer ${userBToken}`,
      Accept: 'application/json',
    },
  });
  const getBBody = await getBRes.json();
  assert(getBRes.status === 200, `GET /bookmarks returned 200 OK for User B`);
  const foundInB = (getBBody.data || []).some((b) => b.entity_id === testScheduleId);
  assert(!foundInB, `User Isolation Verified: User B cannot see User A's bookmark`);

  // 7. Test DELETE /api/v1/bookmarks/:entity_id
  console.log('\n[7] Testing DELETE /api/v1/bookmarks/:entity_id (Unsave Bookmark)...');
  const delRes = await fetch(`${API_BASE}/bookmarks/${testScheduleId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${userAToken}`,
      Accept: 'application/json',
    },
  });
  const delBody = await delRes.json();
  assert(delRes.status === 200, `DELETE /bookmarks/:id returned 200 OK (got: ${delRes.status})`);
  assert(delBody.success === true, 'Response payload has success: true');

  // 8. Confirm deletion via GET
  console.log('\n[8] Confirming deletion in GET /api/v1/bookmarks...');
  const getAfterDel = await fetch(`${API_BASE}/bookmarks`, {
    headers: {
      Authorization: `Bearer ${userAToken}`,
      Accept: 'application/json',
    },
  });
  const afterDelBody = await getAfterDel.json();
  const stillFound = (afterDelBody.data || []).some((b) => b.entity_id === testScheduleId);
  assert(!stillFound, `Schedule successfully removed from User A's bookmarks list`);

  // 9. Test Guest Access (Unauthenticated -> 401 Unauthorized)
  console.log('\n[9] Testing Guest Access (No Token)...');
  const guestRes = await fetch(`${API_BASE}/bookmarks`, {
    headers: { Accept: 'application/json' },
  });
  assert(guestRes.status === 401, `Unauthenticated GET returns 401 Unauthorized (got: ${guestRes.status})`);

  console.log('\n========================================');
  console.log(`TEST SUMMARY: ${passed} / ${total} tests passed (${Math.round((passed / total) * 100)}%)`);
  console.log('========================================\n');
}

runBookmarkTests().catch(console.error);
