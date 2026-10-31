import { useEffect, useRef } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { Plus, Minus, RotateCcw } from 'lucide-react';
import type { RoutePathNode } from '../types/navigation.types';

interface NavigationMapProps {
  svgContent: string;
  routeNodes?: RoutePathNode[];
  activeStepNodeIndex?: number;
  highlightedRoomId?: string | null;
}

export function NavigationMap({
  svgContent,
  routeNodes = [],
  activeStepNodeIndex = 0,
  highlightedRoomId,
}: NavigationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Inject route polyline and checkpoint pins into SVG DOM
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const svgElement = container.querySelector('svg');
    if (!svgElement) return;

    // Remove any previous route group
    const prevLayer = svgElement.querySelector('#visual-navigation-layer');
    if (prevLayer) {
      prevLayer.remove();
    }

    if (!routeNodes || routeNodes.length === 0) return;

    const ns = 'http://www.w3.org/2000/svg';
    const routeGroup = document.createElementNS(ns, 'g');
    routeGroup.setAttribute('id', 'visual-navigation-layer');

    // 1. Draw Polyline
    const pointsStr = routeNodes.map((n) => `${n.x},${n.y}`).join(' ');

    // Background glow/casing line
    const casingLine = document.createElementNS(ns, 'polyline');
    casingLine.setAttribute('points', pointsStr);
    casingLine.setAttribute('stroke', '#93C5FD');
    casingLine.setAttribute('stroke-width', '8');
    casingLine.setAttribute('stroke-linecap', 'round');
    casingLine.setAttribute('stroke-linejoin', 'round');
    casingLine.setAttribute('fill', 'none');
    casingLine.setAttribute('opacity', '0.6');
    routeGroup.appendChild(casingLine);

    // Main route line
    const mainLine = document.createElementNS(ns, 'polyline');
    mainLine.setAttribute('points', pointsStr);
    mainLine.setAttribute('stroke', '#2563EB');
    mainLine.setAttribute('stroke-width', '4.5');
    mainLine.setAttribute('stroke-linecap', 'round');
    mainLine.setAttribute('stroke-linejoin', 'round');
    mainLine.setAttribute('fill', 'none');
    routeGroup.appendChild(mainLine);

    // 2. Draw Checkpoint Nodes
    routeNodes.forEach((node, idx) => {
      const isStart = idx === 0;
      const isEnd = idx === routeNodes.length - 1;
      const isActive = idx === activeStepNodeIndex;

      const circle = document.createElementNS(ns, 'circle');
      circle.setAttribute('cx', String(node.x));
      circle.setAttribute('cy', String(node.y));

      if (isStart) {
        // Start Origin Pin (Green)
        circle.setAttribute('r', '7');
        circle.setAttribute('fill', '#10B981');
        circle.setAttribute('stroke', '#FFFFFF');
        circle.setAttribute('stroke-width', '2.5');
      } else if (isEnd) {
        // Destination Pin (Red/Blue)
        circle.setAttribute('r', '8');
        circle.setAttribute('fill', '#EF4444');
        circle.setAttribute('stroke', '#FFFFFF');
        circle.setAttribute('stroke-width', '2.5');
      } else if (isActive) {
        // Current active checkpoint (Large glowing blue)
        circle.setAttribute('r', '6.5');
        circle.setAttribute('fill', '#2563EB');
        circle.setAttribute('stroke', '#FFFFFF');
        circle.setAttribute('stroke-width', '2.5');
      } else {
        // Small checkpoint dot
        circle.setAttribute('r', '4');
        circle.setAttribute('fill', '#3B82F6');
        circle.setAttribute('stroke', '#FFFFFF');
        circle.setAttribute('stroke-width', '1.5');
      }

      routeGroup.appendChild(circle);
    });

    svgElement.appendChild(routeGroup);
  }, [svgContent, routeNodes, activeStepNodeIndex]);

  // Optional room highlight
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !highlightedRoomId) return;

    const shapes = container.querySelectorAll(
      `[id*="${highlightedRoomId.toLowerCase()}"], [id*="${highlightedRoomId.toUpperCase()}"]`
    );
    shapes.forEach((el) => {
      (el as HTMLElement).style.fill = '#EFF6FF';
      (el as HTMLElement).style.stroke = '#2563EB';
      (el as HTMLElement).style.strokeWidth = '2px';
    });
  }, [svgContent, highlightedRoomId]);

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
