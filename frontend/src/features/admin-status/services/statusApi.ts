import type { 
  FloorStatusOverlayData, 
  RoomStatus, 
  CorridorStatus, 
  NodeStatus, 
  RoomStatusItem 
} from '../types/status.types';
import { facilityCache } from '../../admin-schedule/services/facilityCache';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const STATUS_CACHE_KEY = 'ku_long_status_overlay_cache';

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

function getAuthToken(explicitToken?: string): string | null {
  if (explicitToken) return explicitToken;
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('ku_long_auth_token');
    }
  } catch {
    // Ignore storage read error
  }
  return null;
}

/**
 * V4-US2 Status Management API Service - Real Backend Integration
 */
export const statusApi = {
  /**
   * Fetch live status overlay for a given floor from Backend API Gateway
   * Endpoint: GET /api/v1/floors/{floor_id}/status-overlay
   */
  async getFloorStatusOverlay(floorId: string): Promise<FloorStatusOverlayData> {
    const local = getLocalCache()[floorId];

    try {
      const response = await fetch(`${BASE_URL}/api/v1/floors/${encodeURIComponent(floorId)}/status-overlay`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const json = await response.json();
        if (json.success && json.data) {
          const rawRooms: any[] = json.data.rooms || [];
          const rawEdges: any[] = json.data.corridor_edges || [];
          const rawNodes: any[] = json.data.navigation_nodes || [];

          const mergedRooms: RoomStatusItem[] = rawRooms.map((r: any) => {
            const meta = facilityCache.roomMeta.get(r.room_id);
            const rawCode = r.room_code || '';
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawCode);

            const num = meta?.roomNumber || (!isUuid ? rawCode : '');
            const bCode = meta?.buildingCode || '';
            const formattedCode = num
              ? (bCode && !num.startsWith(bCode) ? `${bCode}-${num}` : num)
              : '';
            const resolvedName = meta?.nameEn || (isUuid ? '' : rawCode);
            const resolvedCode = formattedCode || resolvedName || r.room_id;

            const localRoom = local?.rooms?.find(
              (lr) => lr.room_id === r.room_id || lr.room_code === resolvedCode || lr.room_code === r.room_code
            );

            return {
              room_id: r.room_id,
              room_code: localRoom?.room_code || resolvedCode,
              name: resolvedName,
              status: localRoom?.status || (r.status as RoomStatus) || 'ACTIVE',
              status_note: localRoom ? localRoom.status_note : r.status_note ?? null,
              updated_at: r.updated_at || json.data.updated_at,
            };
          });

          const mergedEdges = rawEdges.map((e: any) => {
            const localEdge = local?.corridor_edges?.find((le) => le.edge_id === e.edge_id);
            return {
              edge_id: e.edge_id,
              status: localEdge?.status || (e.status as CorridorStatus) || 'ACTIVE',
              status_note: localEdge ? localEdge.status_note : e.status_note ?? null,
            };
          });

          const mergedNodes = rawNodes.map((n: any) => {
            const localNode = local?.navigation_nodes?.find((ln) => ln.node_id === n.node_id);
            return {
              node_id: n.node_id,
              status: localNode?.status || (n.status as NodeStatus) || 'ACTIVE',
              status_note: localNode ? localNode.status_note : n.status_note ?? null,
            };
          });

          const merged: FloorStatusOverlayData = {
            floor_id: json.data.floor_id || floorId,
            updated_at: json.data.updated_at || new Date().toISOString(),
            rooms: mergedRooms,
            corridor_edges: mergedEdges,
            navigation_nodes: mergedNodes,
          };

          const cache = getLocalCache();
          cache[floorId] = merged;
          saveLocalCache(cache);
          return merged;
        }
      }
    } catch (err) {
      console.warn('Network error fetching status overlay from backend, checking session cache:', err);
    }

    // Return session cache if network fails
    if (local) return local;

    // Fallback baseline structure if floor not yet saved
    const emptyOverlay: FloorStatusOverlayData = {
      floor_id: floorId,
      updated_at: new Date().toISOString(),
      rooms: [],
      corridor_edges: [],
      navigation_nodes: [],
    };
    return emptyOverlay;
  },

  /**
   * Update Room Status (ACTIVE, CLOSED, MAINTENANCE) with optional status_note
   * Endpoint: PATCH /api/v1/locations/rooms/{room_id}/status (or /api/v1/locations/{id}/status)
   */
  async updateRoomStatus(
    floorId: string,
    roomId: string,
    roomCode: string,
    status: RoomStatus,
    statusNote: string | null,
    token?: string
  ): Promise<RoomStatusItem> {
    const authToken = getAuthToken(token);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const payload = {
      status,
      status_note: statusNote,
    };

    // 1. Send PATCH to /api/v1/locations/rooms/{room_id}/status
    let response = await fetch(`${BASE_URL}/api/v1/locations/rooms/${encodeURIComponent(roomId)}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    });

    // 2. Fallback to /api/v1/locations/{id}/status if 404
    if (response.status === 404) {
      response = await fetch(`${BASE_URL}/api/v1/locations/${encodeURIComponent(roomId)}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      });
    }

    if (!response.ok) {
      let errorDetail = '';
      try {
        const errJson = await response.json();
        errorDetail = errJson?.error?.message || errJson?.message || '';
      } catch {
        // ignore
      }

      if (response.status === 401) {
        throw new Error(errorDetail || 'Authentication required. Please sign in with a Staff or Admin account.');
      }
      if (response.status === 403) {
        throw new Error(errorDetail || 'Permission denied. Staff or Admin privilege required to update facility status.');
      }
      if (response.status === 404) {
        throw new Error(errorDetail || `Room "${roomCode || roomId}" not found on server.`);
      }
      if (response.status >= 500) {
        throw new Error(errorDetail || 'Internal server error while saving status. Please try again later.');
      }
      throw new Error(errorDetail || `Failed to update room status (HTTP ${response.status}).`);
    }

    const json = await response.json().catch(() => null);
    const updatedItem: RoomStatusItem = {
      room_id: json?.data?.room_id || roomId,
      room_code: json?.data?.room_code || roomCode,
      status: json?.data?.status || status,
      status_note: json?.data?.status_note !== undefined ? json?.data?.status_note : statusNote,
      updated_at: json?.data?.updated_at || new Date().toISOString(),
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
    const authToken = getAuthToken(token);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const payload = { status, status_note: statusNote };

    const response = await fetch(`${BASE_URL}/api/v1/routes/corridor-edges/${encodeURIComponent(edgeId)}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorDetail = '';
      try {
        const errJson = await response.json();
        errorDetail = errJson?.error?.message || errJson?.message || '';
      } catch {
        // ignore
      }

      if (response.status === 401) {
        throw new Error(errorDetail || 'Authentication required. Please sign in with a Staff or Admin account.');
      }
      if (response.status === 403) {
        throw new Error(errorDetail || 'Permission denied. Staff or Admin privilege required.');
      }
      throw new Error(errorDetail || `Failed to update corridor edge status (HTTP ${response.status}).`);
    }

    // Apply to local session cache & broadcast
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

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('floor-status-updated', {
          detail: { floorId, edgeId, status },
        })
      );
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
    const authToken = getAuthToken(token);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const payload = { status, status_note: statusNote };

    const response = await fetch(`${BASE_URL}/api/v1/routes/navigation-nodes/${encodeURIComponent(nodeId)}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorDetail = '';
      try {
        const errJson = await response.json();
        errorDetail = errJson?.error?.message || errJson?.message || '';
      } catch {
        // ignore
      }

      if (response.status === 401) {
        throw new Error(errorDetail || 'Authentication required. Please sign in with a Staff or Admin account.');
      }
      if (response.status === 403) {
        throw new Error(errorDetail || 'Permission denied. Staff or Admin privilege required.');
      }
      throw new Error(errorDetail || `Failed to update navigation node status (HTTP ${response.status}).`);
    }

    // Apply to local session cache & broadcast
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

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('floor-status-updated', {
          detail: { floorId, nodeId, status },
        })
      );
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
        const rCode = (r.room_code || '').toUpperCase();
        const rId = (r.room_id || '').toUpperCase();
        if (rId === clean || rCode === clean) return true;
        if (clean.length >= 3 && (rCode.endsWith(clean) || clean.endsWith(rCode))) return true;
        if (numOnly.length >= 3 && rCode.replace(/[^0-9]/g, '') === numOnly) return true;

        const meta = facilityCache.roomMeta.get(r.room_id);
        if (meta) {
          if (meta.roomNumber && meta.roomNumber.toUpperCase() === clean) return true;
          if (meta.nameEn && meta.nameEn.toUpperCase() === clean) return true;
          if (meta.buildingCode && `${meta.buildingCode}-${meta.roomNumber}`.toUpperCase() === clean) return true;
        }
        return false;
      });
      if (found) return found;
    }
    return null;
  },
};
