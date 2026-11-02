interface SvgCacheEntry {
  html: string;
  expiresAt: number;
}

const svgCache = new Map<string, SvgCacheEntry>();
const pending = new Map<string, Promise<string>>();
const CACHE_TTL = 5 * 60 * 1000;

function parseExpiration(url: string): number {
  try {
    const parsed = new URL(url, 'https://dummy.base');
    // Check v2 Expires param (unix timestamp in seconds)
    const expParam = parsed.searchParams.get('Expires');
    if (expParam) {
      const expSec = parseInt(expParam, 10);
      if (!isNaN(expSec) && expSec > 0) {
        return expSec * 1000;
      }
    }

    // Check v4 X-Amz-Date and X-Amz-Expires
    const amzDate = parsed.searchParams.get('X-Amz-Date');
    const amzExp = parsed.searchParams.get('X-Amz-Expires');
    if (amzDate && amzExp) {
      // Format: YYYYMMDDTHHMMSSZ
      const y = parseInt(amzDate.slice(0, 4), 10);
      const m = parseInt(amzDate.slice(4, 6), 10) - 1;
      const d = parseInt(amzDate.slice(6, 8), 10);
      const h = parseInt(amzDate.slice(9, 11), 10);
      const mi = parseInt(amzDate.slice(11, 13), 10);
      const s = parseInt(amzDate.slice(13, 15), 10);
      const startDate = Date.UTC(y, m, d, h, mi, s);
      const durationMs = parseInt(amzExp, 10) * 1000;
      if (!isNaN(startDate) && !isNaN(durationMs)) {
        return startDate + durationMs;
      }
    }
  } catch {
    // URL parse failed, use default TTL
  }

  // Unsigned URLs have no signature expiry; the memory TTL is applied separately.
  return Infinity;
}

export function clearSvgCache(url?: string): void {
  if (url) {
    svgCache.delete(url);
    pending.delete(url);
  } else {
    svgCache.clear();
    pending.clear();
  }
}

export function getCachedSvg(url: string): string | undefined {
  const entry = svgCache.get(url);
  if (!entry) return undefined;
  if (Date.now() >= entry.expiresAt) {
    svgCache.delete(url);
    return undefined;
  }
  return entry.html;
}

export function fetchAndCacheSvg(url: string, revalidate = false): Promise<string> {
  const cached = getCachedSvg(url);
  if (cached !== undefined && !revalidate) return Promise.resolve(cached);
  const existing = pending.get(url);
  if (existing && !revalidate) return existing;

  const request = loadSvg(url, revalidate).then((html) => {
    // An invalidated or replaced request must never repopulate the cache.
    if (pending.get(url) === request) {
      svgCache.set(url, {
        html,
        expiresAt: Math.min(parseExpiration(url), Date.now() + CACHE_TTL),
      });
    }
    return html;
  }).finally(() => {
    if (pending.get(url) === request) pending.delete(url);
  });
  pending.set(url, request);
  return request;
}

async function loadSvg(url: string, revalidate: boolean): Promise<string> {
  if (parseExpiration(url) <= Date.now()) {
    throw new Error('Floor plan URL has expired. Retry to refresh floor details.');
  }
  let res: Response;
  try {
    // Browser supplies Origin for cross-origin CORS requests. Never add it manually.
    // Revalidate the browser cache on memory misses, and reload it on explicit retry.
    res = await fetch(url, { mode: 'cors', credentials: 'omit', cache: revalidate ? 'reload' : 'no-cache' });
  } catch {
    throw new Error('Unable to fetch floor plan. Check your connection and the asset server CORS configuration.');
  }
  if (!res.ok) {
    if (res.status === 403) {
      throw new Error('Floor plan URL has expired or access was denied (HTTP 403). Retry to refresh floor details.');
    }
    throw new Error(`Failed to load SVG: ${res.statusText} (${res.status})`);
  }
  const doc = new DOMParser().parseFromString(await res.text(), 'image/svg+xml');
  const svg = doc.documentElement;
  if (doc.querySelector('parsererror') || svg.localName !== 'svg' || svg.namespaceURI !== 'http://www.w3.org/2000/svg') {
    throw new Error('The floor plan response is not a valid SVG.');
  }
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.setAttribute('class', 'w-full h-full');
  svg.style.width = '100%';
  svg.style.height = '100%';
  return svg.outerHTML;
}
