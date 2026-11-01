import { useEffect, useRef } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { Plus, Minus, RotateCcw, MapPin } from 'lucide-react';
import type { RoutePathNode } from '../types/navigation.types';

interface NavigationMapProps {
  svgContent: string;
  routeNodes?: RoutePathNode[];
  activeStepNodeIndex?: number;
  highlightedRoomId?: string | null;
  isFinished?: boolean;
}

/**
 * Helper to locate the room element inside the SVG DOM by roomId or room name/number
 */
function findRoomElement(
  svgElement: SVGSVGElement,
  roomIdOrName: string | null | undefined
): SVGGraphicsElement | null {
  if (!roomIdOrName) return null;
  const raw = roomIdOrName.trim();
  // Strip common room prefixes (e.g. "Room 201" -> "201", "RM_LAB106" -> "LAB106")
  const clean = raw
    .replace(/^room\s*/i, '')
    .replace(/^rm_/i, '')
    .trim()
    .toLowerCase();

  // 1. Direct ID selectors
  const directSelectors = [
    `#room-${clean}`,
    `#${clean}`,
    `#room-${raw.toLowerCase()}`,
    `[id*="${clean}"]`,
  ];
  for (const sel of directSelectors) {
    try {
      const el = svgElement.querySelector(sel) as SVGGraphicsElement;
      if (el) return el;
    } catch {
      // ignore invalid selector syntax
    }
  }

  // 2. Search through text labels and select neighboring room polygon / rect / path
  const textElements = Array.from(svgElement.querySelectorAll('text'));
  for (const t of textElements) {
    const textContent = (t.textContent || '').trim().toLowerCase();
    if (textContent === clean || textContent.includes(clean)) {
      const prev = t.previousElementSibling as SVGGraphicsElement;
      if (
        prev &&
        (prev.tagName === 'rect' || prev.tagName === 'path' || prev.tagName === 'polygon')
      ) {
        return prev;
      }
      const parent = t.parentElement;
      if (parent) {
        const shape = parent.querySelector('rect, path, polygon') as SVGGraphicsElement;
        if (shape) return shape;
      }
      return t as SVGGraphicsElement;
    }
  }

  return null;
}

export function NavigationMap({
  svgContent,
  routeNodes = [],
  activeStepNodeIndex = 0,
  highlightedRoomId,
  isFinished = false,
}: NavigationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  if (!svgContent) {
    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center p-6 text-center text-slate-400 bg-slate-50">
        <MapPin className="w-10 h-10 opacity-30 text-slate-400 mb-2" />
        <p className="text-xs font-semibold text-slate-600">Floor Plan Unavailable</p>
        <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
          No SVG floor plan found in database for this floor.
        </p>
      </div>
    );
  }

  // Inject interactive turn-by-turn route, black user marker, active step segment, and room highlight into SVG DOM
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const svgElement = container.querySelector('svg');
    if (!svgElement) return;

    // Clean up any previously injected navigation layers
    const prevLayer = svgElement.querySelector('#visual-navigation-layer');
    if (prevLayer) {
      prevLayer.remove();
    }

    // Reset previous room highlights
    const prevHighlighted = svgElement.querySelectorAll('.nav-room-highlight');
    prevHighlighted.forEach((el) => {
      el.classList.remove('nav-room-highlight', 'highlight');
      (el as SVGElement).style.fill = '';
      (el as SVGElement).style.stroke = '';
      (el as SVGElement).style.strokeWidth = '';
    });

    const ns = 'http://www.w3.org/2000/svg';
    const routeGroup = document.createElementNS(ns, 'g');
    routeGroup.setAttribute('id', 'visual-navigation-layer');

    // 1. Highlight Destination Room & calibrate destination coordinate
    let adjustedNodes = [...routeNodes];
    const roomEl = findRoomElement(svgElement, highlightedRoomId);
    if (roomEl) {
      roomEl.classList.add('nav-room-highlight', 'highlight');
      roomEl.style.fill = '#3B82F6';
      roomEl.style.stroke = '#1D4ED8';
      roomEl.style.strokeWidth = '3px';
      roomEl.style.transition = 'all 0.3s ease';

      try {
        const bbox = roomEl.getBBox();
        const roomCenterX = Math.round(bbox.x + bbox.width / 2);
        const roomCenterY = Math.round(bbox.y + bbox.height / 2);

        if (adjustedNodes.length > 0) {
          const lastIdx = adjustedNodes.length - 1;
          adjustedNodes[lastIdx] = {
            ...adjustedNodes[lastIdx],
            x: roomCenterX,
            y: roomCenterY,
          };
        }
      } catch {
        // Fallback to predetermined node coordinates
      }
    }

    if (!adjustedNodes || adjustedNodes.length === 0) return;

    // 2. Draw Full Base Route Path (Normal Route: Blue Polyline)
    // Background glow casing
    for (let i = 0; i < adjustedNodes.length - 1; i++) {
      const p1 = adjustedNodes[i];
      const p2 = adjustedNodes[i + 1];

      const casing = document.createElementNS(ns, 'line');
      casing.setAttribute('x1', String(p1.x));
      casing.setAttribute('y1', String(p1.y));
      casing.setAttribute('x2', String(p2.x));
      casing.setAttribute('y2', String(p2.y));
      casing.setAttribute('stroke', '#BFDBFE');
      casing.setAttribute('stroke-width', '8');
      casing.setAttribute('stroke-linecap', 'round');
      casing.setAttribute('opacity', '0.65');
      routeGroup.appendChild(casing);

      const mainLine = document.createElementNS(ns, 'line');
      mainLine.setAttribute('x1', String(p1.x));
      mainLine.setAttribute('y1', String(p1.y));
      mainLine.setAttribute('x2', String(p2.x));
      mainLine.setAttribute('y2', String(p2.y));
      mainLine.setAttribute('stroke', '#2563EB');
      mainLine.setAttribute('stroke-width', '4.5');
      mainLine.setAttribute('stroke-linecap', 'round');
      routeGroup.appendChild(mainLine);
    }

    // 3. Draw Active Step Segment (Distinct Highlight Color: Vibrant Amber/Orange)
    // Only the segment corresponding to activeStepNodeIndex is highlighted with distinct color;
    // previous segments revert to normal blue route line.
    const activeSegIdx = Math.min(activeStepNodeIndex, adjustedNodes.length - 2);
    if (!isFinished && activeSegIdx >= 0 && activeSegIdx < adjustedNodes.length - 1) {
      const stepStart = adjustedNodes[activeSegIdx];
      const stepEnd = adjustedNodes[activeSegIdx + 1];

      // Active glowing aura
      const activeGlow = document.createElementNS(ns, 'line');
      activeGlow.setAttribute('x1', String(stepStart.x));
      activeGlow.setAttribute('y1', String(stepStart.y));
      activeGlow.setAttribute('x2', String(stepEnd.x));
      activeGlow.setAttribute('y2', String(stepEnd.y));
      activeGlow.setAttribute('stroke', '#FEF3C7');
      activeGlow.setAttribute('stroke-width', '13');
      activeGlow.setAttribute('stroke-linecap', 'round');
      activeGlow.setAttribute('opacity', '0.9');
      routeGroup.appendChild(activeGlow);

      // Distinct active line with dynamic dashes
      const activeLine = document.createElementNS(ns, 'line');
      activeLine.setAttribute('x1', String(stepStart.x));
      activeLine.setAttribute('y1', String(stepStart.y));
      activeLine.setAttribute('x2', String(stepEnd.x));
      activeLine.setAttribute('y2', String(stepEnd.y));
      activeLine.setAttribute('stroke', '#F59E0B');
      activeLine.setAttribute('stroke-width', '6.5');
      activeLine.setAttribute('stroke-linecap', 'round');
      activeLine.setAttribute('stroke-dasharray', '10 5');
      routeGroup.appendChild(activeLine);

      // End-of-step target dot showing where the user needs to walk to in this step
      const stepEndDot = document.createElementNS(ns, 'circle');
      stepEndDot.setAttribute('cx', String(stepEnd.x));
      stepEndDot.setAttribute('cy', String(stepEnd.y));
      stepEndDot.setAttribute('r', '6.5');
      stepEndDot.setAttribute('fill', '#F59E0B');
      stepEndDot.setAttribute('stroke', '#FFFFFF');
      stepEndDot.setAttribute('stroke-width', '2.5');
      routeGroup.appendChild(stepEndDot);
    }

    // 4. Draw Intermediate Checkpoint Nodes
    adjustedNodes.forEach((node, idx) => {
      const isStart = idx === 0;
      const isEnd = idx === adjustedNodes.length - 1;

      if (!isStart && !isEnd) {
        const dot = document.createElementNS(ns, 'circle');
        dot.setAttribute('cx', String(node.x));
        dot.setAttribute('cy', String(node.y));
        dot.setAttribute('r', '4');
        dot.setAttribute('fill', '#3B82F6');
        dot.setAttribute('stroke', '#FFFFFF');
        dot.setAttribute('stroke-width', '1.5');
        routeGroup.appendChild(dot);
      }
    });

    // 5. Destination Pin at Final Room
    const destNode = adjustedNodes[adjustedNodes.length - 1];
    if (destNode) {
      const destPin = document.createElementNS(ns, 'circle');
      destPin.setAttribute('cx', String(destNode.x));
      destPin.setAttribute('cy', String(destNode.y));
      destPin.setAttribute('r', '8.5');
      destPin.setAttribute('fill', isFinished ? '#10B981' : '#EF4444');
      destPin.setAttribute('stroke', '#FFFFFF');
      destPin.setAttribute('stroke-width', '2.5');
      routeGroup.appendChild(destPin);

      // Destination Tag Label
      const tagGroup = document.createElementNS(ns, 'g');
      const tagBg = document.createElementNS(ns, 'rect');
      tagBg.setAttribute('x', String(destNode.x - 22));
      tagBg.setAttribute('y', String(destNode.y - 25));
      tagBg.setAttribute('width', '44');
      tagBg.setAttribute('height', '14');
      tagBg.setAttribute('rx', '3');
      tagBg.setAttribute('fill', isFinished ? '#10B981' : '#EF4444');
      tagGroup.appendChild(tagBg);

      const tagText = document.createElementNS(ns, 'text');
      tagText.setAttribute('x', String(destNode.x));
      tagText.setAttribute('y', String(destNode.y - 14.5));
      tagText.setAttribute('fill', '#FFFFFF');
      tagText.setAttribute('font-size', '8');
      tagText.setAttribute('font-weight', 'bold');
      tagText.setAttribute('text-anchor', 'middle');
      tagText.textContent = isFinished ? 'ARRIVED' : 'ROOM';
      tagGroup.appendChild(tagText);

      routeGroup.appendChild(tagGroup);
    }

    // 6. User Marker: Black Circle Pin at Current Step Position
    // As user progresses (step 1 -> step 2 -> step 3), the black marker moves to that step's node
    const userNodeIdx = isFinished
      ? adjustedNodes.length - 1
      : Math.min(activeStepNodeIndex, adjustedNodes.length - 1);
    const userNode = adjustedNodes[userNodeIdx] || adjustedNodes[0];

    if (userNode) {
      const userGroup = document.createElementNS(ns, 'g');
      userGroup.setAttribute('id', 'user-location-marker');

      // Outer pulsing beacon ring
      const beacon = document.createElementNS(ns, 'circle');
      beacon.setAttribute('cx', String(userNode.x));
      beacon.setAttribute('cy', String(userNode.y));
      beacon.setAttribute('r', '15');
      beacon.setAttribute('fill', '#0F172A');
      beacon.setAttribute('opacity', '0.18');
      userGroup.appendChild(beacon);

      // White outline ring
      const outerWhite = document.createElementNS(ns, 'circle');
      outerWhite.setAttribute('cx', String(userNode.x));
      outerWhite.setAttribute('cy', String(userNode.y));
      outerWhite.setAttribute('r', '8.5');
      outerWhite.setAttribute('fill', '#FFFFFF');
      userGroup.appendChild(outerWhite);

      // Solid Black User Marker (วงกลมสีดำ user)
      const blackCircle = document.createElementNS(ns, 'circle');
      blackCircle.setAttribute('cx', String(userNode.x));
      blackCircle.setAttribute('cy', String(userNode.y));
      blackCircle.setAttribute('r', '5.5');
      blackCircle.setAttribute('fill', '#0F172A');
      userGroup.appendChild(blackCircle);

      // "YOU" Badge above User Marker
      const youBadge = document.createElementNS(ns, 'g');
      const badgeBg = document.createElementNS(ns, 'rect');
      badgeBg.setAttribute('x', String(userNode.x - 14));
      badgeBg.setAttribute('y', String(userNode.y - 22));
      badgeBg.setAttribute('width', '28');
      badgeBg.setAttribute('height', '13');
      badgeBg.setAttribute('rx', '3');
      badgeBg.setAttribute('fill', '#0F172A');
      youBadge.appendChild(badgeBg);

      const badgeText = document.createElementNS(ns, 'text');
      badgeText.setAttribute('x', String(userNode.x));
      badgeText.setAttribute('y', String(userNode.y - 12.5));
      badgeText.setAttribute('fill', '#FFFFFF');
      badgeText.setAttribute('font-size', '8');
      badgeText.setAttribute('font-weight', 'bold');
      badgeText.setAttribute('text-anchor', 'middle');
      badgeText.textContent = 'YOU';
      youBadge.appendChild(badgeText);

      userGroup.appendChild(youBadge);
      routeGroup.appendChild(userGroup);
    }

    svgElement.appendChild(routeGroup);
  }, [svgContent, routeNodes, activeStepNodeIndex, highlightedRoomId, isFinished]);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-slate-50 select-none">
      <TransformWrapper
        initialScale={1}
        minScale={0.5}
        maxScale={4}
        centerOnInit={true}
        limitToBounds={true}
        centerZoomedOut={true}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            {/* Zoom Controls */}
            <div
              className="absolute top-4 right-4 z-20 flex flex-col items-center bg-white/95 backdrop-blur-md rounded-xl shadow-md border border-slate-200/80 p-1 gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => zoomIn(0.25)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-700 hover:text-blue-600 hover:bg-slate-100 transition-colors"
                title="Zoom In"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
              </button>
              <button
                type="button"
                onClick={() => zoomOut(0.25)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-700 hover:text-blue-600 hover:bg-slate-100 transition-colors"
                title="Zoom Out"
              >
                <Minus className="w-4 h-4 stroke-[2.5]" />
              </button>
              <div className="w-5 h-[1px] bg-slate-200" />
              <button
                type="button"
                onClick={() => resetTransform()}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-700 hover:text-blue-600 hover:bg-slate-100 transition-colors"
                title="Reset View"
              >
                <RotateCcw className="w-4 h-4 stroke-[2]" />
              </button>
            </div>

            {/* Map Canvas */}
            <TransformComponent
              wrapperClass="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
              contentClass="w-full h-full flex items-center justify-center"
              wrapperStyle={{ width: '100%', height: '100%' }}
              contentStyle={{ width: '100%', height: '100%' }}
            >
              <div
                ref={containerRef}
                className="w-full h-full flex items-center justify-center"
                dangerouslySetInnerHTML={{ __html: svgContent }}
              />
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </div>
  );
}
