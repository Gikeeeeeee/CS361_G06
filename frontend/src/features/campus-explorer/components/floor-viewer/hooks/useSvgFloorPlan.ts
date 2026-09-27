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

    fetch(url)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch SVG: ${res.statusText}`);
        }
        return res.text();
      })
      .then((text) => {
        if (isMounted) {
          try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, "image/svg+xml");
            const svgElement = doc.querySelector("svg");
            
            if (svgElement) {
              // Ensure responsive behavior
              svgElement.removeAttribute("width");
              svgElement.removeAttribute("height");
              svgElement.setAttribute("class", "w-full h-full");
              svgElement.style.width = "100%";
              svgElement.style.height = "100%";
              
              setSvgContent(svgElement.outerHTML);
            } else {
              throw new Error("Invalid SVG format");
            }
          } catch (e) {
            console.error("Error parsing SVG:", e);
            setSvgContent(text); // Fallback to raw text
          }
        }
      })
      .catch((err) => {
        console.error("SVG Fetch Error:", err);
        if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [url]);

  return { svgContent, loading, error };
}
