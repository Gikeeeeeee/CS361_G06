import { useEffect, useRef } from "react";
import { Plus, Minus, RotateCcw } from "lucide-react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

interface InteractiveSvgMapProps {
  svgContent: string;
  highlightedRoomId?: string | null;
  onRoomClick?: (roomId: string, rawElementId: string) => void;
  enableZoomPan?: boolean;
  minScale?: number;
  maxScale?: number;
  showControls?: boolean;
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
  enableZoomPan = true,
  minScale = 0.6,
  maxScale = 4,
  showControls = true,
}: InteractiveSvgMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  // Click handler on rooms and facilities with drag distinction
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !onRoomClick) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      pointerStartRef.current = { x: clientX, y: clientY };
      isDraggingRef.current = false;
    };

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (pointerStartRef.current && !isDraggingRef.current) {
        const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
        const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
        const dist = Math.hypot(
          clientX - pointerStartRef.current.x,
          clientY - pointerStartRef.current.y
        );
        if (dist > 7) {
          isDraggingRef.current = true;
        }
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        // Panned or pinched - cancel selection
        isDraggingRef.current = false;
        return;
      }

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

    container.addEventListener("mousedown", handlePointerDown as EventListener, { passive: true });
    container.addEventListener("mousemove", handlePointerMove as EventListener, { passive: true });
    container.addEventListener("touchstart", handlePointerDown as EventListener, { passive: true });
    container.addEventListener("touchmove", handlePointerMove as EventListener, { passive: true });
    container.addEventListener("click", handleClick);

    return () => {
      container.removeEventListener("mousedown", handlePointerDown as EventListener);
      container.removeEventListener("mousemove", handlePointerMove as EventListener);
      container.removeEventListener("touchstart", handlePointerDown as EventListener);
      container.removeEventListener("touchmove", handlePointerMove as EventListener);
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
    .svg-map-wrapper {
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      touch-action: none;
      user-select: none;
    }

    .svg-map-container {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      user-select: none;
      touch-action: none;
    }
    
    .svg-map-container svg {
      width: 100%;
      height: 100%;
      max-width: 100%;
      max-height: 100%;
      display: block;
      touch-action: none;
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

  const mapSvgContent = (
    <div
      ref={containerRef}
      className="svg-map-container w-full h-full"
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );

  if (!enableZoomPan) {
    return (
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        <style>{dynamicStyles}</style>
        {mapSvgContent}
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      <style>{dynamicStyles}</style>
      <TransformWrapper
        initialScale={1}
        minScale={minScale}
        maxScale={maxScale}
        centerOnInit={true}
        limitToBounds={true}
        centerZoomedOut={true}
        smooth={true}
        wheel={{ step: 0.12 }}
        pinch={{ step: 4 }}
        panning={{
          velocityDisabled: false,
          allowLeftClickPan: true,
        }}
        doubleClick={{
          disabled: false,
          mode: "zoomIn",
          step: 0.4,
        }}
        onPanning={() => {
          isDraggingRef.current = true;
        }}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            {/* Zoom / Pan Floating Control Buttons */}
            {showControls && (
              <div
                className="absolute bottom-3 right-3 z-30 flex flex-col items-center bg-white/95 backdrop-blur-md rounded-xl border border-slate-200/90 shadow-md p-1 gap-1 select-none"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button
                  id="svg-zoom-in-btn"
                  type="button"
                  onClick={() => zoomIn(0.25)}
                  aria-label="Zoom in"
                  title="Zoom In"
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-700 hover:text-blue-600 hover:bg-slate-100 active:scale-95 transition-all focus:outline-none"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                </button>
                <button
                  id="svg-zoom-out-btn"
                  type="button"
                  onClick={() => zoomOut(0.25)}
                  aria-label="Zoom out"
                  title="Zoom Out"
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-700 hover:text-blue-600 hover:bg-slate-100 active:scale-95 transition-all focus:outline-none"
                >
                  <Minus className="w-4 h-4 stroke-[2.5]" />
                </button>
                <div className="w-5 h-[1px] bg-slate-200 my-0.5" />
                <button
                  id="svg-zoom-reset-btn"
                  type="button"
                  onClick={() => resetTransform()}
                  aria-label="Reset view"
                  title="Reset View"
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-700 hover:text-blue-600 hover:bg-slate-100 active:scale-95 transition-all focus:outline-none"
                >
                  <RotateCcw className="w-4 h-4 stroke-[2]" />
                </button>
              </div>
            )}

            {/* Transform Pan & Zoom Canvas */}
            <TransformComponent
              wrapperClass="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
              contentClass="w-full h-full flex items-center justify-center"
              wrapperStyle={{ width: "100%", height: "100%", overflow: "hidden" }}
              contentStyle={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {mapSvgContent}
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </div>
  );
}
