const svgCache = new Map<string, string>();

export async function fetchAndCacheSvg(url: string): Promise<string> {
  if (svgCache.has(url)) {
    return svgCache.get(url)!;
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load SVG: ${res.statusText}`);
  }
  const text = await res.text();
  
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
      const parsedHtml = svgElement.outerHTML;
      svgCache.set(url, parsedHtml);
      return parsedHtml;
    }
  } catch (e) {
    console.error('Error parsing SVG:', e);
  }

  svgCache.set(url, text);
  return text;
}

export function getCachedSvg(url: string): string | undefined {
  return svgCache.get(url);
}
