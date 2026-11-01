/**
 * Focused verification tests for Dynamic QR Checkpoints & Graph Integration
 * Scenarios:
 *   Scenario A: API unavailable + empty cache -> Throws error / no fake fallback
 *   Scenario B: API returns [] -> Exactly [] / no automatic default fallback
 *   Scenario C: API returns 2 records -> Exactly 2 records / no synthetic filling
 *   Scenario D: Unknown QR ID -> Rejected (null) / no guesswork
 *   Scenario E: Live Backend API integration -> 15 real records from DynamoDB
 */

import assert from 'node:assert';

console.log('===========================================================');
console.log('TEST SUITE: DYNAMIC QR CHECKPOINTS (ZERO HARDCODED RECORDS)');
console.log('===========================================================\n');

let totalTests = 0;
let passedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`✅ PASS: ${name}`);
  } catch (err) {
    console.error(`❌ FAIL: ${name}`);
    console.error(`   Error: ${err.message}`);
  }
}

async function testAsync(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`✅ PASS: ${name}`);
  } catch (err) {
    console.error(`❌ FAIL: ${name}`);
    console.error(`   Error: ${err.message}`);
  }
}

// Emulate client checkpoint logic identical to navigationApi.ts
class CheckpointService {
  constructor(baseUrl) {
    this.baseUrl = (baseUrl || '').replace(/\/+$/, '');
    this.cachedCheckpoints = null;
  }

  clearCache() {
    this.cachedCheckpoints = null;
  }

  async getCheckpointsAsync(fetchFn, forceRefresh = false) {
    if (!forceRefresh && this.cachedCheckpoints !== null) {
      return this.cachedCheckpoints;
    }

    let response;
    try {
      response = await fetchFn(`${this.baseUrl}/api/v1/qr-locations`);
    } catch (err) {
      if (this.cachedCheckpoints !== null) return this.cachedCheckpoints;
      throw new Error(err?.message || 'Network error fetching checkpoints');
    }

    if (!response.ok) {
      if (this.cachedCheckpoints !== null) return this.cachedCheckpoints;
      throw new Error(`Failed to load checkpoints: ${response.status}`);
    }

    const json = await response.json();
    if (json.success && Array.isArray(json.data)) {
      const mapped = json.data.map((item) => ({
        id: item.id || item.qr_id,
        node_id: item.node_id,
        name: item.name || item.node_name || item.id,
        building_code: String(item.building_code || (item.id && item.id.includes('LC3') ? 'LC3' : 'LC4')).toUpperCase(),
        floor_number: Number(item.floor_number || 1),
        floor_id: item.floor_id || '',
        description: item.description || '',
        x: Number(item.x ?? item.coordinates?.x ?? 0),
        y: Number(item.y ?? item.coordinates?.y ?? 0),
      }));
      this.cachedCheckpoints = mapped;
      return mapped;
    }

    if (this.cachedCheckpoints !== null) return this.cachedCheckpoints;
    throw new Error('Invalid checkpoints response');
  }

  getCheckpoints() {
    return this.cachedCheckpoints || [];
  }

  resolveCheckpoint(qrContent) {
    let target = (qrContent || '').trim();
    if (!target) return null;

    try {
      const parsed = new URL(target);
      const paramVal =
        parsed.searchParams.get('start') ||
        parsed.searchParams.get('start_node') ||
        parsed.searchParams.get('start_id') ||
        parsed.searchParams.get('checkpoint') ||
        parsed.searchParams.get('node_id');
      if (paramVal) target = paramVal.trim();
    } catch {}

    const checkpoints = this.cachedCheckpoints || [];
    const match = checkpoints.find(
      (c) =>
        c.id.toLowerCase() === target.toLowerCase() ||
        c.node_id.toLowerCase() === target.toLowerCase()
    );
    if (match) return match;
    return null;
  }
}

const service = new CheckpointService('https://m00mar9jhg.execute-api.ap-southeast-2.amazonaws.com');

// -------------------------------------------------------------
// SCENARIO A: API unavailable + empty cache
// -------------------------------------------------------------
await testAsync('Scenario A: API unavailable + empty cache must throw Error and return empty array', async () => {
  service.clearCache();
  const mockFailingFetch = async () => ({
    ok: false,
    status: 500,
    statusText: 'Internal Server Error',
  });

  let errorCaught = false;
  try {
    await service.getCheckpointsAsync(mockFailingFetch);
  } catch (e) {
    errorCaught = true;
  }
  assert.strictEqual(errorCaught, true, 'Must throw error when API fails with empty cache');
  assert.deepStrictEqual(service.getCheckpoints(), [], 'Synchronous getCheckpoints must return empty array, NOT hardcoded records');
});

// -------------------------------------------------------------
// SCENARIO B: API returns [] (empty response)
// -------------------------------------------------------------
await testAsync('Scenario B: API returns [] must return exactly empty list and not inject default checkpoints', async () => {
  service.clearCache();
  const mockEmptyFetch = async () => ({
    ok: true,
    json: async () => ({ success: true, data: [] }),
  });

  const result = await service.getCheckpointsAsync(mockEmptyFetch);
  assert.strictEqual(Array.isArray(result), true, 'Result must be an array');
  assert.strictEqual(result.length, 0, 'Must return exactly 0 records');
  assert.deepStrictEqual(service.getCheckpoints(), [], 'getCheckpoints() must return 0 records');
});

// -------------------------------------------------------------
// SCENARIO C: API returns only 2 records
// -------------------------------------------------------------
await testAsync('Scenario C: API returns only 2 records must return exactly those 2 records', async () => {
  service.clearCache();
  const twoRecords = [
    { id: 'TEST-F1-QR1', node_id: 'TEST-N01', name: 'Test Point 1', building_code: 'TEST', floor_number: 1 },
    { id: 'TEST-F1-QR2', node_id: 'TEST-N02', name: 'Test Point 2', building_code: 'TEST', floor_number: 1 },
  ];
  const mockTwoFetch = async () => ({
    ok: true,
    json: async () => ({ success: true, data: twoRecords }),
  });

  const result = await service.getCheckpointsAsync(mockTwoFetch);
  assert.strictEqual(result.length, 2, 'Must return exactly 2 records');
  assert.strictEqual(result[0].id, 'TEST-F1-QR1');
  assert.strictEqual(result[1].id, 'TEST-F1-QR2');
  assert.strictEqual(service.getCheckpoints().length, 2, 'Cache must contain exactly 2 records, NO automatic 13 extra records');
});

// -------------------------------------------------------------
// SCENARIO D: Unknown QR ID rejection
// -------------------------------------------------------------
test('Scenario D: Unknown QR ID must be strictly rejected (returns null) without guessing', () => {
  // Service currently has only 2 test records from Scenario C
  const unknown1 = service.resolveCheckpoint('UNKNOWN_QR_999');
  assert.strictEqual(unknown1, null, 'Must return null for unknown QR code');

  const unknown2 = service.resolveCheckpoint('LC4-F1-QR1');
  assert.strictEqual(unknown2, null, 'Must return null if not in current backend response');

  const unknownUrl = service.resolveCheckpoint('https://d2k1h3uc8pux1o.cloudfront.net/navigation?start=INVALID_ID');
  assert.strictEqual(unknownUrl, null, 'Must return null for invalid start parameter in deep link');

  const valid = service.resolveCheckpoint('TEST-F1-QR1');
  assert.strictEqual(valid !== null, true, 'Known checkpoint must be resolved');
  assert.strictEqual(valid.id, 'TEST-F1-QR1');
});

// -------------------------------------------------------------
// SCENARIO E: Live Backend API Verification (Real DynamoDB)
// -------------------------------------------------------------
await testAsync('Scenario E: Live Backend API returns 15 canonical DynamoDB checkpoints and resolves deep link', async () => {
  service.clearCache();
  const liveFetch = globalThis.fetch;
  const liveCheckpoints = await service.getCheckpointsAsync(liveFetch);

  assert.strictEqual(liveCheckpoints.length, 15, 'Live backend must return all 15 checkpoints');
  const ids = liveCheckpoints.map((c) => c.id);
  assert.strictEqual(ids.includes('LC3-F1-QR1'), true, 'Must include LC3-F1-QR1');
  assert.strictEqual(ids.includes('LC4-F3-QR3'), true, 'Must include LC4-F3-QR3');

  // Verify deep link URL resolution
  const resolvedDeepLink = service.resolveCheckpoint('https://d2k1h3uc8pux1o.cloudfront.net/navigation?start=LC3-F1-QR1');
  assert.strictEqual(resolvedDeepLink !== null, true, 'Must resolve valid deep link against live checkpoints');
  assert.strictEqual(resolvedDeepLink.id, 'LC3-F1-QR1');
  assert.strictEqual(resolvedDeepLink.node_id, 'LC3-F1-N01');
  assert.strictEqual(resolvedDeepLink.building_code, 'LC3');
  assert.strictEqual(resolvedDeepLink.floor_number, 1);

  // Unknown ID against live checkpoints
  const unknownAgainstLive = service.resolveCheckpoint('LC3-F1-QR999');
  assert.strictEqual(unknownAgainstLive, null, 'Unknown QR ID against live records must return null');
});

console.log('\n===========================================================');
console.log(`TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
console.log('===========================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}

