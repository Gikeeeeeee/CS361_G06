import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAndCacheSvg, clearSvgCache } from '../../../../../utils/svgCache';

type SvgState = { url: string | undefined; svgContent: string | null; loading: boolean; error: Error | null };

export function useSvgFloorPlan(url: string | undefined, refreshUrl?: () => Promise<string | undefined>) {
  const [state, setState] = useState<SvgState>({ url, svgContent: null, loading: !!url, error: null });
  const generation = useRef(0);
  const refreshRef = useRef(refreshUrl);
  useEffect(() => { refreshRef.current = refreshUrl; }, [refreshUrl]);

  const load = useCallback(async (source: string, manual = false) => {
    const id = ++generation.current;
    setState({ url: source, svgContent: null, loading: true, error: null });
    try {
      const target = manual && refreshRef.current ? await refreshRef.current() : source;
      if (id !== generation.current) return;
      if (!target) throw new Error('Floor plan unavailable for this level.');
      if (manual) clearSvgCache(target);
      const svgContent = await fetchAndCacheSvg(target, manual);
      if (id === generation.current) setState({ url: source, svgContent, loading: false, error: null });
    } catch (err: unknown) {
      if (id === generation.current) setState({ url: source, svgContent: null, loading: false,
        error: err instanceof Error ? err : new Error('Failed to load floor plan') });
    }
  }, []);

  useEffect(() => {
    if (url) void load(url);
    else setState({ url, svgContent: null, loading: false, error: null });
    return () => { ++generation.current; };
  }, [url, load]);

  const retry = useCallback(() => { if (url) void load(url, true); }, [url, load]);
  // Hide the previous floor synchronously, before effects run for the new URL.
  const visible = state.url === url ? state : { svgContent: null, loading: !!url, error: null };
  return { svgContent: visible.svgContent, loading: visible.loading, error: visible.error, retry };
}
