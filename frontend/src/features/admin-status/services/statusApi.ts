import type { 
  FloorStatusOverlayData, 
  RoomStatus, 
  CorridorStatus, 
  NodeStatus, 
  RoomStatusItem 
} from '../types/status.types';
import { facilityCache } from '../../admin-schedule/services/facilityCache';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const STATUS_CACHE_KEY = 'ku_long_status_overlay_cache';

/**
 * Flag for UI/UX Design & Prototype Review Phase
 * When true, serves mock data directly with 0ms latency and zero network errors in console.
 * Set to false when ready to integrate with live backend endpoints.
 */
const IS_MOCK_MODE = true;

/**
 * In-memory & Session-synchronized cache for 0ms UI reactivity
 */
function getLocalCache(): Record<string, FloorStatusOverlayData> {
  try {
    const raw = sessionStorage.getItem(STATUS_CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore storage parse errors
  }
  return {};
}

function saveLocalCache(cache: Record<string, FloorStatusOverlayData>) {
  try {
    sessionStorage.setItem(STATUS_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage save errors
  }
}

/**
 * V4-US2 Status Management API Service
 */
export const statusApi = {
  /**
   * Fetch live status overlay for a given floor
   * Endpoint: GET /api/v1/floors/{floor_id}/status-overlay
   */
  async getFloorStatusOverlay(floorId: string): Promise<FloorStatusOverlayData> {
    const local = getLocalCache()[floorId];

    if (!IS_MOCK_MODE) {
      try {
        const response = await fetch(`${BASE_URL}/api/v1/floors/${encodeURIComponent(floorId)}/status-overlay`);
        if (response.ok) {
          const json = await response.json();
          if (json.success && json.data) {
            const merged: FloorStatusOverlayData = {
              ...json.data,
              rooms: json.data.rooms.map((r: RoomStatusItem) => {
                const localRoom = local?.rooms.find((lr) => lr.room_id === r.room_id || lr.room_code === r.room_code);
                return localRoom || r;
              }),
            };
            const cache = getLocalCache();
            cache[floorId] = merged;
            saveLocalCache(cache);
            return merged;
          }
        }
      } catch {
        // Fallback to local
      }
    }

    // Return cached session overlay if already initialized/modified
    if (local) return local;

    // Dynamic mock overlay generator for any floorId
    const floorRooms: RoomStatusItem[] = [];
    try {
      for (const meta of facilityCache.roomMeta.values()) {
        if (meta.floorId === floorId) {
          floorRooms.push({
            room_id: meta.roomId,
            room_code: meta.roomNumber || meta.nameEn || meta.roomId,
            status: 'ACTIVE',
            status_note: null,
          });
        }
      }
    } catch {
      // Ignore
    }

    // If facilityCache was not yet populated for this floor, generate dynamic room slots
    if (floorRooms.length === 0) {
      const cleanFloor = floorId.replace(/^FL_/, '');
      const parts = cleanFloor.split('_');
      const bCode = parts.length >= 1 && parts[0] ? parts[0] : 'LC4';
      const fNum = parts.length >= 2 ? parseInt(parts[1], 10) || 1 : 1;

      // Dynamically generate standard room codes on this floor
      for (let n = 1; n <= 12; n++) {
        const numStr = `${fNum}${n < 10 ? '0' + n : n}`;
        const code = `${bCode}-${numStr}`;
        const isMaint = n === 8;
        const isClosed = n === 12;

        floorRooms.push({
          room_id: `RM_${bCode}_${numStr}`,
          room_code: code,
          status: isMaint ? 'MAINTENANCE' : isClosed ? 'CLOSED' : 'ACTIVE',
          status_note: isMaint ? 'Air conditioning repair in progress' : isClosed ? 'Closed for renovation' : null,
        });
      }
    }

    const defaultOverlay: FloorStatusOverlayData = {
      floor_id: floorId,
      updated_at: new Date().toISOString(),
      rooms: floorRooms,
      corridor_edges: [
        {
          edge_id: `EDGE_${floorId}_MAIN`,
          status: 'ACTIVE',
          status_note: null,
        },
      ],
      navigation_nodes: [
        {
          node_id: `NODE_${floorId}_ELEV`,
          status: 'ACTIVE',
          status_note: null,
        },
      ],
    };

    const cache = getLocalCache();
    cache[floorId] = defaultOverlay;
    saveLocalCache(cache);
    return defaultOverlay;
  },

  /**
   * Update Room Status (ACTIVE, CLOSED, MAINTENANCE) with optional status_note
   * Endpoint: PATCH /api/v1/locations/rooms/{room_id}/status
   */
  async updateRoomStatus(
    floorId: string,
    roomId: string,
    roomCode: string,
    status: RoomStatus,
    statusNote: string | null,
    token?: string
  ): Promise<RoomStatusItem> {
    const payload = {
      status,
      status_note: statusNote,
    };

    if (!IS_MOCK_MODE) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      try {
        // 1. Try exact endpoint: PATCH /api/v1/locations/{id}/status
        let response = await fetch(`${BASE_URL}/api/v1/locations/${encodeURIComponent(roomId)}/status`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(payload),
        });

        // 2. Fallback to /api/v1/locations/rooms/{id}/status if needed
        if (!response.ok && response.status === 404) {
          response = await fetch(`${BASE_URL}/api/v1/locations/rooms/${encodeURIComponent(roomId)}/status`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(payload),
          });
        }

        if (response.ok) {
          const json = await response.json();
          if (json.success && json.data) {
            this.applyLocalRoomUpdate(floorId, json.data);
            return json.data;
          }
        }
      } catch {
        // Fallback to local
      }
    }

    const updatedItem: RoomStatusItem = {
      room_id: roomId,
      room_code: roomCode,
      status,
      status_note: statusNote,
      updated_at: new Date().toISOString(),
    };

    this.applyLocalRoomUpdate(floorId, updatedItem);
    return updatedItem;
  },

  /**
   * Update Corridor Edge Status (ACTIVE, BLOCKED)
   * Endpoint: PATCH /api/v1/routes/corridor-edges/{edge_id}/status
   */
  async updateCorridorStatus(
    floorId: string,
    edgeId: string,
    status: CorridorStatus,
    statusNote: string | null,
    token?: string
  ) {
    const payload = { status, status_note: statusNote };
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const response = await fetch(`${BASE_URL}/api/v1/routes/corridor-edges/${encodeURIComponent(edgeId)}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      });
      if (response.ok) return await response.json();
    } catch {
      // Fallback
    }

    // Apply to local session cache
    const cache = getLocalCache();
    if (cache[floorId]) {
      const edge = cache[floorId].corridor_edges.find((e) => e.edge_id === edgeId);
      if (edge) {
        edge.status = status;
        edge.status_note = statusNote;
      } else {
        cache[floorId].corridor_edges.push({ edge_id: edgeId, status, status_note: statusNote });
      }
      saveLocalCache(cache);
    }
  },

  /**
   * Update Navigation Node Status (ACTIVE, BLOCKED)
   * Endpoint: PATCH /api/v1/routes/navigation-nodes/{node_id}/status
   */
  async updateNodeStatus(
    floorId: string,
    nodeId: string,
    status: NodeStatus,
    statusNote: string | null,
    token?: string
  ) {
    const payload = { status, status_note: statusNote };
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const response = await fetch(`${BASE_URL}/api/v1/routes/navigation-nodes/${encodeURIComponent(nodeId)}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      });
      if (response.ok) return await response.json();
    } catch {
      // Fallback
    }

    // Apply to local session cache
    const cache = getLocalCache();
    if (cache[floorId]) {
      const node = cache[floorId].navigation_nodes.find((n) => n.node_id === nodeId);
      if (node) {
        node.status = status;
        node.status_note = statusNote;
      } else {
        cache[floorId].navigation_nodes.push({ node_id: nodeId, status, status_note: statusNote });
      }
      saveLocalCache(cache);
    }
  },

  /**
   * Helper: save updated room into local cache & broadcast update
   */
  applyLocalRoomUpdate(floorId: string, item: RoomStatusItem) {
    const cache = getLocalCache();
    if (!cache[floorId]) {
      cache[floorId] = {
        floor_id: floorId,
        updated_at: new Date().toISOString(),
        rooms: [],
        corridor_edges: [],
        navigation_nodes: [],
      };
    }

    const existingIdx = cache[floorId].rooms.findIndex(
      (r) => r.room_id === item.room_id || r.room_code === item.room_code
    );
    if (existingIdx >= 0) {
      cache[floorId].rooms[existingIdx] = item;
    } else {
      cache[floorId].rooms.push(item);
    }
    saveLocalCache(cache);

    // Dispatch global event for instantaneous reactivity across components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('floor-status-updated', {
          detail: { floorId, item },
        })
      );
    }
  },

  /**
   * Get room status from local cache synchronously with robust prefix/number matching
   */
  getRoomStatusSync(roomCodeOrId: string): RoomStatusItem | null {
    if (!roomCodeOrId) return null;
    const cache = getLocalCache();
    const clean = roomCodeOrId.toUpperCase().trim().replace(/^ROOM\s+/i, '');
    const numOnly = clean.replace(/[^0-9]/g, '');

    for (const floorData of Object.values(cache)) {
      const found = floorData.rooms.find((r) => {
        const rCode = r.room_code.toUpperCase();
        const rId = r.room_id.toUpperCase();
        if (rId === clean || rCode === clean) return true;
        if (clean.length >= 3 && (rCode.endsWith(clean) || clean.endsWith(rCode))) return true;
        if (numOnly.length >= 3 && rCode.replace(/[^0-9]/g, '') === numOnly) return true;
        return false;
      });
      if (found) return found;
    }
    return null;
  },
};
