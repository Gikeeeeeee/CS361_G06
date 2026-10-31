/**
 * Navigation Types for V4-US1
 * Matching Backend Visual Navigation API specifications:
 * - POST /api/v1/routes/search
 * - GET /api/v1/routes
 */

export type NavigationAction = 
  | 'DEPART'
  | 'CONTINUE'
  | 'TURN_LEFT'
  | 'TURN_RIGHT'
  | 'SLIGHT_LEFT'
  | 'SLIGHT_RIGHT'
  | 'STAIRS_UP'
  | 'STAIRS_DOWN'
  | 'ELEVATOR_UP'
  | 'ELEVATOR_DOWN'
  | 'ARRIVE';

export interface RoutePathNode {
  node_id?: string;
  x: number;
  y: number;
  is_checkpoint?: boolean;
  name?: string;
  is_room_door?: boolean;
}

export interface RouteStep {
  step_index: number;
  action: NavigationAction;
  instruction: string;
  distance: number;
  from_node_id?: string;
  to_node_id?: string;
  checkpoint_pin?: {
    x: number;
    y: number;
  };
  floor_number?: number;
  from_floor_number?: number;
  to_floor_number?: number;
  transition_type?: string;
}

export interface RouteSummary {
  start_name: string;
  destination_name: string;
  estimated_time_minutes: number;
  total_distance_meters: number;
  floor_id?: string;
  building_id?: string;
  is_rerouted?: boolean;
  is_cross_floor?: boolean;
}

export interface RouteResult {
  summary: RouteSummary;
  svg_path: {
    floor_id: string;
    nodes: RoutePathNode[];
  };
  steps: RouteStep[];
  is_rerouted?: boolean;
}

export interface RouteSearchParams {
  start_id: string;
  start_type: 'ROOM' | 'NODE';
  destination_id: string;
  destination_type: 'ROOM' | 'NODE';
  preferences?: {
    wheelchair_accessible?: boolean;
  };
}

export interface QRCheckpoint {
  id: string;
  node_id: string;
  name: string;
  building_code: string;
  floor_number: number;
  floor_id: string;
  description?: string;
}
