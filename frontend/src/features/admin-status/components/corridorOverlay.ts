import type { CorridorStatusItem, FloorStatusOverlayData } from '../types/status.types';

export interface CorridorSegment extends CorridorStatusItem {
  from_node_id: string;
  to_node_id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Join only real graph endpoints. Missing geometry must never become a fake line. */
export function getCorridorSegments(data: FloorStatusOverlayData | null): CorridorSegment[] {
  if (!data) return [];
  const nodes = new Map(data.navigation_nodes.map(node => [node.node_id, node]));
  return data.corridor_edges.flatMap(edge => {
    const from = nodes.get(edge.from_node_id || '');
    const to = nodes.get(edge.to_node_id || '');
    if (!from || !to || !edge.from_node_id || !edge.to_node_id ||
      ![from.svg_x, from.svg_y, to.svg_x, to.svg_y].every(value => typeof value === 'number' && Number.isFinite(value))) return [];
    return [{ ...edge, from_node_id: edge.from_node_id, to_node_id: edge.to_node_id,
      x1: from.svg_x!, y1: from.svg_y!, x2: to.svg_x!, y2: to.svg_y! }];
  });
}

/** Uses the original SVG coordinate system, so pan/zoom and viewBox remain aligned. */
export function appendCorridorOverlay(svg: SVGSVGElement, segments: CorridorSegment[], selectedId?: string | null) {
  const ns = 'http://www.w3.org/2000/svg';
  const group = document.createElementNS(ns, 'g');
  group.setAttribute('data-corridor-overlay', '');
  for (const edge of segments) {
    const item = document.createElementNS(ns, 'g');
    item.setAttribute('data-corridor-id', edge.edge_id);
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.setAttribute('aria-label', `Corridor ${edge.edge_id}: ${edge.status}`);
    item.setAttribute('aria-pressed', String(edge.edge_id === selectedId));
    item.style.cursor = 'pointer';
    const title = document.createElementNS(ns, 'title');
    title.textContent = `${edge.edge_id}: ${edge.from_node_id} → ${edge.to_node_id} — ${edge.status}`;
    item.append(title);
    // Give horizontal/vertical segments a nonzero focus box as well as a central touch target.
    const touchTarget = document.createElementNS(ns, 'circle');
    touchTarget.setAttribute('cx', String((edge.x1 + edge.x2) / 2));
    touchTarget.setAttribute('cy', String((edge.y1 + edge.y2) / 2));
    touchTarget.setAttribute('r', '22');
    touchTarget.setAttribute('fill', 'transparent');
    item.append(touchTarget);
    for (const [color, width] of [[edge.edge_id === selectedId ? '#2563eb' : '#ffffff', '10'], [edge.status === 'BLOCKED' ? '#dc2626' : '#059669', '5'], ['transparent', '44']]) {
      const line = document.createElementNS(ns, 'line');
      for (const key of ['x1', 'y1', 'x2', 'y2'] as const) line.setAttribute(key, String(edge[key]));
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', width);
      line.setAttribute('vector-effect', 'non-scaling-stroke');
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('pointer-events', 'stroke');
      if (edge.status === 'BLOCKED' && width === '5') line.setAttribute('stroke-dasharray', '8 5');
      item.append(line);
    }
    if (edge.status === 'BLOCKED') {
      const marker = document.createElementNS(ns, 'text');
      marker.setAttribute('x', String((edge.x1 + edge.x2) / 2));
      marker.setAttribute('y', String((edge.y1 + edge.y2) / 2));
      marker.setAttribute('fill', '#dc2626');
      marker.setAttribute('text-anchor', 'middle');
      marker.setAttribute('font-size', '18');
      marker.textContent = '⊘';
      item.append(marker);
    }
    group.append(item);
  }
  svg.append(group);
  return () => group.remove();
}
