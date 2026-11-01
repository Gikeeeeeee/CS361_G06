import type { RouteResult, RouteSearchParams, QRCheckpoint, RoutePathNode } from '../types/navigation.types';
import { campusService } from '../../campus-explorer/services';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

/**
 * Standard campus checkpoints with physical QR codes matching backend navigation graph nodes
 */
export const DEFAULT_CHECKPOINTS: QRCheckpoint[] = [
  {
    id: 'QR_LC4_FL1_MAIN',
    node_id: 'LC4-F1-N6',
    name: 'LC4 Main Entrance Lobby (Floor 1)',
    building_code: 'LC4',
    floor_number: 1,
    floor_id: 'a6ab42cb-0abd-57ee-acd2-993d64b20a82',
    description: 'Main entrance hall in front of south corridor, LC4',
  },
  {
    id: 'QR_LC4_FL1_WEST',
    node_id: 'LC4-F1-N1',
    name: 'LC4 West Service Junction (Floor 1)',
    building_code: 'LC4',
    floor_number: 1,
    floor_id: 'a6ab42cb-0abd-57ee-acd2-993d64b20a82',
    description: 'West corridor service junction, LC4 Building',
  },
  {
    id: 'QR_LC4_FL1_STAIRS',
    node_id: 'LC4-F1-N9',
    name: 'LC4 East Main Stairs (Floor 1)',
    building_code: 'LC4',
    floor_number: 1,
    floor_id: 'a6ab42cb-0abd-57ee-acd2-993d64b20a82',
    description: 'Central staircase access, LC4 Building',
  },
  {
    id: 'QR_LC3_FL1_MAIN',
    node_id: 'LC3-F1-N01',
    name: 'LC3 South Main Entrance (Floor 1)',
    building_code: 'LC3',
    floor_number: 1,
    floor_id: 'deaef033-ba6c-5c0e-bb50-956202b57947',
    description: 'Front south entrance pavilion, LC3 Building',
  },
  {
    id: 'QR_LC3_FL1_HALL',
    node_id: 'LC3-F1-N04',
    name: 'LC3 Central Hall (Floor 1)',
    building_code: 'LC3',
    floor_number: 1,
    floor_id: 'deaef033-ba6c-5c0e-bb50-956202b57947',
    description: 'Central hall corridor junction, LC3 Building',
  },
];

/**
 * Normalizes backend route payload into frontend RouteResult format
 */
async function normalizeRouteData(data: any): Promise<RouteResult> {
  const summary = data.summary || {};
  // Backend calculates Dijkstra distance in SVG coordinate viewBox units (~10 units ≈ 1 meter)
  const rawTotalDistance = Number(summary.total_distance || summary.total_distance_meters || 45);
  const isSvgUnitDistance = rawTotalDistance > 100;
  const scale = isSvgUnitDistance ? 0.1 : 1;

  const totalMeters = Math.max(5, Math.round(rawTotalDistance * scale));
  const estMinutes =
    summary.estimated_time_minutes ||
    (summary.estimated_time_seconds
      ? Math.max(1, Math.ceil(summary.estimated_time_seconds / 60))
      : Math.max(1, Math.ceil(totalMeters / 70))); // Average indoor walking speed ~70 m/min

  // 1. Resolve multi-floor segments
  const floorPlans: Record<number, { floor_number: number; floor_id: string; url?: string; nodes: RoutePathNode[] }> = {};
  const segments = Array.isArray(data.floor_segments) && data.floor_segments.length > 0
    ? data.floor_segments
    : data.svg_path
    ? [data.svg_path]
    : [];

  for (const seg of segments) {
    const fNum = Number(seg.floor_number) || 1;
    const fId = seg.floor_id || summary.floor_id || '';
    let url: string | undefined = undefined;

    if (fId) {
      try {
        const floorObj = await campusService.getFloorById(fId);
        url = (floorObj as any)?.floor_plan?.url || (floorObj as any)?.map?.url;
      } catch {
        // Fallback gracefully
      }
    }

    floorPlans[fNum] = {
      floor_number: fNum,
      floor_id: fId,
      url,
      nodes: (seg.nodes || []).map((n: any) => ({
        node_id: n.node_id,
        x: Number(n.x),
        y: Number(n.y),
        is_checkpoint: Boolean(n.is_checkpoint || n.is_room_door),
        name: n.name,
      })),
    };
  }

  // 2. Primary SVG path
  const primaryFloorId = data.svg_path?.floor_id || summary.floor_id || segments[0]?.floor_id || '';
  let primaryUrl: string | undefined = undefined;
  if (primaryFloorId) {
    try {
      const floorObj = await campusService.getFloorById(primaryFloorId);
      primaryUrl = (floorObj as any)?.floor_plan?.url || (floorObj as any)?.map?.url;
    } catch {
      // Fallback gracefully
    }
  }

  const primaryNodes: RoutePathNode[] = (data.svg_path?.nodes || segments[0]?.nodes || []).map((n: any) => ({
    node_id: n.node_id,
    x: Number(n.x),
    y: Number(n.y),
    is_checkpoint: Boolean(n.is_checkpoint || n.is_room_door),
    name: n.name,
  }));

  // 3. Turn-by-turn guidance steps
  const steps = (data.steps || []).map((s: any, idx: number) => ({
    step_index: s.step_index || idx + 1,
    action: s.action || 'CONTINUE',
    instruction: s.instruction || s.message || '',
    distance: Math.round(Number(s.distance || 0) * scale),
    from_node_id: s.from_node_id,
    to_node_id: s.to_node_id,
    checkpoint_pin: s.checkpoint_pin,
    floor_number: s.floor_number || 1,
    to_floor_number: s.to_floor_number,
    transition_type: s.transition_type,
  }));

  return {
    summary: {
      start_name: summary.start_location?.name || summary.start_name || 'Start Point',
      destination_name: summary.destination?.name || summary.destination_name || 'Destination',
      estimated_time_minutes: estMinutes,
      total_distance_meters: totalMeters,
      floor_id: primaryFloorId,
      building_id: summary.building_id || '',
      is_rerouted: Boolean(data.is_rerouted || summary.is_rerouted),
      is_cross_floor: Boolean(summary.is_cross_floor),
    },
    svg_path: {
      floor_id: primaryFloorId,
      url: primaryUrl,
      nodes: primaryNodes,
      floor_plans: Object.keys(floorPlans).length > 0 ? floorPlans : undefined,
    },
    steps,
    floor_segments: data.floor_segments,
    is_rerouted: Boolean(data.is_rerouted || summary.is_rerouted),
  };
}

/**
 * Visual Navigation API Service
 */
export const navigationApi = {
  /**
   * Search route with Visual Navigation coordinates
   * Endpoint: POST /api/v1/routes/search
   */
  async searchRoute(params: RouteSearchParams): Promise<RouteResult> {
    const payload = {
      start_id: params.start_id,
      start_type: params.start_type || 'NODE',
      destination_id: params.destination_id,
      destination_type: params.destination_type || 'ROOM',
      ...(params.preferences ? { preferences: params.preferences } : {}),
    };

    let response: Response | null = null;
    let errorDetail = 'Route calculation failed';

    try {
      response = await fetch(`${BASE_URL}/api/v1/routes/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err: any) {
      errorDetail = err?.message || 'Network connection failed';
    }

    // Try alternate prefix without /api/v1 if 404
    if (response && !response.ok && response.status === 404) {
      try {
        const altResponse = await fetch(`${BASE_URL}/routes/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (altResponse.ok) {
          response = altResponse;
        }
      } catch {
        // Ignore fallback error
      }
    }

    if (response && response.ok) {
      const json = await response.json();
      if (json.success && json.data) {
        return await normalizeRouteData(json.data);
      }
    }

    if (response && !response.ok) {
      try {
        const json = await response.json();
        if (json?.error?.message) {
          throw new Error(json.error.message);
        }
      } catch (e: any) {
        if (e?.message && !e.message.includes('JSON')) {
          throw e;
        }
      }
      throw new Error(`Routing service returned error status ${response.status}`);
    }

    throw new Error(errorDetail);
  },

  /**
   * Query route by start node and destination room
   * Endpoint: GET /api/v1/routes?start_node=...&destination_room=...
   */
  async getRoutes(startNode: string, destinationRoom: string): Promise<RouteResult> {
    const url = `${BASE_URL}/api/v1/routes?start_node=${encodeURIComponent(startNode)}&destination_room=${encodeURIComponent(destinationRoom)}`;
    const response = await fetch(url);

    if (response.ok) {
      const json = await response.json();
      if (json.success && json.data) {
        return await normalizeRouteData(json.data);
      }
    }

    if (!response.ok) {
      try {
        const json = await response.json();
        if (json?.error?.message) {
          throw new Error(json.error.message);
        }
      } catch (e: any) {
        if (e?.message && !e.message.includes('JSON')) {
          throw e;
        }
      }
    }

    throw new Error('Failed to retrieve route from server.');
  },

  /**
   * Fetch registered QR checkpoints from Backend
   * Endpoint: GET /api/v1/routes/checkpoints
   */
  async getCheckpointsAsync(): Promise<QRCheckpoint[]> {
    try {
      const response = await fetch(`${BASE_URL}/api/v1/routes/checkpoints`);
      if (response.ok) {
        const json = await response.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          return json.data;
        }
      }
    } catch {
      // Fallback to default registered checkpoints
    }
    return DEFAULT_CHECKPOINTS;
  },

  /**
   * Get all registered QR checkpoints (synchronous default)
   */
  getCheckpoints(): QRCheckpoint[] {
    return DEFAULT_CHECKPOINTS;
  },

  /**
   * Resolve a QR Code payload or string into a verified checkpoint
   */
  resolveCheckpoint(qrContent: string): QRCheckpoint {
    const trimmed = qrContent.trim();
    // 1. Direct match by ID or Node ID
    const byId = DEFAULT_CHECKPOINTS.find((c) => c.id === trimmed || c.node_id === trimmed);
    if (byId) return byId;

    // 2. Check if URL containing node_id or checkpoint parameter
    try {
      const parsed = new URL(trimmed);
      const node = parsed.searchParams.get('start_node') || parsed.searchParams.get('checkpoint');
      if (node) {
        const match = DEFAULT_CHECKPOINTS.find((c) => c.node_id === node || c.id === node);
        if (match) return match;
      }
    } catch {
      // Not a URL
    }

    // 3. Match by name or building
    const byName = DEFAULT_CHECKPOINTS.find((c) =>
      c.name.toLowerCase().includes(trimmed.toLowerCase())
    );
    if (byName) return byName;

    // 4. Dynamic Node code matching (e.g. LC4-F1-N..., LC3-F1-N..., NODE_...)
    if (trimmed.includes('-F') || trimmed.startsWith('NODE_') || trimmed.startsWith('QR_')) {
      const bCode = trimmed.includes('LC3') ? 'LC3' : trimmed.includes('BR2') ? 'BR2' : 'LC4';
      const cleanName = trimmed.replace(/^(NODE_|QR_|RM_)/, '').replace(/_/g, ' ');
      return {
        id: trimmed,
        node_id: trimmed,
        name: `Checkpoint ${cleanName}`,
        building_code: bCode,
        floor_number: 1,
        floor_id: bCode === 'LC3' ? 'deaef033-ba6c-5c0e-bb50-956202b57947' : 'a6ab42cb-0abd-57ee-acd2-993d64b20a82',
        description: `Verified checkpoint from QR code (${trimmed})`,
      };
    }

    // Default to main entrance checkpoint
    return DEFAULT_CHECKPOINTS[0];
  },
};
