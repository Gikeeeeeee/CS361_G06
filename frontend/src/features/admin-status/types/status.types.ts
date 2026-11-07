/**
 * V4-US2: Dynamic Status Management Domain Types
 * Matches Backend API Specifications:
 * - GET /api/v1/floors/{floor_id}/status-overlay
 * - PATCH /api/v1/locations/rooms/{room_id}/status
 * - PATCH /api/v1/routes/corridor-edges/{edge_id}/status
 * - PATCH /api/v1/routes/navigation-nodes/{node_id}/status
 */

export type RoomStatus = 'ACTIVE' | 'CLOSED' | 'MAINTENANCE';
export type CorridorStatus = 'ACTIVE' | 'BLOCKED';
export type NodeStatus = 'ACTIVE' | 'BLOCKED';

export interface RoomStatusItem {
  room_id: string;
  room_code: string;
  name?: string;
  status: RoomStatus;
  status_note: string | null;
  updated_at?: string;
  updated_by?: string;
}

export interface CorridorStatusItem {
  edge_id: string;
  from_node_id?: string;
  to_node_id?: string;
  status: CorridorStatus;
  status_note: string | null;
  updated_at?: string;
  updated_by?: string;
}

export interface NodeStatusItem {
  node_id: string;
  svg_x?: number | null;
  svg_y?: number | null;
  status: NodeStatus;
  status_note: string | null;
  updated_at?: string;
  updated_by?: string;
}

export interface FloorStatusOverlayData {
  floor_id: string;
  updated_at: string;
  rooms: RoomStatusItem[];
  corridor_edges: CorridorStatusItem[];
  navigation_nodes: NodeStatusItem[];
}

export interface RoomStatusUpdatePayload {
  status: RoomStatus;
  status_note: string | null;
}

export interface CorridorStatusUpdatePayload {
  status: CorridorStatus;
  status_note: string | null;
}

export interface NodeStatusUpdatePayload {
  status: NodeStatus;
  status_note: string | null;
}
