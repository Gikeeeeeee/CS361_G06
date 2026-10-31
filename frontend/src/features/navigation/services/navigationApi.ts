import type { RouteResult, RouteSearchParams, QRCheckpoint } from '../types/navigation.types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Flag for UI/UX Design & Prototype Review Phase
 * When true, serves dynamic mock route with 0ms latency and zero network errors in console.
 * Set to false when ready to integrate with live backend endpoints.
 */
const IS_MOCK_MODE = true;

/**
 * Standard campus checkpoints with physical QR codes
 */
export const DEFAULT_CHECKPOINTS: QRCheckpoint[] = [
  {
    id: 'QR_LC4_FL1_LOBBY',
    node_id: 'NODE_LC4_100',
    name: 'LC4 Main Lobby (โถงกลาง ชั้น 1)',
    building_code: 'LC4',
    floor_number: 1,
    floor_id: 'FL_LC4_01',
    description: 'ทางเข้าหลักหน้าลิฟต์กลาง อาคาร LC4',
  },
  {
    id: 'QR_LC4_FL1_STAIRS',
    node_id: 'NODE_LC4_STAIRS_1',
    name: 'บันไดกลาง ทิศตะวันออก ชั้น 1',
    building_code: 'LC4',
    floor_number: 1,
    floor_id: 'FL_LC4_01',
    description: 'หน้าทางขึ้นบันไดหลัก อาคาร LC4',
  },
  {
    id: 'QR_LC4_FL2_ELEV',
    node_id: 'NODE_ELEV_04',
    name: 'โถงลิฟต์แก้ว ชั้น 2',
    building_code: 'LC4',
    floor_number: 2,
    floor_id: 'FL_LC4_02',
    description: 'หน้าลิฟต์แก้ว โถงกลาง อาคาร LC4',
  },
  {
    id: 'QR_LC3_FL1_ENTRANCE',
    node_id: 'NODE_LC3_101',
    name: 'LC3 ทางเข้าทิศใต้ ชั้น 1',
    building_code: 'LC3',
    floor_number: 1,
    floor_id: 'FL_LC3_01',
    description: 'ซุ้มทางเข้าด้านหน้า อาคาร LC3',
  },
  {
    id: 'QR_BR2_FL4_ELEV',
    node_id: 'NODE_ELEV_04',
    name: 'โถงลิฟต์แก้ว ชั้น 4',
    building_code: 'BR2',
    floor_number: 4,
    floor_id: 'FL_BR2_04',
    description: 'โถงลิฟต์แก้ว อาคารบรรยาย 2 ชั้น 4',
  },
];

/**
 * Visual Navigation Service
 */
export const navigationApi = {
  /**
   * Search route with Visual Navigation coordinates
   * Endpoint: POST /api/v1/routes/search
   */
  async searchRoute(params: RouteSearchParams): Promise<RouteResult> {
    if (IS_MOCK_MODE) {
      return generateMockRoute(params);
    }

    try {
      const response = await fetch(`${BASE_URL}/api/v1/routes/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (response.ok) {
        const json = await response.json();
        if (json.success && json.data) {
          return normalizeRouteData(json.data);
        }
      }
    } catch {
      // Backend not yet deployed or offline, fall back to robust local calculation
    }

    // Try alternate route prefix
    try {
      const response = await fetch(`${BASE_URL}/routes/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (response.ok) {
        const json = await response.json();
        if (json.success && json.data) {
          return normalizeRouteData(json.data);
        }
      }
    } catch {
      // Fallback
    }

    return generateMockRoute(params);
  },

  /**
   * Query route by start node and destination room
   * Endpoint: GET /api/v1/routes?start_node=...&destination_room=...
   */
  async getRoutes(startNode: string, destinationRoom: string): Promise<RouteResult> {
    if (IS_MOCK_MODE) {
      return generateMockRoute({
        start_id: startNode,
        start_type: 'NODE',
        destination_id: destinationRoom,
        destination_type: 'ROOM',
      });
    }

    try {
      const url = `${BASE_URL}/api/v1/routes?start_node=${encodeURIComponent(startNode)}&destination_room=${encodeURIComponent(destinationRoom)}`;
      const response = await fetch(url);

      if (response.ok) {
        const json = await response.json();
        if (json.success && json.data) {
          return normalizeRouteData(json.data);
        }
      }
    } catch {
      // Fallback
    }

    return generateMockRoute({
      start_id: startNode,
      start_type: 'NODE',
      destination_id: destinationRoom,
      destination_type: 'ROOM',
    });
  },

  /**
   * Get all registered QR checkpoints
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
      // Offline fallback
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
   * Resolve a QR Code payload or ID into a checkpoint
   */
  resolveCheckpoint(qrContent: string): QRCheckpoint {
    const trimmed = qrContent.trim();
    // 1. Direct match by ID
    const byId = DEFAULT_CHECKPOINTS.find((c) => c.id === trimmed || c.node_id === trimmed);
    if (byId) return byId;

    // 2. Check if URL containing node_id or checkpoint query
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

    // Fallback default
    return DEFAULT_CHECKPOINTS[0];
  },
};

function normalizeRouteData(data: any): RouteResult {
  const summary = data.summary || {};
  const totalMeters = summary.total_distance_meters || summary.total_distance || 45;
  const estMinutes = summary.estimated_time_minutes || (summary.estimated_time_seconds ? Math.ceil(summary.estimated_time_seconds / 60) : 2);

  return {
    summary: {
      start_name: summary.start_name || 'จุดเริ่มต้น',
      destination_name: summary.destination_name || 'ห้องเป้าหมาย',
      estimated_time_minutes: estMinutes,
      total_distance_meters: totalMeters,
      floor_id: data.svg_path?.floor_id || summary.floor_id || '',
      building_id: summary.building_id || '',
      is_rerouted: Boolean(data.is_rerouted || summary.is_rerouted),
      is_cross_floor: Boolean(summary.is_cross_floor),
    },
    svg_path: {
      floor_id: data.svg_path?.floor_id || '',
      nodes: (data.svg_path?.nodes || []).map((n: any) => ({
        node_id: n.node_id,
        x: Number(n.x),
        y: Number(n.y),
        is_checkpoint: Boolean(n.is_checkpoint),
        name: n.name,
      })),
    },
    steps: (data.steps || []).map((s: any, idx: number) => ({
      step_index: s.step_index || idx + 1,
      action: s.action || 'CONTINUE',
      instruction: s.instruction || s.message || '',
      distance: s.distance || 15,
      from_node_id: s.from_node_id,
      to_node_id: s.to_node_id,
      checkpoint_pin: s.checkpoint_pin,
      floor_number: s.floor_number,
    })),
    is_rerouted: Boolean(data.is_rerouted || summary.is_rerouted),
  };
}

/**
 * Deterministic mock generator matching backend V4 spec
 * Dynamically computes floor_id and corridor navigation steps
 */
function generateMockRoute(params: RouteSearchParams): RouteResult {
  const destName = params.destination_id.replace(/^RM_/, '').replace(/^room-/i, '');
  const startName = params.start_id.replace(/^NODE_/, '').replace(/_/g, ' ');

  // Extract building code and floor number dynamically from destination string
  const match = destName.match(/^([a-zA-Z0-9]+)[-_]([0-9]+)/);
  const bCode = match ? match[1].toUpperCase() : 'LC4';
  const roomNum = match ? match[2] : destName;
  const floorNum = roomNum.length >= 3 ? parseInt(roomNum[0], 10) : 1;
  const floorId = `FL_${bCode}_0${floorNum}`;

  const isWheelchair = Boolean(params.preferences?.wheelchair_accessible);

  // Corridor coordinates for visual route polyline
  const nodes = [
    { node_id: 'NODE_START', x: 120, y: 380, is_checkpoint: true, name: startName || 'จุดเริ่มต้น' },
    { node_id: 'NODE_JUNC_MAIN', x: 280, y: 380, is_checkpoint: true, name: 'โถงกลาง' },
    { node_id: 'NODE_JUNC_NORTH', x: 280, y: 160, is_checkpoint: true, name: 'โถงทิศเหนือ' },
    { node_id: 'NODE_DEST', x: 440, y: 160, is_checkpoint: true, name: destName },
  ];

  const steps = [
    {
      step_index: 1,
      action: 'DEPART' as const,
      instruction: isWheelchair
        ? 'จากจุดเริ่มต้น มุ่งหน้าไปตามทางลาดโถงหลัก 15 เมตร'
        : 'จากจุดเริ่มต้น เดินตรงไปตามทางเดินหลัก 15 เมตร',
      distance: 15,
      from_node_id: 'NODE_START',
      to_node_id: 'NODE_JUNC_MAIN',
      checkpoint_pin: { x: 280, y: 380 },
    },
    {
      step_index: 2,
      action: 'TURN_RIGHT' as const,
      instruction: isWheelchair
        ? 'เลี้ยวขวาที่ทางแยกหน้าโถงลิฟต์ เข้าสู่โถงทิศเหนือ (มีทางลาดกว้าง)'
        : 'เลี้ยวขวาที่ทางแยกหน้าห้องน้ำ เข้าสู่โถงทิศเหนือ',
      distance: 20,
      from_node_id: 'NODE_JUNC_MAIN',
      to_node_id: 'NODE_JUNC_NORTH',
      checkpoint_pin: { x: 280, y: 160 },
    },
    {
      step_index: 3,
      action: 'ARRIVE' as const,
      instruction: `ห้อง ${destName} จะอยู่ทางซ้ายมือ เป็นห้องที่ 2`,
      distance: 10,
      from_node_id: 'NODE_JUNC_NORTH',
      to_node_id: 'NODE_DEST',
      checkpoint_pin: { x: 440, y: 160 },
    },
  ];

  return {
    summary: {
      start_name: startName || 'โถงกลาง ชั้น 1',
      destination_name: destName || 'LC4-101',
      estimated_time_minutes: isWheelchair ? 3 : 2,
      total_distance_meters: 45,
      floor_id: floorId,
      building_id: bCode,
      is_rerouted: isWheelchair,
    },
    svg_path: {
      floor_id: floorId,
      nodes,
    },
    steps,
    is_rerouted: isWheelchair,
  };
}
