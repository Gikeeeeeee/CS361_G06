interface SvgCacheEntry {
  html: string;
  expiresAt: number;
}

const svgCache = new Map<string, SvgCacheEntry>();

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

  // Default TTL: 15 minutes (safely below standard 60-minute AWS presigned expiration)
  return Date.now() + 15 * 60 * 1000;
}

export function clearSvgCache(url?: string): void {
  if (url) {
    svgCache.delete(url);
  } else {
    svgCache.clear();
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

export async function fetchAndCacheSvg(url: string): Promise<string> {
  const cached = getCachedSvg(url);
  if (cached) {
    return cached;
  }

  const res = await fetch(url);
  if (!res.ok) {
    svgCache.delete(url);
    if (res.status === 403) {
      throw new Error(`Floor plan URL has expired or access was denied (HTTP 403)`);
    }
    throw new Error(`Failed to load SVG: ${res.statusText} (${res.status})`);
  }

  const text = await res.text();
  let result = text;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'image/svg+xml');
    const svgElement = doc.querySelector('svg');

    if (svgElement) {
      svgElement.removeAttribute('width');
      svgElement.removeAttribute('height');
      svgElement.setAttribute('class', 'w-full h-full');
      svgElement.style.width = '100%';
      svgElement.style.height = '100%';
      result = svgElement.outerHTML;
    }
  } catch (e) {
    console.error('Error parsing SVG:', e);
  }

  const expiresAt = parseExpiration(url);
  svgCache.set(url, { html: result, expiresAt });
  return result;
}
