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
    NavigationNode,
    RoomAttachment,
    RoutePathPoint,
    RouteResult,
    RouteStep,
    RouteSummary,
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
            raise UnsupportedCrossFloorRoute(start_floor_id, dest_floor_id)

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
            start_location=start_loc_info,
            destination=dest_loc_info,
        )

        svg_path = {
            "floor_id": floor_id,
            "floor_number": floor_number,
            "svg_key": svg_key,
            "nodes": [p.to_dict() for p in path_points],
        }

        return RouteResult(summary=summary, svg_path=svg_path, steps=steps)

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
            if not raw_qr:
                raise LocationNotFound(target_id, "QR location")
            floor_id = raw_qr.get("floor_id") or expected_floor_id or ""
            node_id = raw_qr.get("node_id", "")
            raw_node = self.source.find_node(node_id, floor_id)
            if not raw_node:
                raise LocationNotFound(node_id, "Navigation node linked to QR")
            node = NavigationNode(
                id=raw_node.get("id", node_id),
                name=raw_node.get("name", raw_qr.get("location_description")),
                node_type=raw_node.get("node_type", "JUNCTION"),
                status=raw_node.get("status", "ACTIVE"),
                svg_x=float(raw_node.get("svg_x", 0.0)),
                svg_y=float(raw_node.get("svg_y", 0.0)),
                floor_id=floor_id,
            )
            return None, node, floor_id

        # NODE
        raw_node = self.source.find_node(target_id, expected_floor_id)
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

        summary = RouteSummary(
            floor_id=floor_id,
            building_id=floor_raw.get("building_id", ""),
            total_distance=0.0,
            estimated_time_seconds=0,
            is_rerouted=False,
            start_location={"id": loc_id, "name": name},
            destination={"id": loc_id, "name": name},
        )
        svg_path = {
            "floor_id": floor_id,
            "floor_number": floor_raw.get("floor_number", 1),
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
            )
        ]
        return RouteResult(summary=summary, svg_path=svg_path, steps=steps)

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
        summary = RouteSummary(
            floor_id=floor_id,
            building_id=floor_raw.get("building_id", ""),
            total_distance=distance,
            estimated_time_seconds=None,
            is_rerouted=False,
            start_location={"id": start_room.room_id, "name": start_room.display_name},
            destination={"id": dest_room.room_id, "name": dest_room.display_name},
        )
        svg_path = {
            "floor_id": floor_id,
            "floor_number": floor_raw.get("floor_number", 1),
            "svg_key": floor_raw.get("floor_plan_key", ""),
            "nodes": [p.to_dict() for p in path_points],
        }
        return RouteResult(summary=summary, svg_path=svg_path, steps=steps)

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
