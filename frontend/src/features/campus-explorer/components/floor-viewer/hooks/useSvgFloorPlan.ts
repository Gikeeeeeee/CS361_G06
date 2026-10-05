import { useState, useEffect } from "react";

export function useSvgFloorPlan(url: string | undefined, fallbackUrl?: string) {
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const targetUrl = url || fallbackUrl;
    if (!targetUrl) {
      setSvgContent(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    const parseAndSetSvg = (text: string) => {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "image/svg+xml");
        const svgElement = doc.querySelector("svg");
        
        if (svgElement) {
          svgElement.removeAttribute("width");
          svgElement.removeAttribute("height");
          svgElement.setAttribute("class", "w-full h-full");
          svgElement.style.width = "100%";
          svgElement.style.height = "100%";
          return svgElement.outerHTML;
        }
      } catch (e) {
        console.error("Error parsing SVG:", e);
      }
      return text;
    };

    const fetchSvg = async () => {
      // First attempt with primary url
      if (url) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            const text = await res.text();
            if (isMounted) {
              setSvgContent(parseAndSetSvg(text));
              setLoading(false);
              return;
            }
          }
        } catch (primaryErr) {
          console.warn("Primary SVG fetch failed, trying fallback:", primaryErr);
        }
      }

      // Second attempt with fallbackUrl
      if (fallbackUrl) {
        try {
          const res = await fetch(fallbackUrl);
          if (res.ok) {
            const text = await res.text();
            if (isMounted) {
              setSvgContent(parseAndSetSvg(text));
              setLoading(false);
              return;
            }
          }
        } catch (fallbackErr) {
          console.error("Fallback SVG fetch failed:", fallbackErr);
        }
      }

      if (isMounted) {
        setError(new Error("Failed to load floor plan SVG"));
        setLoading(false);
      }
    };

    fetchSvg();

    return () => {
      isMounted = false;
    };
  }, [url, fallbackUrl]);

  return { svgContent, loading, error };
}
