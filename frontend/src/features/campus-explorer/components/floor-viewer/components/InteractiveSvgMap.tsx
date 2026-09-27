import { useEffect, useRef } from "react";
import { useRoomHighlight } from "../hooks/useRoomHighlight";

interface InteractiveSvgMapProps {
  svgContent: string;
  onRoomClick?: (roomId: string) => void;
}

export function InteractiveSvgMap({ svgContent }: InteractiveSvgMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { highlightedRoomId } = useRoomHighlight();

  // Effect to change font color of the highlighted room to white
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const allText = container.querySelectorAll("text");
    
    // Reset all text to default
    allText.forEach(t => {
      t.style.fill = ""; 
    });

    if (highlightedRoomId) {
      const searchStr = highlightedRoomId.toLowerCase();
      allText.forEach(t => {
        if (t.textContent?.toLowerCase().includes(searchStr)) {
          t.style.fill = "#ffffff";
        }
      });
    }
  }, [highlightedRoomId, svgContent]);

  // Inject styles to highlight the active room and style default rooms
  const dynamicStyles = `
    .svg-map-container {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
    }
    
    .svg-map-container svg {
      width: 100%;
      height: auto;
      max-height: 100%;
      display: block;
    }
    
    .svg-map-container svg path,
    .svg-map-container svg rect,
    .svg-map-container svg polygon {
      transition: fill 0.2s ease, stroke 0.2s ease;
      cursor: default;
    }
    
    /* Default style for interactable shapes */
    .svg-map-container svg g[id] > *,
    .svg-map-container svg path[id],
    .svg-map-container svg rect[id],
    .svg-map-container svg polygon[id] {
      fill: #F1F5F9; /* slate-100 */
      stroke: #CBD5E1; /* slate-300 */
      stroke-width: 1px;
      vector-effect: non-scaling-stroke;
    }

    /* Hover style */
    .svg-map-container svg g[id]:hover > *,
    .svg-map-container svg path[id]:hover,
    .svg-map-container svg rect[id]:hover,
    .svg-map-container svg polygon[id]:hover {
      fill: #DBEAFE; /* blue-100 */
    }

    /* Active Highlight style */
    ${
      highlightedRoomId
        ? `
      .svg-map-container svg g[id*="${highlightedRoomId}"] > *,
      .svg-map-container svg path[id*="${highlightedRoomId}"],
      .svg-map-container svg rect[id*="${highlightedRoomId}"],
      .svg-map-container svg polygon[id*="${highlightedRoomId}"] {
        fill: #2563EB !important; /* blue-600 */
        stroke: #1D4ED8 !important; /* blue-700 */
      }
    `
        : ""
    }
  `;

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <style>{dynamicStyles}</style>
      <div
        ref={containerRef}
        className="svg-map-container w-full h-full"
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </div>
  );
}
