import { test, expect, type Page } from '@playwright/test';

// Every API request is intercepted. These tests never read or write production.
async function mockCampus(page: Page, role = 'STAFF') {
  const state = { status: 'ACTIVE', error: 0, overlayError: false, routeError: false, searches: 0, patches: [] as any[], overlays: [] as string[], delay: 0 };
  await page.addInitScript(({ role }) => {
    localStorage.setItem('ku_long_auth_user', JSON.stringify({ id: 'test-user', full_name: 'Test Staff', email: 'test@example.invalid', role }));
    localStorage.setItem('ku_long_auth_token', 'local-test-token');
  }, { role });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://127.0.0.1:4173') return route.abort();
    if (url.pathname.startsWith('/test-plan/')) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400"><rect id="room-101" x="30" y="30" width="100" height="100" fill="#ddd"/><text x="40" y="65">101</text></svg>' });
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const send = (data: unknown, status = 200) => route.fulfill({ status, json: data });
    const floors = (building: string) => [1, 2].map(n => ({ id: `${building}-f${n}`, floor_number: n }));
    const rooms = [{ id: 'room101', room_number: '101', name: { en: 'Classroom' } }];
    if (url.pathname.endsWith('/routes/search')) {
      state.searches++;
      if (state.routeError) return send({ success: false, error: { code: 'NO_ROUTE_AVAILABLE', message: 'No route available: corridors are blocked.' } }, 404);
      return send({ success: true, data: { summary: { destination_name: 'Test Room', total_distance: 20, floor_id: 'LC3-f1' },
        svg_path: { floor_id: 'LC3-f1', nodes: [{ node_id: 'node-a', x: 0, y: 220 }, { node_id: 'node-b', x: 500, y: 220 }] }, steps: [] } });
    }
    if (url.pathname === '/api/v1/buildings') return send({ buildings: ['LC3', 'LC4'].map(code => ({ id: code, code, name: { en: code, th: code } })) });
    if (/\/buildings\//.test(url.pathname)) return send({ floors: floors(url.pathname.split('/').at(-1)!) });
    if (url.pathname.endsWith('/status-overlay')) {
      const floorId = url.pathname.split('/').at(-2)!;
      state.overlays.push(floorId);
      if (state.overlayError) return send({ success: false }, 500);
      return send({ success: true, data: { floor_id: floorId, rooms: [{ room_id: 'room101', room_code: '101', status: 'ACTIVE', status_note: null }],
        corridor_edges: [{ edge_id: `${floorId}-edge`, from_node_id: 'node-a', to_node_id: 'node-b', status: state.status, status_note: null }],
        navigation_nodes: [{ node_id: 'node-a', svg_x: 0, svg_y: 220 }, { node_id: 'node-b', svg_x: 500, svg_y: 220 }] } });
    }
    if (route.request().method() === 'PATCH') {
      state.patches.push({ path: url.pathname, body: route.request().postDataJSON(), auth: route.request().headers().authorization });
      if (state.delay) await new Promise(resolve => setTimeout(resolve, state.delay));
      if (state.error) return send({ success: false }, state.error);
      const body = route.request().postDataJSON();
      if (url.pathname.includes('/corridor-edges/')) {
        state.status = body.status;
        return send({ success: true, data: { edge_id: url.pathname.split('/').at(-2), ...body } });
      }
      return send({ success: true, data: { room_id: 'room101', ...body } });
    }
    if (/\/floors\//.test(url.pathname)) return send({ id: url.pathname.split('/').at(-1), rooms, floor_plan: { url: `http://127.0.0.1:4173/test-plan/${url.pathname.split('/').at(-1)}.svg` } });
    if (url.pathname.endsWith('/qr-locations')) return send({ success: true, data: [{ id: 'qr-test', node_id: 'node-a', building_code: 'LC3', floor_id: 'LC3-f1', floor_number: 1, name: 'Checkpoint' }] });
    return send({ success: true, data: [], rooms: [], schedules: [], buildings: [] });
  });
  return state;
}

async function openCorridor(page: Page) {
  await page.goto('/admin/buildings');
  const edge = page.locator('[data-corridor-id="LC3-f1-edge"]');
  await expect(edge).toBeVisible();
  await edge.focus();
  await edge.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Status Configuration' })).toBeVisible();
  if (process.env.CORRIDOR_REVIEW === '1') await page.pause();
}

test('loads graph, maps exact edge IDs, selects a corridor and shows its metadata', async ({ page }) => {
  const state = await mockCampus(page);
  await openCorridor(page);
  await expect(page.getByText('Connected nodes: node-a → node-b')).toBeVisible();
  await expect(page.getByText('Building: LC3')).toBeVisible();
  await expect(page.getByText('Floor: LC3-f1')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled();
  expect(state.patches).toHaveLength(0);
  const line = page.locator('[data-corridor-id] line').nth(1);
  await expect(line).toHaveAttribute('x1', '0');
  await expect(line).toHaveAttribute('x2', '500');
  await expect(line).toHaveAttribute('stroke', '#059669');
});

test('confirmed ACTIVE → BLOCKED → ACTIVE saves JWT, refreshes overlay and redraws', async ({ page }) => {
  const state = await mockCampus(page);
  await openCorridor(page);
  await page.getByRole('button', { name: 'Blocked (No Pass)', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  expect(state.patches).toHaveLength(0);
  const before = state.overlays.length;
  await page.getByRole('button', { name: 'Confirm change' }).click();
  await expect(page.getByRole('dialog', { name: 'Status Configuration' })).toHaveCount(0);
  expect(state.patches[0]).toEqual({ path: '/api/v1/routes/corridor-edges/LC3-f1-edge/status', body: { status: 'BLOCKED', status_note: null }, auth: 'Bearer local-test-token' });
  expect(state.overlays.length).toBeGreaterThan(before);
  await expect(page.locator('[data-corridor-id] line').nth(1)).toHaveAttribute('stroke', '#dc2626');
  await expect(page.locator('[data-corridor-id] line').nth(1)).toHaveAttribute('stroke-dasharray', '8 5');
  await page.screenshot({ path: 'test-results/corridors-blocked.png', fullPage: true });
  await page.locator('[data-corridor-id]').press('Enter');
  await page.getByRole('button', { name: 'Passable (Active)', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm change' }).click();
  await expect(page.locator('[data-corridor-id] line').nth(1)).toHaveAttribute('stroke', '#059669');
  expect(state.patches.map(patch => patch.body.status)).toEqual(['BLOCKED', 'ACTIVE']);
  await page.screenshot({ path: 'test-results/corridors-desktop.png', fullPage: true });
});

for (const status of [400, 401, 403, 404, 500]) {
  test(`failed PATCH ${status} leaves confirmed status unchanged`, async ({ page }) => {
    const state = await mockCampus(page);
    state.error = status;
    await openCorridor(page);
    await page.getByRole('button', { name: 'Blocked (No Pass)', exact: true }).click();
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm change' }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
    await expect(page.locator('[data-corridor-id] line').nth(1)).toHaveAttribute('stroke', '#059669');
    expect(state.status).toBe('ACTIVE');
    expect(state.patches).toHaveLength(1);
  });
}

test('pending PATCH disables duplicate submissions, cancel and floor switching', async ({ page }) => {
  const state = await mockCampus(page);
  state.delay = 800;
  await openCorridor(page);
  await page.getByRole('button', { name: 'Blocked (No Pass)', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm change' }).click();
  await expect(page.getByRole('button', { name: 'Updating...' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled();
  await expect(page.getByRole('combobox').first()).toBeDisabled();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.patches).toHaveLength(1);
});

test('switching buildings/floors clears stale selections and preserves room management', async ({ page }) => {
  await mockCampus(page);
  await openCorridor(page);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('combobox').first().selectOption('LC4');
  await expect(page.locator('[data-corridor-id="LC4-f1-edge"]')).toBeVisible();
  await expect(page.locator('[data-corridor-id="LC3-f1-edge"]')).toHaveCount(0);
  await page.getByRole('combobox').nth(1).selectOption('LC4-f2');
  await expect(page.locator('[data-corridor-id="LC4-f2-edge"]')).toBeVisible();
  await page.locator('#room-101').click();
  await expect(page.getByText('Manage Room Availability')).toBeVisible();
  await page.getByRole('button', { name: /Under Maintenance/ }).click();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('#room-101')).toHaveCSS('fill', 'rgb(254, 240, 138)');
});

for (const role of ['STUDENT', 'ADMIN']) {
  test(`${role} has appropriate management access`, async ({ page }) => {
    const state = await mockCampus(page, role);
    await page.goto('/admin/buildings');
    if (role === 'STUDENT') {
      await expect(page).not.toHaveURL(/\/admin\//);
      await expect(page.locator('[data-corridor-id]')).toHaveCount(0);
      expect(state.patches).toHaveLength(0);
    } else {
      await expect(page.locator('[data-corridor-id]')).toBeVisible();
    }
  });
}

test('mobile corridor targets and cancel work', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await mockCampus(page);
  await page.goto('/admin/buildings');
  const button = page.locator('[data-corridor-id="LC3-f1-edge"]');
  await expect(button).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(button.locator('line').last()).toHaveAttribute('stroke-width', '44');
  await button.click();
  await page.getByRole('button', { name: 'Blocked (No Pass)', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(state.patches).toHaveLength(0);
  await page.screenshot({ path: 'test-results/corridors-mobile.png', fullPage: true });
});

test('missing coordinates are not fabricated and live server status wins over cache', async ({ page }) => {
  await mockCampus(page);
  await page.goto('/admin/buildings');
  await expect(page.locator('[data-corridor-id]')).toBeVisible();
  const result = await page.evaluate(async () => {
    // @ts-expect-error Vite serves the actual application module in browser tests.
    const { getCorridorSegments } = await import('/src/features/admin-status/components/corridorOverlay.ts');
    // @ts-expect-error Vite module URL.
    const { statusApi } = await import('/src/features/admin-status/services/statusApi.ts');
    const data = await statusApi.getFloorStatusOverlay('LC3-f1', true);
    sessionStorage.setItem('ku_long_status_overlay_cache', JSON.stringify({ 'LC3-f1': { ...data, corridor_edges: [{ ...data.corridor_edges[0], status: 'BLOCKED' }] } }));
    const fresh = await statusApi.getFloorStatusOverlay('LC3-f1', true);
    return { freshStatus: fresh.corridor_edges[0].status, segments: getCorridorSegments({ ...fresh, navigation_nodes: [] }) };
  });
  expect(result).toEqual({ freshStatus: 'ACTIVE', segments: [] });
});

test('closure invalidates existing navigation; next search uses backend and handles no route', async ({ page }) => {
  const state = await mockCampus(page, 'STUDENT');
  await page.goto('/profile?start=qr-test');
  await expect(page.getByText('Plan Route', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Classroom/ }).first().click();
  await expect(page.getByText('Navigating to Test Room', { exact: true })).toBeVisible();
  // A successful corridor change in another local tab is delivered via storage.
  await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: 'ku_long_corridor_revision', newValue: 'changed' })));
  await expect(page.getByText('Navigating to Test Room', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Plan Route', { exact: true })).toBeVisible();
  state.routeError = true;
  await page.getByRole('button', { name: /Classroom/ }).first().click();
  await expect(page.getByText('No route available: corridors are blocked.', { exact: true })).toBeVisible();
  expect(state.searches).toBe(2);
});

test('overlay refresh failure after a confirmed PATCH retains the confirmed corridor and shows an error', async ({ page }) => {
  const state = await mockCampus(page);
  await openCorridor(page);
  state.overlayError = true;
  await page.getByRole('button', { name: 'Blocked (No Pass)', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm change' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('[data-corridor-id] line').nth(1)).toHaveAttribute('stroke', '#dc2626');
  await expect(page.getByText('Unable to load current floor status. Please refresh and try again.', { exact: true })).toBeVisible();
});
