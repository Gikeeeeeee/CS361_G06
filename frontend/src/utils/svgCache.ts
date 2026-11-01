const svgCache = new Map<string, string>();

// Dynamically discover all local building floor plan SVGs via Vite glob
// Zero hardcoding: Automatically matches any building/floor SVG in building-data
const localSvgModules = import.meta.glob<string>(
  '../../../../building-data/floor-plan/**/*.svg',
  { query: '?raw', import: 'default' }
);

function sanitizeAndFormatSvg(rawText: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawText, 'image/svg+xml');
    const svgElement = doc.querySelector('svg');

    if (svgElement) {
      svgElement.removeAttribute('width');
      svgElement.removeAttribute('height');
      svgElement.setAttribute('class', 'w-full h-full');
      svgElement.style.width = '100%';
      svgElement.style.height = '100%';
      return svgElement.outerHTML;
    }
  } catch (e) {
    console.error('Error parsing SVG:', e);
  }
  return rawText;
}

export async function fetchAndCacheSvg(url: string): Promise<string> {
  if (svgCache.has(url)) {
    return svgCache.get(url)!;
  }

  // 1. Try resolving from local building-data SVGs first (for local dev & edge cache bypass)
  const relativeKey = url.replace(/^.*\/floor-plan\//i, '').split('?')[0].toLowerCase();
  const matchedKey = Object.keys(localSvgModules).find((path) =>
    path.toLowerCase().endsWith(relativeKey)
  );

  if (matchedKey) {
    try {
      const rawText = await localSvgModules[matchedKey]();
      if (rawText) {
        const formatted = sanitizeAndFormatSvg(rawText);
        svgCache.set(url, formatted);
        return formatted;
      }
    } catch (err) {
      console.warn('Local SVG load fallback to remote:', err);
    }
  }

  // 2. Fetch from remote (CloudFront / S3 CDN)
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load SVG: ${res.statusText}`);
  }
  const text = await res.text();
  const formatted = sanitizeAndFormatSvg(text);
  svgCache.set(url, formatted);
  return formatted;
}

export function getCachedSvg(url: string): string | undefined {
  return svgCache.get(url);
}
