"""Unit tests for Graph Exclusion logic in NavigationService (V4-US2)."""

import pytest

from errors import BlockedLocationError, NoRouteAvailable
from models.navigation import (
    CorridorEdge,
    NavigationNode,
    RoomAttachment,
)
from ports.navigation_source import NavigationSource
from services.navigation_service import NavigationService


class CustomGraphSource(NavigationSource):
    """Source with customizable node/edge/room statuses for graph exclusion tests."""

    def __init__(self):
        # Topology:
        # N1 is start, N3 is destination
        # Path 1 (lower cost): N1 --(E12: 10)--> N2 --(E23: 10)--> N3 (total = 20)
        # Path 2 (higher cost detour): N1 --(E14: 15)--> N4 --(E43: 15)--> N3 (total = 30)
        self.nodes = {
            "N1": NavigationNode(
                id="N1", name="Junction 1", svg_x=0.0, svg_y=0.0, floor_id="f1"
            ),
            "N2": NavigationNode(
                id="N2", name="Junction 2", svg_x=10.0, svg_y=0.0, floor_id="f1"
            ),
            "N3": NavigationNode(
                id="N3", name="Junction 3", svg_x=20.0, svg_y=0.0, floor_id="f1"
            ),
            "N4": NavigationNode(
                id="N4", name="Junction 4 Detour", svg_x=10.0, svg_y=20.0, floor_id="f1"
            ),
        }
        self.edges = {
            "E12": CorridorEdge(
                id="E12",
                from_node_id="N1",
                to_node_id="N2",
                distance_weight=10.0,
                floor_id="f1",
            ),
            "E23": CorridorEdge(
                id="E23",
                from_node_id="N2",
                to_node_id="N3",
                distance_weight=10.0,
                floor_id="f1",
            ),
            "E14": CorridorEdge(
                id="E14",
                from_node_id="N1",
                to_node_id="N4",
                distance_weight=15.0,
                floor_id="f1",
            ),
            "E43": CorridorEdge(
                id="E43",
                from_node_id="N4",
                to_node_id="N3",
                distance_weight=15.0,
                floor_id="f1",
            ),
        }
        self.rooms = {
            "R101": RoomAttachment(
                room_id="R101",
                room_number="101",
                corridor_edge_id="E12",
                door_svg_x=5.0,
                door_svg_y=0.0,
                floor_id="f1",
                building_id="b1",
                status="ACTIVE",
            ),
            "R103": RoomAttachment(
                room_id="R103",
                room_number="103",
                corridor_edge_id="E23",
                door_svg_x=15.0,
                door_svg_y=0.0,
                floor_id="f1",
                building_id="b1",
                status="ACTIVE",
            ),
        }

    def get_floor_navigation_data(self, floor_id: str) -> dict:
        return {
            "nodes": list(self.nodes.values()),
            "edges": list(self.edges.values()),
            "rooms": list(self.rooms.values()),
            "qrs": [],
        }

    def get_floor(self, floor_id: str):
        return {"id": floor_id, "building_id": "b1", "floor_number": 1}

    def get_room(self, room_id: str):
        for r in self.rooms.values():
            if r.room_id == room_id or r.room_number == room_id:
                return {
                    "id": r.room_id,
                    "room_number": r.room_number,
                    "floor_id": r.floor_id,
                    "building_id": r.building_id,
                    "corridor_edge_id": r.corridor_edge_id,
                    "door_svg_x": r.door_svg_x,
                    "door_svg_y": r.door_svg_y,
                    "side": r.side,
                    "sequence_order": r.sequence_order,
                    "status": r.status,
                }
        return None

    def find_node(self, node_id: str, floor_id: str | None = None):
        n = self.nodes.get(node_id)
        if n:
            return {
                "id": n.id,
                "name": n.name,
                "node_type": n.node_type,
                "svg_x": n.svg_x,
                "svg_y": n.svg_y,
                "floor_id": n.floor_id,
                "status": n.status,
            }
        return None

    def find_qr(self, qr_id: str, floor_id: str | None = None):
        return None

    def get_vertical_connections(self, building_id: str):
        return []


@pytest.mark.unit
def test_blocked_corridor_edge_takes_detour():
    source = CustomGraphSource()
    svc = NavigationService(source)

    # Initially, shortest path from N1 to N3 uses E12 -> E23 (via N2, distance 20.0)
    res_normal = svc.calculate_route("N1", "NODE", "N3", "NODE")
    path_nodes_normal = [
        n["node_id"] for n in res_normal.svg_path["nodes"] if n.get("node_id")
    ]
    assert path_nodes_normal == ["N1", "N2", "N3"]
    assert res_normal.summary.total_distance == pytest.approx(20.0)

    # Now block corridor edge E12
    source.edges["E12"] = CorridorEdge(
        id="E12",
        from_node_id="N1",
        to_node_id="N2",
        distance_weight=10.0,
        status="BLOCKED",
        floor_id="f1",
    )

    # Routing recalculates shortest path excluding E12, taking detour via N4 (distance 30.0)
    res_rerouted = svc.calculate_route("N1", "NODE", "N3", "NODE")
    path_nodes_rerouted = [
        n["node_id"] for n in res_rerouted.svg_path["nodes"] if n.get("node_id")
    ]
    assert path_nodes_rerouted == ["N1", "N4", "N3"]
    assert res_rerouted.summary.total_distance == pytest.approx(30.0)

    # Reopening the stored edge restores the shortest path on the next search.
    source.edges["E12"] = CorridorEdge(
        id="E12", from_node_id="N1", to_node_id="N2",
        distance_weight=10.0, status="ACTIVE", floor_id="f1",
    )
    reopened = svc.calculate_route("N1", "NODE", "N3", "NODE")
    assert [n["node_id"] for n in reopened.svg_path["nodes"]] == ["N1", "N2", "N3"]
    assert reopened.summary.total_distance == pytest.approx(20.0)


@pytest.mark.unit
def test_blocked_navigation_node_takes_detour():
    source = CustomGraphSource()
    svc = NavigationService(source)

    # Block junction node N2
    source.nodes["N2"] = NavigationNode(
        id="N2",
        name="Junction 2",
        svg_x=10.0,
        svg_y=0.0,
        floor_id="f1",
        status="BLOCKED",
    )

    # Routing avoids N2 and detours through N4
    res = svc.calculate_route("N1", "NODE", "N3", "NODE")
    path_nodes = [n["node_id"] for n in res.svg_path["nodes"] if n.get("node_id")]
    assert path_nodes == ["N1", "N4", "N3"]


@pytest.mark.unit
def test_all_paths_blocked_raises_no_route_available():
    source = CustomGraphSource()
    svc = NavigationService(source)

    # Block both possible exits from N1
    source.edges["E12"] = CorridorEdge(
        id="E12",
        from_node_id="N1",
        to_node_id="N2",
        distance_weight=10.0,
        status="BLOCKED",
        floor_id="f1",
    )
    source.edges["E14"] = CorridorEdge(
        id="E14",
        from_node_id="N1",
        to_node_id="N4",
        distance_weight=15.0,
        status="BLOCKED",
        floor_id="f1",
    )

    with pytest.raises(NoRouteAvailable):
        svc.calculate_route("N1", "NODE", "N3", "NODE")


@pytest.mark.unit
def test_closed_room_destination_raises_blocked_location_error():
    source = CustomGraphSource()
    svc = NavigationService(source)

    source.rooms["R103"] = RoomAttachment(
        room_id="R103",
        room_number="103",
        corridor_edge_id="E23",
        door_svg_x=15.0,
        door_svg_y=0.0,
        floor_id="f1",
        building_id="b1",
        status="CLOSED",
    )

    with pytest.raises(BlockedLocationError) as exc_info:
        svc.calculate_route("N1", "NODE", "103", "ROOM")
    assert "currently blocked or unavailable" in str(exc_info.value)


@pytest.mark.unit
def test_maintenance_room_destination_raises_blocked_location_error():
    source = CustomGraphSource()
    svc = NavigationService(source)

    source.rooms["R103"] = RoomAttachment(
        room_id="R103",
        room_number="103",
        corridor_edge_id="E23",
        door_svg_x=15.0,
        door_svg_y=0.0,
        floor_id="f1",
        building_id="b1",
        status="MAINTENANCE",
    )

    with pytest.raises(BlockedLocationError) as exc_info:
        svc.calculate_route("N1", "NODE", "103", "ROOM")
    assert "currently blocked or unavailable" in str(exc_info.value)


@pytest.mark.unit
def test_closed_start_room_raises_blocked_location_error():
    source = CustomGraphSource()
    svc = NavigationService(source)

    source.rooms["R101"] = RoomAttachment(
        room_id="R101",
        room_number="101",
        corridor_edge_id="E12",
        door_svg_x=5.0,
        door_svg_y=0.0,
        floor_id="f1",
        building_id="b1",
        status="CLOSED",
    )

    with pytest.raises(BlockedLocationError):
        svc.calculate_route("101", "ROOM", "N3", "NODE")


@pytest.mark.unit
def test_room_on_blocked_corridor_edge_raises_blocked_error():
    source = CustomGraphSource()
    svc = NavigationService(source)

    # Block edge E12 which room R101 is attached to
    source.edges["E12"] = CorridorEdge(
        id="E12",
        from_node_id="N1",
        to_node_id="N2",
        distance_weight=10.0,
        status="BLOCKED",
        floor_id="f1",
    )

    with pytest.raises(BlockedLocationError):
        svc.calculate_route("101", "ROOM", "N3", "NODE")


@pytest.mark.unit
def test_cross_floor_blocked_elevator_node_falls_back_to_stairs(
    sample_multi_floor_source,
):
    svc = NavigationService(sample_multi_floor_source)

    # Initially, route between 401 and 402 without preference uses elevator
    res_before = svc.calculate_route("401", "ROOM", "402", "ROOM")
    assert len(res_before.floor_segments) == 2
    instr_before = " ".join(s.instruction for s in res_before.steps)
    assert "elevator" in instr_before.lower()

    # Now mark the elevator node on floor lc4-f1 as BLOCKED
    sample_multi_floor_source._nav_data["lc4-f1"]["nodes"] = [
        NavigationNode(
            id=n.id,
            name=n.name,
            node_type=n.node_type,
            svg_x=n.svg_x,
            svg_y=n.svg_y,
            floor_id=n.floor_id,
            status="BLOCKED" if n.id == "lc4-f1-elev" else n.status,
        )
        for n in sample_multi_floor_source._nav_data["lc4-f1"]["nodes"]
    ]

    # Recalculate route: should exclude the blocked elevator and fall back to stairs!
    res_after = svc.calculate_route("401", "ROOM", "402", "ROOM")
    assert len(res_after.floor_segments) == 2
    instr_after = " ".join(s.instruction for s in res_after.steps)
    assert "stairs" in instr_after.lower()
    assert "elevator" not in instr_after.lower()
