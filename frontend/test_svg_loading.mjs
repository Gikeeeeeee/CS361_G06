import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function moduleAt(path, globals = {}, imports = {}) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, { exports, require: (name) => imports[name], URL, Date, Map, Promise, Error, ...globals });
  return exports;
}
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = async () => { for (let i = 0; i < 20; ++i) await Promise.resolve(); };

// DOM adapter isolates network/cache behavior. Browser XML rendering remains a manual check.
class Parser {
  parseFromString(text) {
    return {
      querySelector: () => text === 'invalid' ? {} : null,
      documentElement: { localName: 'svg', namespaceURI: 'http://www.w3.org/2000/svg',
        removeAttribute() {}, setAttribute() {}, style: {}, outerHTML: text },
    };
  }
}
let calls = [];
let respond = async () => ({ ok: true, text: async () => '<svg id="room-101"/>' });
const cache = moduleAt('./src/utils/svgCache.ts', {
  DOMParser: Parser,
  fetch: async (url, options) => { calls.push({ url, options }); return respond(); },
});
const { fetchAndCacheSvg: fetchSvg, clearSvgCache: clear, getCachedSvg: get } = cache;
const url = 'https://assets.example/plan.svg';
const first = deferred(); respond = () => first.promise;
const a = fetchSvg(url), b = fetchSvg(url);
assert.equal(a, b);
first.resolve({ ok: true, text: async () => '<svg id="room-101"/>' });
await a; assert.equal(calls.length, 1); await fetchSvg(url); assert.equal(calls.length, 1);
assert.equal(calls[0].options.mode, 'cors'); assert.equal(calls[0].options.cache, 'no-cache');
console.log('PASS concurrent deduplication, successful memory cache, CORS and revalidation');
clear(); respond = async () => ({ ok: false, status: 403 });
await assert.rejects(fetchSvg(url), /expired or access was denied/); assert.equal(get(url), undefined);
respond = async () => ({ ok: true, text: async () => 'invalid' });
await assert.rejects(fetchSvg(url), /valid SVG/); assert.equal(get(url), undefined);
respond = async () => { throw new TypeError('network'); };
await assert.rejects(fetchSvg(url), /connection.*CORS/);
console.log('PASS HTTP, malformed XML and network failures are retryable and uncached');
await assert.rejects(fetchSvg(url + '?Expires=1'), /expired/);
const old = deferred(), fresh = deferred();
respond = () => old.promise; const oldRequest = fetchSvg(url);
clear(url); respond = () => fresh.promise; const newRequest = fetchSvg(url, true);
fresh.resolve({ ok: true, text: async () => '<svg id="new"/>' }); await newRequest;
old.resolve({ ok: true, text: async () => '<svg id="old"/>' }); await oldRequest;
assert.equal(get(url), '<svg id="new"/>'); assert.equal(calls.at(-1).options.cache, 'reload');
console.log('PASS expired URLs rejected and invalidated in-flight request cannot overwrite retry');

// Minimal React lifecycle harness exercises the real hook with controlled promises.
let slots = [], cursor = 0, effects = [], cleanups = [], currentUrl, currentRefresh, result;
const equalDeps = (a, b) => a && a.length === b.length && a.every((x, i) => x === b[i]);
const react = {
  useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], (value) => { slots[i] = value; }]; },
  useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial }; },
  useCallback(fn, deps) { const i = cursor++; if (!equalDeps(slots[i]?.deps, deps)) slots[i] = { fn, deps }; return slots[i].fn; },
  useEffect(fn, deps) { const i = cursor++; if (!equalDeps(slots[i], deps)) { effects.push(() => { cleanups[i]?.(); cleanups[i] = fn(); }); slots[i] = deps; } },
};
let requests = [];
const hook = moduleAt('./src/features/campus-explorer/components/floor-viewer/hooks/useSvgFloorPlan.ts', {}, {
  react, '../../../../../utils/svgCache': {
    clearSvgCache() {}, fetchAndCacheSvg(target) { const d = deferred(); requests.push({ target, ...d }); return d.promise; },
  },
}).useSvgFloorPlan;
function render(url = currentUrl, refresh = currentRefresh, flush = true) {
  currentUrl = url; currentRefresh = refresh; cursor = 0; result = hook(url, refresh);
  if (flush) { const pending = effects; effects = []; pending.forEach((fn) => fn()); }
  return result;
}
render('A'); requests[0].resolve('plan A'); await tick(); assert.equal(render().svgContent, 'plan A');
assert.equal(render('B', undefined, false).svgContent, null); render('B');
render('A'); const latest = requests.at(-1); requests[1].resolve('late B'); await tick();
assert.equal(render().svgContent, null); latest.resolve('latest A'); await tick(); assert.equal(render().svgContent, 'latest A');
console.log('PASS URL changes hide old SVG synchronously and A/B/A completion races are ignored');
render('A', async () => 'renewed'); result.retry(); await tick(); assert.equal(requests.at(-1).target, 'renewed');
requests.at(-1).reject(new Error('denied')); await tick(); assert.match(render().error.message, /denied/);
result.retry(); await tick(); requests.at(-1).resolve('retry success'); await tick(); assert.equal(render().svgContent, 'retry success');
currentUrl = undefined; render(); assert.equal(render().svgContent, null);
console.log('PASS retries refresh signed metadata, surface errors, recover and clear absent URLs');
console.log('All SVG loading regression checks passed.');

slots = []; cursor = 0; effects = []; cleanups = []; requests = [];
let floorRequests = [];
const detailsHook = moduleAt('./src/features/campus-explorer/components/building-info/hooks/useBuildingDetails.ts', { console }, {
  react, '../../../services': { campusService: {
    getBuildingById: async () => ({ id: 'building', floors: [{ id: 'A', floor_number: 1 }, { id: 'B', floor_number: 2 }, { id: 'C', floor_number: 3 }] }),
    getFloorById(id) { const d = deferred(); floorRequests.push({ id, ...d }); return d.promise; },
  } },
}).useBuildingDetails;
function renderDetails() {
  cursor = 0; const value = detailsHook('building');
  const pending = effects; effects = []; pending.forEach((fn) => fn());
  return value;
}
renderDetails(); await tick();
floorRequests[0].resolve({ id: 'A', floor_number: 1 }); await tick();
let details = renderDetails(); assert.equal(details.selectedFloor.id, 'A');
const selectingB = details.selectFloor('B');
assert.equal(renderDetails().selectedFloor.id, 'B');
const selectingC = renderDetails().selectFloor('C');
floorRequests.at(-1).resolve({ id: 'C', floor_number: 3 }); await selectingC;
floorRequests.at(-2).resolve({ id: 'B', floor_number: 2 }); await selectingB;
assert.equal(renderDetails().selectedFloor.id, 'C');
cleanups.forEach((fn) => fn?.());
floorRequests[1].resolve({ id: 'B', floor_number: 2 }); await tick();
assert.equal(renderDetails().selectedFloor.id, 'C');
console.log('PASS floor-detail selection clears previous map and ignores out-of-order responses');
