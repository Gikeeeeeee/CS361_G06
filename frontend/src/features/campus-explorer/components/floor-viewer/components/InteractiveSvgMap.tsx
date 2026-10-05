import { useEffect, useRef } from "react";

interface InteractiveSvgMapProps {
  svgContent: string;
  highlightedRoomId?: string | null;
  onRoomClick?: (roomId: string, rawElementId: string) => void;
}

function normalizeRoomId(id: string | null | undefined): string {
  if (!id) return "";
  return id
    .toLowerCase()
    .trim()
    .replace(/^(lc[0-9]+|sc[0-9]+)-/i, "") // strip building prefix e.g. LC3-, LC4-
    .replace(/^(room-|facility-)/, "")
    .replace(/\//g, "-"); // convert / to -
}

export function InteractiveSvgMap({
  svgContent,
  highlightedRoomId,
  onRoomClick,
}: InteractiveSvgMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Click handler on rooms and facilities
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !onRoomClick) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | SVGElement | null;
      if (!target) return;

      // Find closest interactable room or facility shape
      const interactable = target.closest(
        '.room-shape, .facility-shape, [id^="room-"], [id^="facility-"], g[id], rect[id], path[id], polygon[id]'
      ) as Element | null;

      if (interactable && interactable.id) {
        const rawId = interactable.id;
        const cleanId = rawId.replace(/^(room-|facility-)/, "");
        onRoomClick(cleanId, rawId);
      }
    };

    container.addEventListener("click", handleClick);
    return () => {
      container.removeEventListener("click", handleClick);
    };
  }, [onRoomClick, svgContent]);

  // Exact element and text highlighting in SVG
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Reset all previous highlights on shapes
    const allShapes = container.querySelectorAll(
      ".room-shape, .facility-shape, [id^='room-'], [id^='facility-'], rect[id], polygon[id], path[id]"
    );
    allShapes.forEach((el) => {
      el.classList.remove("highlight");
      (el as HTMLElement).style.fill = "";
      (el as HTMLElement).style.stroke = "";
      (el as HTMLElement).style.strokeWidth = "";
    });

    // 2. Reset all text colors
    const allText = container.querySelectorAll("text");
    allText.forEach((t) => {
      t.style.fill = "";
      t.style.fontWeight = "";
    });

    if (!highlightedRoomId) return;

    const targetNorm = normalizeRoomId(highlightedRoomId); // e.g. "101" or "101-1"
    if (!targetNorm) return;

    // 3. Find shape element with EXACT match (priority: #room-target, [id="room-target"], exact normalized match)
    let matchedShape: Element | null = null;

    // Direct selectors
    matchedShape =
      container.querySelector(`[id="room-${targetNorm}"]`) ||
      container.querySelector(`[id="facility-${targetNorm}"]`) ||
      container.querySelector(`[id="${targetNorm}"]`);

    // If not found by direct selector, search among all interactable elements for exact normalized ID
    if (!matchedShape) {
      for (const el of Array.from(allShapes)) {
        if (normalizeRoomId(el.id) === targetNorm) {
          matchedShape = el;
          break;
        }
      }
    }

    // Apply active highlight to ONLY the matched shape
    if (matchedShape) {
      const shapesToHighlight =
        matchedShape.tagName.toLowerCase() === "g"
          ? [matchedShape, ...Array.from(matchedShape.querySelectorAll("rect, polygon, path"))]
          : [matchedShape];

      shapesToHighlight.forEach((el) => {
        el.classList.add("highlight");
        (el as HTMLElement).style.setProperty("fill", "#2563EB", "important");
        (el as HTMLElement).style.setProperty("stroke", "#1D4ED8", "important");
        (el as HTMLElement).style.setProperty("stroke-width", "2.5px", "important");
      });
    }

    // 4. Highlight matching text element with EXACT match
    allText.forEach((t) => {
      const textContent = t.textContent?.trim() || "";
      const textNorm = normalizeRoomId(textContent);

      const isTextMatch =
        textNorm === targetNorm ||
        textContent.toLowerCase() === highlightedRoomId.toLowerCase() ||
        (textContent.includes(targetNorm) && !/[0-9]/.test(textContent.replace(targetNorm, "")));

      if (isTextMatch) {
        t.style.setProperty("fill", "#ffffff", "important");
        t.style.setProperty("font-weight", "bold", "important");
      }
    });
  }, [highlightedRoomId, svgContent]);

  // Base styles for container and interactive shapes
  const dynamicStyles = `
    .svg-map-container {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      user-select: none;
    }
    
    .svg-map-container svg {
      width: 100%;
      height: auto;
      max-height: 100%;
      display: block;
    }
    
    .svg-map-container svg text {
      pointer-events: none;
      user-select: none;
    }
    
    .svg-map-container svg path,
    .svg-map-container svg rect,
    .svg-map-container svg polygon {
      transition: fill 0.2s ease, stroke 0.2s ease;
    }
    
    /* Cursor pointer for clickable shapes */
    .svg-map-container svg .room-shape,
    .svg-map-container svg .facility-shape,
    .svg-map-container svg [id^="room-"],
    .svg-map-container svg [id^="facility-"],
    .svg-map-container svg g[id] > * {
      cursor: pointer;
    }

    /* Hover style */
    .svg-map-container svg .room-shape:hover,
    .svg-map-container svg .facility-shape:hover,
    .svg-map-container svg [id^="room-"]:hover,
    .svg-map-container svg [id^="facility-"]:hover,
    .svg-map-container svg g[id]:hover > * {
      fill: #93C5FD !important; /* blue-300 */
      opacity: 0.95;
    }

    /* Active Highlight style class */
    .svg-map-container svg .highlight {
      fill: #2563EB !important;
      stroke: #1D4ED8 !important;
      stroke-width: 2.5px !important;
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
