"""
Navigation application service.

Orchestrates route calculation, corridor attachment projection, turn derivation,
and instruction formatting according to V4 domain rules.
Layer: service (use case / application).
"""

import math
from typing import Any

from errors import (
    BlockedLocationError,
    InvalidNavigationInput,
    LocationNotFound,
    MissingCorridorAttachment,
    NoRouteAvailable,
    RoomNotFound,
    UnsupportedCrossFloorRoute,
)
from models.navigation import (
    CorridorEdge,
    FloorSegment,
    NavigationNode,
    RoomAttachment,
    RoutePathPoint,
    RouteResult,
    RouteStep,
    RouteSummary,
    VerticalConnection,
)
from ports.navigation_source import NavigationSource
from services.dijkstra import find_shortest_path


def _project_point_on_segment(
    px: float,
    py: float,
    ax: float,
    ay: float,
    bx: float,
    by: float,
) -> tuple[float, float, float]:
    """
    Project point P onto segment AB.
    Returns (proj_x, proj_y, t_clamped) where t in [0.0, 1.0].
    """
    dx = bx - ax
    dy = by - ay
    seg_len_sq = dx * dx + dy * dy

    if seg_len_sq <= 1e-9:
        return ax, ay, 0.0

    t = ((px - ax) * dx + (py - ay) * dy) / seg_len_sq
    t_clamped = max(0.0, min(1.0, t))
    proj_x = ax + t_clamped * dx
    proj_y = ay + t_clamped * dy

    return proj_x, proj_y, t_clamped


def _euclidean_dist(x1: float, y1: float, x2: float, y2: float) -> float:
    return math.hypot(x2 - x1, y2 - y1)


class NavigationService:
    """Core domain service for Visual Navigation routes and step instructions."""

    def __init__(self, source: NavigationSource):
        self.source = source

    def calculate_route(
        self,
        start_id: str,
        start_type: str,
        destination_id: str,
        destination_type: str = "ROOM",
        preferences: dict[str, Any] | None = None,
    ) -> RouteResult:
        """
        Calculate complete shortest path route and step-by-step instructions.
        Supports start and destination as ROOM, NODE, or QR.
        """
        if not start_id or not str(start_id).strip():
            raise InvalidNavigationInput("start_id must not be empty")
        if not destination_id or not str(destination_id).strip():
            raise InvalidNavigationInput("destination_id must not be empty")

        clean_start_type = (start_type or "").strip().upper()
        clean_dest_type = (destination_type or "ROOM").strip().upper()

        if clean_start_type not in {
            "ROOM",
            "NODE",
            "NAVIGATION_NODE",
            "QR",
            "QR_LOCATION",
        }:
            raise InvalidNavigationInput(f"Unsupported start_type: {start_type}")
        if clean_dest_type not in {"ROOM", "NODE", "NAVIGATION_NODE"}:
            raise InvalidNavigationInput(
                f"Unsupported destination_type: {destination_type}"
            )

        # 1. Resolve destination
        dest_room, dest_node, dest_floor_id = self._resolve_target(
            destination_id, clean_dest_type, is_destination=True
        )

        # 2. Resolve start location
        start_room, start_node, start_floor_id = self._resolve_target(
            start_id,
            clean_start_type,
            expected_floor_id=dest_floor_id,
            is_destination=False,
        )

        # 3. Cross-floor check
        if start_floor_id != dest_floor_id:
            return self._calculate_cross_floor_route(
                start_room=start_room,
                start_node=start_node,
                start_floor_id=start_floor_id,
                dest_room=dest_room,
                dest_node=dest_node,
                dest_floor_id=dest_floor_id,
                start_id=start_id,
                clean_start_type=clean_start_type,
                destination_id=destination_id,
                clean_dest_type=clean_dest_type,
                preferences=preferences,
            )

        floor_id = dest_floor_id

        # 4. Fetch floor navigation dataset
        floor_data = self.source.get_floor_navigation_data(floor_id)
        nodes_dict: dict[str, NavigationNode] = {
            n.id: n for n in floor_data.get("nodes", [])
        }
        edges_list: list[CorridorEdge] = floor_data.get("edges", [])
        edges_dict: dict[str, CorridorEdge] = {e.id: e for e in edges_list}
        rooms_dict: dict[str, RoomAttachment] = {
            r.room_id: r for r in floor_data.get("rooms", [])
        }
        for r in floor_data.get("rooms", []):
            if r.room_number:
                rooms_dict[r.room_number] = r

        # Ensure resolved start/dest room attachments have full corridor data
        if start_room and start_room.room_id in rooms_dict:
            start_room = rooms_dict[start_room.room_id]
        elif start_room and start_room.room_number in rooms_dict:
            start_room = rooms_dict[start_room.room_number]

        if dest_room and dest_room.room_id in rooms_dict:
            dest_room = rooms_dict[dest_room.room_id]
        elif dest_room and dest_room.room_number in rooms_dict:
            dest_room = rooms_dict[dest_room.room_number]

        # 5. Check blocked status
        if start_room and not start_room.is_active:
            raise BlockedLocationError(start_room.display_name, "Room")
        if start_node and not start_node.is_active:
            raise BlockedLocationError(start_node.name or start_node.id, "Node")
        if dest_room and not dest_room.is_active:
            raise BlockedLocationError(dest_room.display_name, "Room")
        if dest_node and not dest_node.is_active:
            raise BlockedLocationError(dest_node.name or dest_node.id, "Node")

        # 6. Check room corridor attachments
        if start_room and not start_room.corridor_edge_id:
            raise MissingCorridorAttachment(start_room.display_name)
        if dest_room and not dest_room.corridor_edge_id:
            raise MissingCorridorAttachment(dest_room.display_name)

        # 7. Check if start and destination are identical
        if self._is_same_location(start_room, start_node, dest_room, dest_node):
            return self._build_same_location_result(
                start_room, start_node, floor_id, nodes_dict
            )

        # 8. Same-edge room routing
        if (
            start_room
            and dest_room
            and start_room.corridor_edge_id == dest_room.corridor_edge_id
            and start_room.corridor_edge_id in edges_dict
        ):
            edge = edges_dict[start_room.corridor_edge_id]
            if edge.is_active:
                return self._route_same_edge_rooms(
                    start_room, dest_room, edge, nodes_dict, floor_id
                )

        # 9. Multi-candidate routing (handling corridor attachments at both endpoints)
        start_candidates = self._get_endpoint_candidates(
            start_room, start_node, edges_dict, nodes_dict
        )
        dest_candidates = self._get_endpoint_candidates(
            dest_room, dest_node, edges_dict, nodes_dict
        )

        best_route: tuple[list[str], float, str, str] | None = None
        min_total_cost = float("inf")

        # Evaluate candidate endpoints deterministically
        for s_node_id, s_cost in sorted(start_candidates.items()):
            for d_node_id, d_cost in sorted(dest_candidates.items()):
                res = find_shortest_path(nodes_dict, edges_list, s_node_id, d_node_id)
                if res is not None:
                    path_nodes, graph_cost = res
                    total_cost = s_cost + graph_cost + d_cost
                    if total_cost < min_total_cost:
                        min_total_cost = total_cost
                        best_route = (path_nodes, total_cost, s_node_id, d_node_id)

        if best_route is None:
            s_name = (
                start_room.display_name if start_room else (start_node.name or start_id)
            )
            d_name = (
                dest_room.display_name
                if dest_room
                else (dest_node.name or destination_id)
            )
            raise NoRouteAvailable(s_name, d_name)

        path_nodes, total_distance, best_s_node, best_d_node = best_route

        # 10. Construct SVG path points and step instructions
        path_points = self._assemble_path_points(
            start_room,
            start_node,
            best_s_node,
            path_nodes,
            best_d_node,
            dest_room,
            dest_node,
            nodes_dict,
        )

        steps = self._generate_navigation_steps(
            path_points,
            start_room,
            start_node,
            dest_room,
            dest_node,
            edges_dict,
            best_d_node,
        )

        # 11. Build summary and return RouteResult
        floor_raw = self.source.get_floor(floor_id) or {}
        svg_key = floor_raw.get("floor_plan_key", "")
        floor_number = floor_raw.get("floor_number", 1)
        building_id = floor_raw.get("building_id", "")

        start_loc_info = {
            "id": start_id,
            "type": clean_start_type,
            "name": start_room.display_name
            if start_room
            else (start_node.name or start_id),
        }
        dest_loc_info = {
            "id": destination_id,
            "type": clean_dest_type,
            "name": dest_room.display_name
            if dest_room
            else (dest_node.name or destination_id),
        }

        summary = RouteSummary(
            floor_id=floor_id,
            building_id=building_id,
            total_distance=total_distance,
            estimated_time_seconds=None,
            is_rerouted=False,
            is_cross_floor=False,
            floors_traversed=[
                {
                    "floor_id": floor_id,
                    "floor_number": floor_number,
                    "building_id": building_id,
                }
            ],
            start_location=start_loc_info,
            destination=dest_loc_info,
        )

        svg_path = {
            "floor_id": floor_id,
            "floor_number": floor_number,
            "svg_key": svg_key,
            "nodes": [p.to_dict() for p in path_points],
        }

        floor_segment = FloorSegment(
            floor_id=floor_id,
            floor_number=floor_number,
            svg_key=svg_key,
            nodes=[p.to_dict() for p in path_points],
        )

        return RouteResult(
            summary=summary,
            svg_path=svg_path,
            steps=steps,
            floor_segments=[floor_segment],
        )

    # -----------------------------------------------------------------------
    # Helper resolution methods
    # -----------------------------------------------------------------------

    def _resolve_target(
        self,
        target_id: str,
        target_type: str,
        expected_floor_id: str | None = None,
        is_destination: bool = False,
    ) -> tuple[RoomAttachment | None, NavigationNode | None, str]:
        """Resolves target into (RoomAttachment or None, NavigationNode or None, floor_id)."""
        if target_type == "ROOM":
            raw_room = self.source.get_room(target_id)
            if not raw_room:
                raise RoomNotFound(target_id)
            floor_id = raw_room.get("floor_id", "")
            room_att = RoomAttachment(
                room_id=raw_room.get("id", ""),
                room_number=raw_room.get("room_number"),
                name=raw_room.get("name"),
                corridor_edge_id=raw_room.get("corridor_edge_id", ""),
                door_svg_x=float(raw_room["door_svg_x"])
                if raw_room.get("door_svg_x") is not None
                else None,
                door_svg_y=float(raw_room["door_svg_y"])
                if raw_room.get("door_svg_y") is not None
                else None,
                side=str(raw_room.get("side", "RIGHT")).upper(),
                sequence_order=int(raw_room["sequence_order"])
                if raw_room.get("sequence_order") is not None
                else None,
                floor_id=floor_id,
                building_id=raw_room.get("building_id", ""),
                status=raw_room.get("status", "ACTIVE"),
            )
            return room_att, None, floor_id

        if target_type in {"QR", "QR_LOCATION"}:
            raw_qr = self.source.find_qr(target_id, expected_floor_id)
            if not raw_qr and expected_floor_id:
                raw_qr = self.source.find_qr(target_id, None)
            if not raw_qr:
                raise LocationNotFound(target_id, "QR location")
            floor_id = raw_qr.get("floor_id") or expected_floor_id or ""
            node_id = raw_qr.get("node_id", "")
            raw_node = self.source.find_node(node_id, floor_id)
            if not raw_node and floor_id:
                raw_node = self.source.find_node(node_id, None)
            if not raw_node:
                raise LocationNotFound(node_id, "Navigation node linked to QR")
            node = NavigationNode(
                id=raw_node.get("id", node_id),
                name=raw_node.get("name", raw_qr.get("location_description")),
                node_type=raw_node.get("node_type", "JUNCTION"),
                status=raw_node.get("status", "ACTIVE"),
                svg_x=float(raw_node.get("svg_x", 0.0)),
                svg_y=float(raw_node.get("svg_y", 0.0)),
                floor_id=floor_id or raw_node.get("floor_id", ""),
            )
            return None, node, floor_id or raw_node.get("floor_id", "")

        # NODE
        raw_node = self.source.find_node(target_id, expected_floor_id)
        if not raw_node and expected_floor_id:
            raw_node = self.source.find_node(target_id, None)
        if not raw_node:
            raise LocationNotFound(target_id, "Navigation node")
        floor_id = raw_node.get("floor_id") or expected_floor_id or ""
        node = NavigationNode(
            id=raw_node.get("id", target_id),
            name=raw_node.get("name"),
            node_type=raw_node.get("node_type", "JUNCTION"),
            status=raw_node.get("status", "ACTIVE"),
            svg_x=float(raw_node.get("svg_x", 0.0)),
            svg_y=float(raw_node.get("svg_y", 0.0)),
            floor_id=floor_id,
        )
        return None, node, floor_id

    def _get_endpoint_candidates(
        self,
        room: RoomAttachment | None,
        node: NavigationNode | None,
        edges_dict: dict[str, CorridorEdge],
        nodes_dict: dict[str, NavigationNode],
    ) -> dict[str, float]:
        """Calculates candidate entry/exit nodes and costs for an endpoint."""
        if node:
            return {node.id: 0.0}

        if not room:
            return {}

        edge = edges_dict.get(room.corridor_edge_id)
        if not edge or not edge.is_active:
            raise MissingCorridorAttachment(room.display_name)

        u = edge.from_node_id
        v = edge.to_node_id

        if u not in nodes_dict or v not in nodes_dict:
            return {u: edge.distance_weight / 2.0, v: edge.distance_weight / 2.0}

        node_u = nodes_dict[u]
        node_v = nodes_dict[v]

        if room.door_svg_x is not None and room.door_svg_y is not None:
            _, _, t = _project_point_on_segment(
                room.door_svg_x,
                room.door_svg_y,
                node_u.svg_x,
                node_u.svg_y,
                node_v.svg_x,
                node_v.svg_y,
            )
            cost_u = t * edge.distance_weight
            cost_v = (1.0 - t) * edge.distance_weight
            return {u: cost_u, v: cost_v}

        return {u: edge.distance_weight / 2.0, v: edge.distance_weight / 2.0}

    def _is_same_location(
        self,
        start_room: RoomAttachment | None,
        start_node: NavigationNode | None,
        dest_room: RoomAttachment | None,
        dest_node: NavigationNode | None,
    ) -> bool:
        if start_room and dest_room:
            return start_room.room_id == dest_room.room_id or (
                start_room.room_number
                and start_room.room_number == dest_room.room_number
            )
        if start_node and dest_node:
            return start_node.id == dest_node.id
        return False

    def _build_same_location_result(
        self,
        room: RoomAttachment | None,
        node: NavigationNode | None,
        floor_id: str,
        nodes_dict: dict[str, NavigationNode],
    ) -> RouteResult:
        floor_raw = self.source.get_floor(floor_id) or {}
        name = room.display_name if room else (node.name if node else "location")
        loc_id = room.room_id if room else (node.id if node else "")

        if room and room.door_svg_x is not None and room.door_svg_y is not None:
            point = RoutePathPoint(
                x=room.door_svg_x, y=room.door_svg_y, name=name, is_room_door=True
            )
        elif node and node.id in nodes_dict:
            n = nodes_dict[node.id]
            point = RoutePathPoint(x=n.svg_x, y=n.svg_y, node_id=n.id, name=n.name)
        else:
            point = RoutePathPoint(x=0.0, y=0.0, name=name)

        floor_num = floor_raw.get("floor_number", 1)
        b_id = floor_raw.get("building_id", "")
        summary = RouteSummary(
            floor_id=floor_id,
            building_id=b_id,
            total_distance=0.0,
            estimated_time_seconds=0,
            is_rerouted=False,
            is_cross_floor=False,
            floors_traversed=[
                {
                    "floor_id": floor_id,
                    "floor_number": floor_num,
                    "building_id": b_id,
                }
            ],
            start_location={"id": loc_id, "name": name},
            destination={"id": loc_id, "name": name},
        )
        svg_path = {
            "floor_id": floor_id,
            "floor_number": floor_num,
            "svg_key": floor_raw.get("floor_plan_key", ""),
            "nodes": [point.to_dict()],
        }
        steps = [
            RouteStep(
                step_index=1,
                action="ARRIVE",
                instruction=f"You are already at {name}.",
                distance=0.0,
                path_indices=[0],
                floor_number=floor_num,
            )
        ]
        floor_segment = FloorSegment(
            floor_id=floor_id,
            floor_number=floor_num,
            svg_key=floor_raw.get("floor_plan_key", ""),
            nodes=[point.to_dict()],
        )
        return RouteResult(
            summary=summary,
            svg_path=svg_path,
            steps=steps,
            floor_segments=[floor_segment],
        )

    def _route_same_edge_rooms(
        self,
        start_room: RoomAttachment,
        dest_room: RoomAttachment,
        edge: CorridorEdge,
        nodes_dict: dict[str, NavigationNode],
        floor_id: str,
    ) -> RouteResult:
        node_u = nodes_dict.get(edge.from_node_id)
        node_v = nodes_dict.get(edge.to_node_id)

        path_points: list[RoutePathPoint] = []
        if start_room.door_svg_x is not None and start_room.door_svg_y is not None:
            path_points.append(
                RoutePathPoint(
                    x=start_room.door_svg_x,
                    y=start_room.door_svg_y,
                    name=start_room.display_name,
                    is_room_door=True,
                )
            )

        if node_u and node_v and start_room.door_svg_x is not None:
            px_s, py_s, t_s = _project_point_on_segment(
                start_room.door_svg_x,
                start_room.door_svg_y,
                node_u.svg_x,
                node_u.svg_y,
                node_v.svg_x,
                node_v.svg_y,
            )
            px_d, py_d, t_d = _project_point_on_segment(
                dest_room.door_svg_x or node_v.svg_x,
                dest_room.door_svg_y or node_v.svg_y,
                node_u.svg_x,
                node_u.svg_y,
                node_v.svg_x,
                node_v.svg_y,
            )
            path_points.append(RoutePathPoint(x=px_s, y=py_s, name="Corridor entry"))
            path_points.append(
                RoutePathPoint(x=px_d, y=py_d, name="Corridor destination point")
            )
            distance = abs(t_s - t_d) * edge.distance_weight
            walking_forward = t_d >= t_s
        else:
            distance = edge.distance_weight / 2.0
            walking_forward = True

        if dest_room.door_svg_x is not None and dest_room.door_svg_y is not None:
            path_points.append(
                RoutePathPoint(
                    x=dest_room.door_svg_x,
                    y=dest_room.door_svg_y,
                    name=dest_room.display_name,
                    is_room_door=True,
                )
            )

        # Arrival instruction with side & sequence_order
        effective_side = dest_room.side
        if not walking_forward:
            effective_side = "LEFT" if dest_room.side == "RIGHT" else "RIGHT"

        seq_info = (
            f" (door {dest_room.sequence_order} along this corridor)"
            if dest_room.sequence_order is not None
            else ""
        )
        side_text = f" on your {effective_side.lower()}" if effective_side else ""

        steps = [
            RouteStep(
                step_index=1,
                action="DEPART",
                instruction=f"Depart from {start_room.display_name} into the corridor.",
                distance=distance,
                path_indices=list(range(len(path_points))),
            ),
            RouteStep(
                step_index=2,
                action="ARRIVE",
                instruction=f"Arrive at {dest_room.display_name}{side_text}{seq_info}.",
                distance=0.0,
                path_indices=[len(path_points) - 1],
            ),
        ]

        floor_raw = self.source.get_floor(floor_id) or {}
        floor_num = floor_raw.get("floor_number", 1)
        b_id = floor_raw.get("building_id", "")
        summary = RouteSummary(
            floor_id=floor_id,
            building_id=b_id,
            total_distance=distance,
            estimated_time_seconds=None,
            is_rerouted=False,
            is_cross_floor=False,
            floors_traversed=[
                {
                    "floor_id": floor_id,
                    "floor_number": floor_num,
                    "building_id": b_id,
                }
            ],
            start_location={"id": start_room.room_id, "name": start_room.display_name},
            destination={"id": dest_room.room_id, "name": dest_room.display_name},
        )
        svg_path = {
            "floor_id": floor_id,
            "floor_number": floor_num,
            "svg_key": floor_raw.get("floor_plan_key", ""),
            "nodes": [p.to_dict() for p in path_points],
        }
        floor_segment = FloorSegment(
            floor_id=floor_id,
            floor_number=floor_num,
            svg_key=floor_raw.get("floor_plan_key", ""),
            nodes=[p.to_dict() for p in path_points],
        )
        return RouteResult(
            summary=summary,
            svg_path=svg_path,
            steps=steps,
            floor_segments=[floor_segment],
        )

    def _assemble_path_points(
        self,
        start_room: RoomAttachment | None,
        start_node: NavigationNode | None,
        entry_node_id: str,
        path_nodes: list[str],
        exit_node_id: str,
        dest_room: RoomAttachment | None,
        dest_node: NavigationNode | None,
        nodes_dict: dict[str, NavigationNode],
    ) -> list[RoutePathPoint]:
        """Assembles ordered RoutePathPoints including virtual endpoints."""
        points: list[RoutePathPoint] = []

        # 1. Start room door
        if (
            start_room
            and start_room.door_svg_x is not None
            and start_room.door_svg_y is not None
        ):
            points.append(
                RoutePathPoint(
                    x=start_room.door_svg_x,
                    y=start_room.door_svg_y,
                    name=start_room.display_name,
                    is_room_door=True,
                )
            )

        # 2. Intermediate navigation nodes
        for nid in path_nodes:
            if nid in nodes_dict:
                node = nodes_dict[nid]
                points.append(
                    RoutePathPoint(
                        x=node.svg_x,
                        y=node.svg_y,
                        node_id=node.id,
                        name=node.name,
                    )
                )

        # 3. Destination room door
        if (
            dest_room
            and dest_room.door_svg_x is not None
            and dest_room.door_svg_y is not None
        ):
            points.append(
                RoutePathPoint(
                    x=dest_room.door_svg_x,
                    y=dest_room.door_svg_y,
                    name=dest_room.display_name,
                    is_room_door=True,
                )
            )

        return points

    def _generate_navigation_steps(
        self,
        path_points: list[RoutePathPoint],
        start_room: RoomAttachment | None,
        start_node: NavigationNode | None,
        dest_room: RoomAttachment | None,
        dest_node: NavigationNode | None,
        edges_dict: dict[str, CorridorEdge],
        last_graph_node_id: str,
    ) -> list[RouteStep]:
        """Derives step instructions with realistic turns and room arrival cues."""
        if len(path_points) < 2:
            return [
                RouteStep(
                    step_index=1,
                    action="ARRIVE",
                    instruction=f"Arrive at {dest_room.display_name if dest_room else (dest_node.name if dest_node else 'destination')}.",
                    distance=0.0,
                    path_indices=[0],
                )
            ]

        steps: list[RouteStep] = []
        step_index = 1

        # DEPART step
        start_desc = (
            start_room.display_name
            if start_room
            else (start_node.name or "starting location")
        )
        d0 = _euclidean_dist(
            path_points[0].x, path_points[0].y, path_points[1].x, path_points[1].y
        )
        steps.append(
            RouteStep(
                step_index=step_index,
                action="DEPART",
                instruction=f"Depart from {start_desc} and follow the corridor.",
                distance=d0,
                path_indices=[0, 1],
            )
        )
        step_index += 1

        # Intermediate turns along path points
        for i in range(1, len(path_points) - 1):
            p_prev = path_points[i - 1]
            p_curr = path_points[i]
            p_next = path_points[i + 1]

            v1x = p_curr.x - p_prev.x
            v1y = p_curr.y - p_prev.y
            v2x = p_next.x - p_curr.x
            v2y = p_next.y - p_curr.y

            l1 = math.hypot(v1x, v1y)
            l2 = math.hypot(v2x, v2y)
            if l1 < 1e-4 or l2 < 1e-4:
                continue

            # In SVG coordinates where +y is down:
            # cross_product > 0 is RIGHT, cross_product < 0 is LEFT
            cross_prod = v1x * v2y - v1y * v2x
            dot_prod = v1x * v2x + v1y * v2y
            cos_theta = dot_prod / (l1 * l2)

            node_name = p_curr.name or "the intersection"

            if cos_theta < 0.866:  # Deviation > 30 degrees
                if cross_prod > 0:
                    action = "TURN_RIGHT"
                    instruction = f"Turn right at {node_name}."
                else:
                    action = "TURN_LEFT"
                    instruction = f"Turn left at {node_name}."

                steps.append(
                    RouteStep(
                        step_index=step_index,
                        action=action,
                        instruction=instruction,
                        distance=l2,
                        path_indices=[i, i + 1],
                    )
                )
                step_index += 1
            else:
                # Check if this node has a distinct checkpoint name
                if p_curr.name and p_curr.node_id:
                    steps.append(
                        RouteStep(
                            step_index=step_index,
                            action="CONTINUE",
                            instruction=f"Pass {p_curr.name} and continue straight.",
                            distance=l2,
                            path_indices=[i, i + 1],
                        )
                    )
                    step_index += 1

        # ARRIVE step
        dest_desc = (
            dest_room.display_name
            if dest_room
            else (dest_node.name if dest_node else "destination")
        )

        if dest_room and dest_room.corridor_edge_id in edges_dict:
            edge = edges_dict[dest_room.corridor_edge_id]
            # Walking from from_node to to_node or vice versa?
            walking_forward = last_graph_node_id == edge.from_node_id
            effective_side = dest_room.side
            if not walking_forward:
                effective_side = "LEFT" if dest_room.side == "RIGHT" else "RIGHT"

            side_text = f" on your {effective_side.lower()}" if effective_side else ""
            seq_text = (
                f" (door {dest_room.sequence_order} along this corridor)"
                if dest_room.sequence_order is not None
                else ""
            )
            arrive_text = f"Arrive at {dest_desc}{side_text}{seq_text}."
        else:
            arrive_text = f"Arrive at {dest_desc}."

        steps.append(
            RouteStep(
                step_index=step_index,
                action="ARRIVE",
                instruction=arrive_text,
                distance=0.0,
                path_indices=[len(path_points) - 1],
            )
        )

        return steps

    def _calculate_cross_floor_route(
        self,
        start_room: RoomAttachment | None,
        start_node: NavigationNode | None,
        start_floor_id: str,
        dest_room: RoomAttachment | None,
        dest_node: NavigationNode | None,
        dest_floor_id: str,
        start_id: str,
        clean_start_type: str,
        destination_id: str,
        clean_dest_type: str,
        preferences: dict[str, Any] | None = None,
    ) -> RouteResult:
        """Calculates multi-floor routes via validated vertical transitions (stairs/elevators)."""
        start_floor_raw = self.source.get_floor(start_floor_id) or {}
        dest_floor_raw = self.source.get_floor(dest_floor_id) or {}

        start_b_id = str(start_floor_raw.get("building_id", "")).lower()
        dest_b_id = str(dest_floor_raw.get("building_id", "")).lower()

        if not start_b_id or not dest_b_id or start_b_id != dest_b_id:
            raise UnsupportedCrossFloorRoute(
                start_floor_id,
                dest_floor_id,
                f"Cross-building navigation is currently unsupported: start building '{start_b_id}' does not match destination building '{dest_b_id}'",
            )

        building_id = start_b_id

        s_name = (
            start_room.display_name
            if start_room
            else (start_node.name if start_node else start_id)
        )
        d_name = (
            dest_room.display_name
            if dest_room
            else (dest_node.name if dest_node else destination_id)
        )

        # 1. Fetch vertical transitions for building
        raw_conns = self.source.get_vertical_connections(building_id)
        if not raw_conns:
            raise UnsupportedCrossFloorRoute(start_floor_id, dest_floor_id)

        # 2. Filter connections by status and accessibility/user preferences
        prefs = preferences or {}
        avoid_stairs = (
            prefs.get("avoid_stairs")
            or prefs.get("accessible")
            or prefs.get("elevator_only")
        )
        stairs_only = prefs.get("stairs_only")

        valid_conns: list[VerticalConnection] = []
        for conn in raw_conns:
            if not conn.is_active:
                continue
            if avoid_stairs and conn.connection_type == "STAIRS":
                continue
            if stairs_only and conn.connection_type == "ELEVATOR":
                continue
            valid_conns.append(conn)

        if not valid_conns:
            raise NoRouteAvailable(s_name, d_name)

        # 3. Gather all floors participating in the multi-floor graph
        floor_ids_to_load = {start_floor_id, dest_floor_id}
        for conn in valid_conns:
            floor_ids_to_load.add(conn.from_floor_id)
            floor_ids_to_load.add(conn.to_floor_id)

        all_nodes: dict[str, NavigationNode] = {}
        all_edges: list[CorridorEdge] = []
        all_edges_dict: dict[str, CorridorEdge] = {}
        all_rooms_dict: dict[str, RoomAttachment] = {}
        floor_meta_cache: dict[str, dict[str, Any]] = {
            start_floor_id: start_floor_raw,
            dest_floor_id: dest_floor_raw,
        }

        for fid in floor_ids_to_load:
            fdata = self.source.get_floor_navigation_data(fid)
            for n in fdata.get("nodes", []):
                all_nodes[n.id] = n
            for e in fdata.get("edges", []):
                all_edges.append(e)
                all_edges_dict[e.id] = e
            for r in fdata.get("rooms", []):
                all_rooms_dict[r.room_id] = r
                if r.room_number:
                    all_rooms_dict[r.room_number] = r
            if fid not in floor_meta_cache:
                floor_meta_cache[fid] = self.source.get_floor(fid) or {}

        # Re-attach room corridor details
        if start_room and start_room.room_id in all_rooms_dict:
            start_room = all_rooms_dict[start_room.room_id]
        elif start_room and start_room.room_number in all_rooms_dict:
            start_room = all_rooms_dict[start_room.room_number]

        if dest_room and dest_room.room_id in all_rooms_dict:
            dest_room = all_rooms_dict[dest_room.room_id]
        elif dest_room and dest_room.room_number in all_rooms_dict:
            dest_room = all_rooms_dict[dest_room.room_number]

        # Check blocked locations
        if start_room and not start_room.is_active:
            raise BlockedLocationError(start_room.display_name, "Room")
        if start_node and not start_node.is_active:
            raise BlockedLocationError(start_node.name or start_node.id, "Node")
        if dest_room and not dest_room.is_active:
            raise BlockedLocationError(dest_room.display_name, "Room")
        if dest_node and not dest_node.is_active:
            raise BlockedLocationError(dest_node.name or dest_node.id, "Node")

        if start_room and not start_room.corridor_edge_id:
            raise MissingCorridorAttachment(start_room.display_name)
        if dest_room and not dest_room.corridor_edge_id:
            raise MissingCorridorAttachment(dest_room.display_name)

        # 4. Integrate vertical transitions as graph edges
        transition_map: dict[tuple[str, str], VerticalConnection] = {}
        for conn in valid_conns:
            u = conn.from_node_id
            v = conn.to_node_id
            if (
                u in all_nodes
                and v in all_nodes
                and all_nodes[u].is_active
                and all_nodes[v].is_active
            ):
                v_edge = CorridorEdge(
                    id=conn.id,
                    from_node_id=u,
                    to_node_id=v,
                    distance_weight=conn.distance_weight,
                    status=conn.status,
                    floor_id=conn.from_floor_id,
                )
                all_edges.append(v_edge)
                all_edges_dict[v_edge.id] = v_edge
                transition_map[(u, v)] = conn
                if conn.bidirectional:
                    transition_map[(v, u)] = conn

        # 5. Candidate endpoints on source and destination floors
        start_candidates = self._get_endpoint_candidates(
            start_room, start_node, all_edges_dict, all_nodes
        )
        dest_candidates = self._get_endpoint_candidates(
            dest_room, dest_node, all_edges_dict, all_nodes
        )

        best_route: tuple[list[str], float, str, str] | None = None
        min_total_cost = float("inf")

        for s_node_id, s_cost in sorted(start_candidates.items()):
            for d_node_id, d_cost in sorted(dest_candidates.items()):
                res = find_shortest_path(all_nodes, all_edges, s_node_id, d_node_id)
                if res is not None:
                    path_nodes, graph_cost = res
                    total_cost = s_cost + graph_cost + d_cost
                    if total_cost < min_total_cost:
                        min_total_cost = total_cost
                        best_route = (path_nodes, total_cost, s_node_id, d_node_id)

        if best_route is None:
            raise NoRouteAvailable(s_name, d_name)

        path_nodes, total_distance, best_s_node, best_d_node = best_route

        # 6. Build multi-floor result with segments and transitions
        return self._build_cross_floor_result(
            path_nodes=path_nodes,
            total_distance=total_distance,
            best_s_node=best_s_node,
            best_d_node=best_d_node,
            start_room=start_room,
            start_node=start_node,
            dest_room=dest_room,
            dest_node=dest_node,
            all_nodes=all_nodes,
            all_edges_dict=all_edges_dict,
            transition_map=transition_map,
            floor_meta_cache=floor_meta_cache,
            start_id=start_id,
            clean_start_type=clean_start_type,
            destination_id=destination_id,
            clean_dest_type=clean_dest_type,
            building_id=building_id,
            start_floor_id=start_floor_id,
        )

    def _build_cross_floor_result(
        self,
        path_nodes: list[str],
        total_distance: float,
        best_s_node: str,
        best_d_node: str,
        start_room: RoomAttachment | None,
        start_node: NavigationNode | None,
        dest_room: RoomAttachment | None,
        dest_node: NavigationNode | None,
        all_nodes: dict[str, NavigationNode],
        all_edges_dict: dict[str, CorridorEdge],
        transition_map: dict[tuple[str, str], VerticalConnection],
        floor_meta_cache: dict[str, dict[str, Any]],
        start_id: str,
        clean_start_type: str,
        destination_id: str,
        clean_dest_type: str,
        building_id: str,
        start_floor_id: str,
    ) -> RouteResult:
        # Group consecutive path nodes by floor_id
        groups: list[tuple[str, list[str]]] = []
        cur_fid = all_nodes[path_nodes[0]].floor_id
        cur_nodes = [path_nodes[0]]

        for nid in path_nodes[1:]:
            fid = all_nodes[nid].floor_id
            if fid == cur_fid:
                cur_nodes.append(nid)
            else:
                groups.append((cur_fid, cur_nodes))
                cur_fid = fid
                cur_nodes = [nid]
        groups.append((cur_fid, cur_nodes))

        # Assemble SVG points for each floor segment
        floor_segments: list[FloorSegment] = []
        floor_points_map: dict[int, list[RoutePathPoint]] = {}

        for g_idx, (fid, nids) in enumerate(groups):
            f_raw = floor_meta_cache.get(fid) or {}
            f_num = f_raw.get("floor_number", 1)
            svg_key = f_raw.get("floor_plan_key", "")
            seg_points: list[RoutePathPoint] = []

            # If start segment and start is room with door coordinates
            if (
                g_idx == 0
                and start_room
                and start_room.door_svg_x is not None
                and start_room.door_svg_y is not None
            ):
                seg_points.append(
                    RoutePathPoint(
                        x=start_room.door_svg_x,
                        y=start_room.door_svg_y,
                        name=start_room.display_name,
                        is_room_door=True,
                    )
                )

            for nid in nids:
                node = all_nodes[nid]
                seg_points.append(
                    RoutePathPoint(
                        x=node.svg_x,
                        y=node.svg_y,
                        node_id=node.id,
                        name=node.name,
                    )
                )

            # If last segment and dest is room with door coordinates
            if (
                g_idx == len(groups) - 1
                and dest_room
                and dest_room.door_svg_x is not None
                and dest_room.door_svg_y is not None
            ):
                seg_points.append(
                    RoutePathPoint(
                        x=dest_room.door_svg_x,
                        y=dest_room.door_svg_y,
                        name=dest_room.display_name,
                        is_room_door=True,
                    )
                )

            floor_points_map[g_idx] = seg_points
            floor_segments.append(
                FloorSegment(
                    floor_id=fid,
                    floor_number=f_num,
                    svg_key=svg_key,
                    nodes=[p.to_dict() for p in seg_points],
                )
            )

        # Generate step-by-step instructions
        steps: list[RouteStep] = []
        step_index = 1

        for g_idx, (fid, nids) in enumerate(groups):
            seg_points = floor_points_map[g_idx]
            f_raw = floor_meta_cache.get(fid) or {}
            f_num = f_raw.get("floor_number", 1)

            # Determine departure instruction on this floor
            if g_idx == 0:
                start_desc = (
                    start_room.display_name
                    if start_room
                    else (start_node.name or "starting location")
                )
                d0 = (
                    _euclidean_dist(
                        seg_points[0].x,
                        seg_points[0].y,
                        seg_points[1].x,
                        seg_points[1].y,
                    )
                    if len(seg_points) >= 2
                    else 0.0
                )
                steps.append(
                    RouteStep(
                        step_index=step_index,
                        action="DEPART",
                        instruction=f"Depart from {start_desc} and follow the corridor.",
                        distance=d0,
                        path_indices=[0, 1] if len(seg_points) >= 2 else [0],
                        floor_number=f_num,
                    )
                )
                step_index += 1
            else:
                prev_u = groups[g_idx - 1][1][-1]
                cur_v = nids[0]
                prev_conn = transition_map.get((prev_u, cur_v))
                conn_name = (
                    "stairs"
                    if prev_conn and prev_conn.connection_type == "STAIRS"
                    else "elevator"
                )
                d0 = (
                    _euclidean_dist(
                        seg_points[0].x,
                        seg_points[0].y,
                        seg_points[1].x,
                        seg_points[1].y,
                    )
                    if len(seg_points) >= 2
                    else 0.0
                )
                steps.append(
                    RouteStep(
                        step_index=step_index,
                        action="CONTINUE",
                        instruction=f"Exit the {conn_name} onto Floor {f_num} and follow the corridor.",
                        distance=d0,
                        path_indices=[0, 1] if len(seg_points) >= 2 else [0],
                        floor_number=f_num,
                    )
                )
                step_index += 1

            # Intermediate turns along points on this floor
            for i in range(1, len(seg_points) - 1):
                p_prev = seg_points[i - 1]
                p_curr = seg_points[i]
                p_next = seg_points[i + 1]

                v1x = p_curr.x - p_prev.x
                v1y = p_curr.y - p_prev.y
                v2x = p_next.x - p_curr.x
                v2y = p_next.y - p_curr.y

                l1 = math.hypot(v1x, v1y)
                l2 = math.hypot(v2x, v2y)
                if l1 < 1e-4 or l2 < 1e-4:
                    continue

                cross_prod = v1x * v2y - v1y * v2x
                dot_prod = v1x * v2x + v1y * v2y
                cos_theta = dot_prod / (l1 * l2)

                node_name = p_curr.name or "the intersection"

                if cos_theta < 0.866:
                    if cross_prod > 0:
                        action = "TURN_RIGHT"
                        instruction = f"Turn right at {node_name}."
                    else:
                        action = "TURN_LEFT"
                        instruction = f"Turn left at {node_name}."

                    steps.append(
                        RouteStep(
                            step_index=step_index,
                            action=action,
                            instruction=instruction,
                            distance=l2,
                            path_indices=[i, i + 1],
                            floor_number=f_num,
                        )
                    )
                    step_index += 1
                else:
                    if p_curr.name and p_curr.node_id:
                        steps.append(
                            RouteStep(
                                step_index=step_index,
                                action="CONTINUE",
                                instruction=f"Pass {p_curr.name} and continue straight.",
                                distance=l2,
                                path_indices=[i, i + 1],
                                floor_number=f_num,
                            )
                        )
                        step_index += 1

            # Transition step between consecutive floors
            if g_idx < len(groups) - 1:
                u_node_id = nids[-1]
                next_fid, next_nids = groups[g_idx + 1]
                v_node_id = next_nids[0]
                conn = transition_map.get((u_node_id, v_node_id))
                to_f_raw = floor_meta_cache.get(next_fid) or {}
                to_f_num = to_f_raw.get("floor_number", 2)

                conn_type = conn.connection_type if conn else "STAIRS"
                conn_dist = conn.distance_weight if conn else 30.0

                if conn_type == "STAIRS":
                    if to_f_num > f_num:
                        change_instr = f"Take the stairs up to Floor {to_f_num}."
                    else:
                        change_instr = f"Take the stairs down to Floor {to_f_num}."
                else:
                    change_instr = f"Take the elevator to Floor {to_f_num}."

                steps.append(
                    RouteStep(
                        step_index=step_index,
                        action="CHANGE_FLOOR",
                        instruction=change_instr,
                        distance=conn_dist,
                        path_indices=[len(seg_points) - 1],
                        floor_number=f_num,
                        from_floor_number=f_num,
                        to_floor_number=to_f_num,
                        transition_type=conn_type,
                    )
                )
                step_index += 1

        # Arrival step on destination floor
        dest_desc = (
            dest_room.display_name
            if dest_room
            else (dest_node.name if dest_node else "destination")
        )
        last_fid = groups[-1][0]
        last_f_raw = floor_meta_cache.get(last_fid) or {}
        last_f_num = last_f_raw.get("floor_number", 1)
        last_seg_points = floor_points_map[len(groups) - 1]

        if dest_room and dest_room.corridor_edge_id in all_edges_dict:
            edge = all_edges_dict[dest_room.corridor_edge_id]
            walking_forward = best_d_node == edge.from_node_id
            effective_side = dest_room.side
            if not walking_forward:
                effective_side = "LEFT" if dest_room.side == "RIGHT" else "RIGHT"

            side_text = f" on your {effective_side.lower()}" if effective_side else ""
            seq_text = (
                f" (door {dest_room.sequence_order} along this corridor)"
                if dest_room.sequence_order is not None
                else ""
            )
            arrive_text = f"Arrive at {dest_desc}{side_text}{seq_text}."
        else:
            arrive_text = f"Arrive at {dest_desc}."

        steps.append(
            RouteStep(
                step_index=step_index,
                action="ARRIVE",
                instruction=arrive_text,
                distance=0.0,
                path_indices=[len(last_seg_points) - 1],
                floor_number=last_f_num,
            )
        )

        start_loc_info = {
            "id": start_id,
            "type": clean_start_type,
            "name": start_room.display_name
            if start_room
            else (start_node.name or start_id),
        }
        dest_loc_info = {
            "id": destination_id,
            "type": clean_dest_type,
            "name": dest_room.display_name
            if dest_room
            else (dest_node.name or destination_id),
        }

        floors_traversed = [
            {
                "floor_id": seg.floor_id,
                "floor_number": seg.floor_number,
                "building_id": building_id,
            }
            for seg in floor_segments
        ]

        summary = RouteSummary(
            floor_id=start_floor_id,
            building_id=building_id,
            total_distance=total_distance,
            estimated_time_seconds=None,
            is_rerouted=False,
            is_cross_floor=True,
            floors_traversed=floors_traversed,
            start_location=start_loc_info,
            destination=dest_loc_info,
        )

        svg_path = floor_segments[0].to_dict()

        return RouteResult(
            summary=summary,
            svg_path=svg_path,
            steps=steps,
            floor_segments=floor_segments,
        )
