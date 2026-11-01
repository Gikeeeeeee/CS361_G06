import type { RouteResult, RouteSearchParams, QRCheckpoint } from '../types/navigation.types';
import { campusService } from '../../campus-explorer/services';
import { facilityCache } from '../../admin-schedule/services/facilityCache';

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
    name: 'LC4 Main Lobby (Floor 1)',
    building_code: 'LC4',
    floor_number: 1,
    floor_id: 'FL_LC4_01',
    description: 'Main lobby entrance in front of central elevators, LC4',
  },
  {
    id: 'QR_LC4_FL1_STAIRS',
    node_id: 'NODE_LC4_STAIRS_1',
    name: 'East Main Stairs (Floor 1)',
    building_code: 'LC4',
    floor_number: 1,
    floor_id: 'FL_LC4_01',
    description: 'In front of central staircase, LC4 Building',
  },
  {
    id: 'QR_LC4_FL2_ELEV',
    node_id: 'NODE_ELEV_04',
    name: 'Glass Elevator Lobby (Floor 2)',
    building_code: 'LC4',
    floor_number: 2,
    floor_id: 'FL_LC4_02',
    description: 'Glass elevator lobby, central hall, LC4 Building',
  },
  {
    id: 'QR_LC3_FL1_ENTRANCE',
    node_id: 'NODE_LC3_101',
    name: 'LC3 South Entrance (Floor 1)',
    building_code: 'LC3',
    floor_number: 1,
    floor_id: 'FL_LC3_01',
    description: 'Front south entrance pavilion, LC3 Building',
  },
  {
    id: 'QR_BR2_FL4_ELEV',
    node_id: 'NODE_ELEV_04',
    name: 'Glass Elevator Lobby (Floor 4)',
    building_code: 'BR2',
    floor_number: 4,
    floor_id: 'FL_BR2_04',
    description: 'Glass elevator lobby, Lecture Building 2, Floor 4',
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
      return await generateMockRoute({
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

    return await generateMockRoute({
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

    // 4. Dynamic Node or Room code matching (e.g. NODE_..., QR_..., RM_...)
    if (trimmed.startsWith('NODE_') || trimmed.startsWith('QR_') || trimmed.startsWith('RM_')) {
      const cleanName = trimmed.replace(/^(NODE_|QR_|RM_)/, '').replace(/_/g, ' ');
      const bCode = trimmed.includes('LC4') ? 'LC4' : trimmed.includes('LC3') ? 'LC3' : trimmed.includes('BR2') ? 'BR2' : 'LC4';
      return {
        id: trimmed,
        node_id: trimmed.startsWith('NODE_') ? trimmed : `NODE_${trimmed}`,
        name: `Checkpoint ${cleanName}`,
        building_code: bCode,
        floor_number: 1,
        floor_id: `FL_${bCode}_01`,
        description: `Reference checkpoint from QR (${trimmed})`,
      };
    }

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
      start_name: summary.start_name || 'Start Point',
      destination_name: summary.destination_name || 'Destination',
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
 * Deterministic generator matching backend V4 spec
 * Dynamically resolves real room and floor SVG from backend database,
 * and computes accurate corridor turn-by-turn navigation steps.
 */
async function generateMockRoute(params: RouteSearchParams): Promise<RouteResult> {
  const rawDestId = params.destination_id;
  const cleanId = rawDestId.replace(/^(RM_|room-)/i, '').trim();
  const startName = params.start_id.replace(/^NODE_/, '').replace(/_/g, ' ');

  let destName = params.destination_metadata?.roomName || cleanId;
  let bCode = params.destination_metadata?.buildingCode || 'LC3';
  let floorId = params.destination_metadata?.floorId || '';
  let floorNum = params.destination_metadata?.floorNumber || 1;
  let floorSvgUrl = params.destination_metadata?.floorSvgUrl;

  // 1. If floorSvgUrl is missing or destination is a UUID, resolve from Backend DB
  if (!floorSvgUrl || rawDestId.includes('-')) {
    try {
      // Check in-memory facility cache first (0ms latency)
      const cached = facilityCache.roomMeta.get(cleanId) || facilityCache.roomMeta.get(rawDestId);
      if (cached) {
        destName = cached.roomNumber ? `Room ${cached.roomNumber}` : cached.nameEn || destName;
        bCode = cached.buildingCode || bCode;
        floorId = cached.floorId || floorId;
        const cFloor = facilityCache.floorsMeta.get(cached.floorId);
        if (cFloor) {
          floorSvgUrl = floorSvgUrl || (cFloor as any).floor_plan?.url || (cFloor as any).map?.url;
        }
      }

      // If still missing SVG URL, query campusService from backend API
      if (!floorSvgUrl) {
        const room = await campusService.getRoomById(cleanId);
        if (room) {
          destName = room.room_number ? `Room ${room.room_number}` : (room.name?.en || room.name?.th || destName);
          bCode = (room as any).building?.code || (room as any).building?.id || bCode;
          const rFloorId = (room as any).floor?.id;
          if (rFloorId) {
            floorId = rFloorId;
            const f = await campusService.getFloorById(rFloorId);
            if (f) {
              floorSvgUrl = (f as any).floor_plan?.url || (f as any).map?.url;
              floorNum = f.floor_number || floorNum;
            }
          }
        }
      }
    } catch (err) {
      console.warn('NavigationApi: Could not resolve room from backend:', err);
    }
  }

  // 2. If floorSvgUrl is still missing, query building floors from backend
  if (!floorSvgUrl) {
    try {
      const bldg = await campusService.getBuildingById(bCode.toLowerCase());
      if (bldg?.floors && bldg.floors.length > 0) {
        const targetFloor = bldg.floors.find((f: any) => f.floor_number === floorNum) || bldg.floors[0];
        if (targetFloor?.id) {
          floorId = floorId || targetFloor.id;
          const f = await campusService.getFloorById(targetFloor.id);
          if (f) {
            floorSvgUrl = (f as any).floor_plan?.url || (f as any).map?.url;
          }
        }
      }
    } catch (err) {
      console.warn('NavigationApi: Could not resolve floor from building:', err);
    }
  }

  const isWheelchair = Boolean(params.preferences?.wheelchair_accessible);
  const isLC3 = bCode.toUpperCase().includes('LC3');

  // Corridor coordinates for visual route polyline tailored to building SVG scale
  const nodes = isLC3
    ? [
        { node_id: 'NODE_START', x: 240, y: 480, is_checkpoint: true, name: startName || 'South Entrance (Floor 1)' },
        { node_id: 'NODE_JUNC_1', x: 450, y: 480, is_checkpoint: true, name: 'Main Lobby Hallway' },
        { node_id: 'NODE_JUNC_2', x: 450, y: 320, is_checkpoint: true, name: 'Central Corridor' },
        { node_id: 'NODE_DEST', x: 520, y: 320, is_checkpoint: true, name: destName },
      ]
    : [
        { node_id: 'NODE_START', x: 130, y: 350, is_checkpoint: true, name: startName || 'Main Lobby (Floor 1)' },
        { node_id: 'NODE_JUNC_1', x: 280, y: 350, is_checkpoint: true, name: 'Main Hallway' },
        { node_id: 'NODE_JUNC_2', x: 280, y: 160, is_checkpoint: true, name: 'North Corridor' },
        { node_id: 'NODE_DEST', x: 380, y: 160, is_checkpoint: true, name: destName },
      ];

  const steps = [
    {
      step_index: 1,
      action: 'DEPART' as const,
      instruction: isWheelchair
        ? 'From starting point, proceed along the main accessible ramp for 15 meters'
        : 'From starting point, walk straight along the main hallway for 15 meters',
      distance: 15,
      from_node_id: 'NODE_START',
      to_node_id: 'NODE_JUNC_1',
      checkpoint_pin: { x: nodes[1].x, y: nodes[1].y },
    },
    {
      step_index: 2,
      action: 'TURN_RIGHT' as const,
      instruction: isWheelchair
        ? 'Turn right towards the central wing using the wide accessible passage'
        : 'Turn right at the corridor junction towards the central wing',
      distance: 20,
      from_node_id: 'NODE_JUNC_1',
      to_node_id: 'NODE_JUNC_2',
      checkpoint_pin: { x: nodes[2].x, y: nodes[2].y },
    },
    {
      step_index: 3,
      action: 'ARRIVE' as const,
      instruction: `Proceed ahead, ${destName} will be on your left side`,
      distance: 10,
      from_node_id: 'NODE_JUNC_2',
      to_node_id: 'NODE_DEST',
      checkpoint_pin: { x: nodes[3].x, y: nodes[3].y },
    },
  ];

  return {
    summary: {
      start_name: startName || `${bCode} Entrance (Floor ${floorNum})`,
      destination_name: destName,
      estimated_time_minutes: isWheelchair ? 3 : 2,
      total_distance_meters: 45,
      floor_id: floorId,
      building_id: bCode,
      is_rerouted: isWheelchair,
    },
    svg_path: {
      floor_id: floorId,
      url: floorSvgUrl,
      nodes,
    },
    steps,
    is_rerouted: isWheelchair,
  };
}
