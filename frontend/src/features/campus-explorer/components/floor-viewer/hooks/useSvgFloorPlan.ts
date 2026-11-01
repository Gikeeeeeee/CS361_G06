import { useState, useEffect, useCallback, useRef } from "react";
import { fetchAndCacheSvg, getCachedSvg, clearSvgCache } from "../../../../../utils/svgCache";

export function useSvgFloorPlan(url: string | undefined) {
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const activeUrlRef = useRef<string | undefined>(url);

  useEffect(() => {
    activeUrlRef.current = url;
  }, [url]);

  const loadSvg = useCallback(async (targetUrl: string, isManualRetry = false) => {
    if (isManualRetry) {
      clearSvgCache(targetUrl);
    }

    // Check memory cache first
    const cached = getCachedSvg(targetUrl);
    if (cached) {
      if (activeUrlRef.current === targetUrl) {
        setSvgContent(cached);
        setLoading(false);
        setError(null);
      }
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const text = await fetchAndCacheSvg(targetUrl);
      if (activeUrlRef.current === targetUrl) {
        setSvgContent(text);
        setLoading(false);
        setError(null);
      }
    } catch (err: any) {
      if (activeUrlRef.current === targetUrl) {
        console.error("SVG fetch error:", err);
        setError(err instanceof Error ? err : new Error("Failed to load floor plan SVG"));
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    activeUrlRef.current = url;
    if (!url) {
      setSvgContent(null);
      setLoading(false);
      setError(null);
      return;
    }

    loadSvg(url);
  }, [url, loadSvg]);

  const retry = useCallback(() => {
    if (url) {
      loadSvg(url, true);
    }
  }, [url, loadSvg]);

  return { svgContent, loading, error, retry };
}
