import { useState, useEffect } from "react";
import { fetchAndCacheSvg, getCachedSvg } from "../../../../../utils/svgCache";

export function useSvgFloorPlan(url: string | undefined) {
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!url) {
      setSvgContent(null);
      return;
    }

    let isMounted = true;
    
    // Check if we already have it in cache for instant render
    const cached = getCachedSvg(url);
    if (cached) {
      setSvgContent(cached);
      setLoading(false);
      return; // Already loaded
    }

    setLoading(true);
    setError(null);

    const loadSvg = async () => {
      try {
        const text = await fetchAndCacheSvg(url);
        if (isMounted) {
          setSvgContent(text);
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error("SVG fetch error:", err);
          setError(err instanceof Error ? err : new Error("Failed to load floor plan SVG"));
          setLoading(false);
        }
      }
    };

    loadSvg();

    return () => {
      isMounted = false;
    };
  }, [url]);

  return { svgContent, loading, error };
}
