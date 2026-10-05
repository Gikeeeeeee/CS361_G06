import { useState, useEffect } from "react";

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
      try {
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Failed to load SVG: ${res.statusText}`);
        }
        const text = await res.text();
        if (isMounted) {
          setSvgContent(parseAndSetSvg(text));
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

    fetchSvg();

    return () => {
      isMounted = false;
    };
  }, [url]);

  return { svgContent, loading, error };
}
