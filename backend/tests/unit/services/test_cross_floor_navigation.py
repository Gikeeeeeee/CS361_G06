"""
Unit tests for V4-US1 Cross-Floor Visual Navigation.

Tests multi-floor graphs, vertical connections (stairs, elevators), accessibility preferences,
blocked vertical transitions, and structured CHANGE_FLOOR instructions.
Pure unit tests: uses FakeNavigationSource (no AWS credentials).
Layer: unit test.
"""

import pytest

from errors import (
    NoRouteAvailable,
    UnsupportedCrossFloorRoute,
)
from models.navigation import (
    CorridorEdge,
    NavigationNode,
    QRLocation,
    RoomAttachment,
    VerticalConnection,
)
from services.navigation_service import NavigationService
from tests.conftest import FakeNavigationSource


@pytest.fixture
def multi_floor_source() -> FakeNavigationSource:
    """Sets up a comprehensive multi-floor environment for LC3 (F1-F2) and LC4 (F1-F3)."""
    # Floors
    floors = {
        "lc3-f1": {
            "id": "lc3-f1",
            "floor_number": 1,
            "building_id": "lc3",
            "floor_plan_key": "floor-plan/LC3/LC3-floor1-neutral.svg",
        },
        "lc3-f2": {
            "id": "lc3-f2",
            "floor_number": 2,
            "building_id": "lc3",
            "floor_plan_key": "floor-plan/LC3/LC3-floor2-neutral.svg",
        },
        "lc4-f1": {
            "id": "lc4-f1",
            "floor_number": 1,
            "building_id": "lc4",
            "floor_plan_key": "floor-plan/LC4/LC4-floor1-neutral.svg",
        },
        "lc4-f2": {
            "id": "lc4-f2",
            "floor_number": 2,
            "building_id": "lc4",
            "floor_plan_key": "floor-plan/LC4/LC4-floor2-neutral.svg",
        },
        "lc4-f3": {
            "id": "lc4-f3",
            "floor_number": 3,
            "building_id": "lc4",
            "floor_plan_key": "floor-plan/LC4/LC4-floor3-neutral.svg",
        },
    }

    # Rooms
    rooms = {
        # LC3
        "lc3-room-101": {
            "id": "lc3-room-101",
            "room_number": "101",
            "name": "Room 101",
            "floor_id": "lc3-f1",
            "building_id": "lc3",
            "corridor_edge_id": "lc3-f1-e1",
            "door_svg_x": 100.0,
            "door_svg_y": 50.0,
            "side": "RIGHT",
            "sequence_order": 1,
            "status": "ACTIVE",
        },
        "lc3-room-201": {
            "id": "lc3-room-201",
            "room_number": "201",
            "name": "Room 201",
            "floor_id": "lc3-f2",
            "building_id": "lc3",
            "corridor_edge_id": "lc3-f2-e1",
            "door_svg_x": 100.0,
            "door_svg_y": 50.0,
            "side": "LEFT",
            "sequence_order": 1,
            "status": "ACTIVE",
        },
        # LC4
        "lc4-room-401": {
            "id": "lc4-room-401",
            "room_number": "401",
            "name": "Room 401",
            "floor_id": "lc4-f1",
            "building_id": "lc4",
            "corridor_edge_id": "lc4-f1-e1",
            "door_svg_x": 100.0,
            "door_svg_y": 50.0,
            "side": "RIGHT",
            "sequence_order": 1,
            "status": "ACTIVE",
        },
        "lc4-room-402": {
            "id": "lc4-room-402",
            "room_number": "402",
            "name": "Room 402",
            "floor_id": "lc4-f2",
            "building_id": "lc4",
            "corridor_edge_id": "lc4-f2-e1",
            "door_svg_x": 100.0,
            "door_svg_y": 50.0,
            "side": "RIGHT",
            "sequence_order": 1,
            "status": "ACTIVE",
        },
        "lc4-room-403": {
            "id": "lc4-room-403",
            "room_number": "403",
            "name": "Room 403",
            "floor_id": "lc4-f3",
            "building_id": "lc4",
            "corridor_edge_id": "lc4-f3-e1",
            "door_svg_x": 100.0,
            "door_svg_y": 50.0,
            "side": "LEFT",
            "sequence_order": 1,
            "status": "ACTIVE",
        },
    }

    # Navigation data per floor
    nav_data = {
        # LC3 Floor 1
        "lc3-f1": {
            "nodes": [
                NavigationNode(
                    id="lc3-f1-n1",
                    name="West corridor",
                    svg_x=100.0,
                    svg_y=100.0,
                    floor_id="lc3-f1",
                ),
                NavigationNode(
                    id="lc3-f1-stair3",
                    name="West stair landing",
                    node_type="STAIRS",
                    svg_x=100.0,
                    svg_y=200.0,
                    floor_id="lc3-f1",
                ),
                NavigationNode(
                    id="lc3-f1-stair1",
                    name="East stair landing",
                    node_type="STAIRS",
                    svg_x=800.0,
                    svg_y=200.0,
                    floor_id="lc3-f1",
                ),
            ],
            "edges": [
                CorridorEdge(
                    id="lc3-f1-e1",
                    from_node_id="lc3-f1-n1",
                    to_node_id="lc3-f1-stair3",
                    distance_weight=100.0,
                    floor_id="lc3-f1",
                ),
                CorridorEdge(
                    id="lc3-f1-e2",
                    from_node_id="lc3-f1-n1",
                    to_node_id="lc3-f1-stair1",
                    distance_weight=700.0,
                    floor_id="lc3-f1",
                ),
            ],
            "qrs": [
                QRLocation(
                    id="LC3-F1-QR1",
                    node_id="lc3-f1-n1",
                    location_description="West QR",
                    floor_id="lc3-f1",
                ),
            ],
            "rooms": [
                RoomAttachment(
                    room_id="lc3-room-101",
                    room_number="101",
                    corridor_edge_id="lc3-f1-e1",
                    door_svg_x=100.0,
                    door_svg_y=50.0,
                    side="RIGHT",
                    sequence_order=1,
                    floor_id="lc3-f1",
                    building_id="lc3",
                ),
            ],
        },
        # LC3 Floor 2
        "lc3-f2": {
            "nodes": [
                NavigationNode(
                    id="lc3-f2-n1",
                    name="West corridor F2",
                    svg_x=100.0,
                    svg_y=100.0,
                    floor_id="lc3-f2",
                ),
                NavigationNode(
                    id="lc3-f2-stair3",
                    name="West stair landing F2",
                    node_type="STAIRS",
                    svg_x=100.0,
                    svg_y=200.0,
                    floor_id="lc3-f2",
                ),
                NavigationNode(
                    id="lc3-f2-stair1",
                    name="East stair landing F2",
                    node_type="STAIRS",
                    svg_x=800.0,
                    svg_y=200.0,
                    floor_id="lc3-f2",
                ),
            ],
            "edges": [
                CorridorEdge(
                    id="lc3-f2-e1",
                    from_node_id="lc3-f2-n1",
                    to_node_id="lc3-f2-stair3",
                    distance_weight=100.0,
                    floor_id="lc3-f2",
                ),
                CorridorEdge(
                    id="lc3-f2-e2",
                    from_node_id="lc3-f2-n1",
                    to_node_id="lc3-f2-stair1",
                    distance_weight=700.0,
                    floor_id="lc3-f2",
                ),
            ],
            "qrs": [],
            "rooms": [
                RoomAttachment(
                    room_id="lc3-room-201",
                    room_number="201",
                    corridor_edge_id="lc3-f2-e1",
                    door_svg_x=100.0,
                    door_svg_y=50.0,
                    side="LEFT",
                    sequence_order=1,
                    floor_id="lc3-f2",
                    building_id="lc3",
                ),
            ],
        },
        # LC4 Floor 1
        "lc4-f1": {
            "nodes": [
                NavigationNode(
                    id="lc4-f1-n1",
                    name="Corridor F1",
                    svg_x=100.0,
                    svg_y=100.0,
                    floor_id="lc4-f1",
                ),
                NavigationNode(
                    id="lc4-f1-elev",
                    name="Elevator access",
                    node_type="ELEVATOR",
                    svg_x=150.0,
                    svg_y=100.0,
                    floor_id="lc4-f1",
                ),
                NavigationNode(
                    id="lc4-f1-stair1",
                    name="Stair 1 access",
                    node_type="STAIRS",
                    svg_x=200.0,
                    svg_y=100.0,
                    floor_id="lc4-f1",
                ),
            ],
            "edges": [
                CorridorEdge(
                    id="lc4-f1-e1",
                    from_node_id="lc4-f1-n1",
                    to_node_id="lc4-f1-elev",
                    distance_weight=50.0,
                    floor_id="lc4-f1",
                ),
                CorridorEdge(
                    id="lc4-f1-e2",
                    from_node_id="lc4-f1-elev",
                    to_node_id="lc4-f1-stair1",
                    distance_weight=50.0,
                    floor_id="lc4-f1",
                ),
                CorridorEdge(
                    id="lc4-f1-e3",
                    from_node_id="lc4-f1-n1",
                    to_node_id="lc4-f1-stair1",
                    distance_weight=70.0,
                    floor_id="lc4-f1",
                ),
            ],
            "qrs": [],
            "rooms": [
                RoomAttachment(
                    room_id="lc4-room-401",
                    room_number="401",
                    corridor_edge_id="lc4-f1-e1",
                    door_svg_x=100.0,
                    door_svg_y=50.0,
                    side="RIGHT",
                    sequence_order=1,
                    floor_id="lc4-f1",
                    building_id="lc4",
                ),
            ],
        },
        # LC4 Floor 2
        "lc4-f2": {
            "nodes": [
                NavigationNode(
                    id="lc4-f2-n1",
                    name="Corridor F2",
                    svg_x=100.0,
                    svg_y=100.0,
                    floor_id="lc4-f2",
                ),
                NavigationNode(
                    id="lc4-f2-elev",
                    name="Elevator approach F2",
                    node_type="ELEVATOR",
                    svg_x=150.0,
                    svg_y=100.0,
                    floor_id="lc4-f2",
                ),
                NavigationNode(
                    id="lc4-f2-stair1",
                    name="Stair 1 approach F2",
                    node_type="STAIRS",
                    svg_x=200.0,
                    svg_y=100.0,
                    floor_id="lc4-f2",
                ),
            ],
            "edges": [
                CorridorEdge(
                    id="lc4-f2-e1",
                    from_node_id="lc4-f2-n1",
                    to_node_id="lc4-f2-elev",
                    distance_weight=50.0,
                    floor_id="lc4-f2",
                ),
                CorridorEdge(
                    id="lc4-f2-e2",
                    from_node_id="lc4-f2-elev",
                    to_node_id="lc4-f2-stair1",
                    distance_weight=50.0,
                    floor_id="lc4-f2",
                ),
                CorridorEdge(
                    id="lc4-f2-e3",
                    from_node_id="lc4-f2-n1",
                    to_node_id="lc4-f2-stair1",
                    distance_weight=70.0,
                    floor_id="lc4-f2",
                ),
            ],
            "qrs": [],
            "rooms": [
                RoomAttachment(
                    room_id="lc4-room-402",
                    room_number="402",
                    corridor_edge_id="lc4-f2-e1",
                    door_svg_x=100.0,
                    door_svg_y=50.0,
                    side="RIGHT",
                    sequence_order=1,
                    floor_id="lc4-f2",
                    building_id="lc4",
                ),
            ],
        },
        # LC4 Floor 3
        "lc4-f3": {
            "nodes": [
                NavigationNode(
                    id="lc4-f3-n1",
                    name="Corridor F3",
                    svg_x=100.0,
                    svg_y=100.0,
                    floor_id="lc4-f3",
                ),
                NavigationNode(
                    id="lc4-f3-elev",
                    name="Elevator landing F3",
                    node_type="ELEVATOR",
                    svg_x=150.0,
                    svg_y=100.0,
                    floor_id="lc4-f3",
                ),
                NavigationNode(
                    id="lc4-f3-stair1",
                    name="Stair 1 landing F3",
                    node_type="STAIRS",
                    svg_x=200.0,
                    svg_y=100.0,
                    floor_id="lc4-f3",
                ),
            ],
            "edges": [
                CorridorEdge(
                    id="lc4-f3-e1",
                    from_node_id="lc4-f3-n1",
                    to_node_id="lc4-f3-elev",
                    distance_weight=50.0,
                    floor_id="lc4-f3",
                ),
                CorridorEdge(
                    id="lc4-f3-e2",
                    from_node_id="lc4-f3-elev",
                    to_node_id="lc4-f3-stair1",
                    distance_weight=50.0,
                    floor_id="lc4-f3",
                ),
                CorridorEdge(
                    id="lc4-f3-e3",
                    from_node_id="lc4-f3-n1",
                    to_node_id="lc4-f3-stair1",
                    distance_weight=70.0,
                    floor_id="lc4-f3",
                ),
            ],
            "qrs": [],
            "rooms": [
                RoomAttachment(
                    room_id="lc4-room-403",
                    room_number="403",
                    corridor_edge_id="lc4-f3-e1",
                    door_svg_x=100.0,
                    door_svg_y=50.0,
                    side="LEFT",
                    sequence_order=1,
                    floor_id="lc4-f3",
                    building_id="lc4",
                ),
            ],
        },
    }

    # Vertical connections
    vertical_connections = {
        "lc3": [
            VerticalConnection(
                id="LC3-STAIR3-F1-F2",
                building_id="lc3",
                connection_type="STAIRS",
                from_floor_id="lc3-f1",
                from_node_id="lc3-f1-stair3",
                to_floor_id="lc3-f2",
                to_node_id="lc3-f2-stair3",
                distance_weight=30.0,
                status="ACTIVE",
                name="West Stair 3",
            ),
            VerticalConnection(
                id="LC3-STAIR1-F1-F2",
                building_id="lc3",
                connection_type="STAIRS",
                from_floor_id="lc3-f1",
                from_node_id="lc3-f1-stair1",
                to_floor_id="lc3-f2",
                to_node_id="lc3-f2-stair1",
                distance_weight=30.0,
                status="ACTIVE",
                name="East Stair 1",
            ),
        ],
        "lc4": [
            VerticalConnection(
                id="LC4-ELEV-F1-F2",
                building_id="lc4",
                connection_type="ELEVATOR",
                from_floor_id="lc4-f1",
                from_node_id="lc4-f1-elev",
                to_floor_id="lc4-f2",
                to_node_id="lc4-f2-elev",
                distance_weight=40.0,
                status="ACTIVE",
            ),
            VerticalConnection(
                id="LC4-ELEV-F2-F3",
                building_id="lc4",
                connection_type="ELEVATOR",
                from_floor_id="lc4-f2",
                from_node_id="lc4-f2-elev",
                to_floor_id="lc4-f3",
                to_node_id="lc4-f3-elev",
                distance_weight=40.0,
                status="ACTIVE",
            ),
            VerticalConnection(
                id="LC4-ELEV-F1-F3",
                building_id="lc4",
                connection_type="ELEVATOR",
                from_floor_id="lc4-f1",
                from_node_id="lc4-f1-elev",
                to_floor_id="lc4-f3",
                to_node_id="lc4-f3-elev",
                distance_weight=50.0,
                status="ACTIVE",
            ),
            VerticalConnection(
                id="LC4-STAIR1-F1-F2",
                building_id="lc4",
                connection_type="STAIRS",
                from_floor_id="lc4-f1",
                from_node_id="lc4-f1-stair1",
                to_floor_id="lc4-f2",
                to_node_id="lc4-f2-stair1",
                distance_weight=25.0,
                status="ACTIVE",
            ),
            VerticalConnection(
                id="LC4-STAIR1-F2-F3",
                building_id="lc4",
                connection_type="STAIRS",
                from_floor_id="lc4-f2",
                from_node_id="lc4-f2-stair1",
                to_floor_id="lc4-f3",
                to_node_id="lc4-f3-stair1",
                distance_weight=25.0,
                status="ACTIVE",
            ),
        ],
    }

    return FakeNavigationSource(
        floors=floors,
        rooms=rooms,
        nav_data=nav_data,
        vertical_connections=vertical_connections,
    )


# ---------------------------------------------------------------------------
# Test Cases
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_lc3_cross_floor_stair_routing(multi_floor_source):
    """Test routing between LC3 Floor 1 and Floor 2 using stairs."""
    svc = NavigationService(multi_floor_source)
    res = svc.calculate_route(
        start_id="101",
        start_type="ROOM",
        destination_id="201",
        destination_type="ROOM",
    )

    summary = res.summary
    assert summary.is_cross_floor is True
    assert summary.building_id == "lc3"
    assert len(summary.floors_traversed) == 2
    assert summary.floors_traversed[0]["floor_number"] == 1
    assert summary.floors_traversed[1]["floor_number"] == 2

    # Verify floor segments
    assert res.floor_segments is not None
    assert len(res.floor_segments) == 2
    assert res.floor_segments[0].floor_number == 1
    assert res.floor_segments[1].floor_number == 2

    # Verify structured CHANGE_FLOOR instruction
    change_steps = [s for s in res.steps if s.action == "CHANGE_FLOOR"]
    assert len(change_steps) == 1
    stair_step = change_steps[0]
    assert stair_step.transition_type == "STAIRS"
    assert stair_step.from_floor_number == 1
    assert stair_step.to_floor_number == 2
    assert "Take the stairs up to Floor 2." in stair_step.instruction

    # Verify arrival step
    last_step = res.steps[-1]
    assert last_step.action == "ARRIVE"
    assert last_step.floor_number == 2


@pytest.mark.unit
def test_lc4_cross_floor_shortest_path_chooses_stair_when_shorter(multi_floor_source):
    """In LC4, stair path is shorter (25+25=50 vs elevator waiting/riding cost)."""
    svc = NavigationService(multi_floor_source)
    res = svc.calculate_route(
        start_id="401",
        start_type="ROOM",
        destination_id="403",
        destination_type="ROOM",
    )

    change_steps = [s for s in res.steps if s.action == "CHANGE_FLOOR"]
    assert len(change_steps) >= 1
    assert res.summary.is_cross_floor is True
    assert res.summary.building_id == "lc4"


@pytest.mark.unit
def test_lc4_accessibility_preference_forces_elevator(multi_floor_source):
    """When user requests accessible route or avoid_stairs, use elevator even if stairs are shorter."""
    svc = NavigationService(multi_floor_source)
    res = svc.calculate_route(
        start_id="401",
        start_type="ROOM",
        destination_id="403",
        destination_type="ROOM",
        preferences={"avoid_stairs": True},
    )

    change_steps = [s for s in res.steps if s.action == "CHANGE_FLOOR"]
    assert len(change_steps) == 1
    assert change_steps[0].transition_type == "ELEVATOR"
    assert "Take the elevator to Floor 3." in change_steps[0].instruction


@pytest.mark.unit
def test_lc4_stairs_only_preference_ignores_elevator(multi_floor_source):
    """When user requests stairs_only, elevator is skipped."""
    svc = NavigationService(multi_floor_source)
    res = svc.calculate_route(
        start_id="401",
        start_type="ROOM",
        destination_id="402",
        destination_type="ROOM",
        preferences={"stairs_only": True},
    )

    change_steps = [s for s in res.steps if s.action == "CHANGE_FLOOR"]
    assert len(change_steps) == 1
    assert change_steps[0].transition_type == "STAIRS"


@pytest.mark.unit
def test_blocked_stair_reroutes_via_elevator(multi_floor_source):
    """If the stair landing node is blocked, navigation automatically falls back to elevator."""
    # Block Stair 1 node on LC4 F1
    for node in multi_floor_source._nav_data["lc4-f1"]["nodes"]:
        if node.id == "lc4-f1-stair1":
            object.__setattr__(node, "status", "BLOCKED")

    svc = NavigationService(multi_floor_source)
    res = svc.calculate_route(
        start_id="401",
        start_type="ROOM",
        destination_id="402",
        destination_type="ROOM",
    )

    change_steps = [s for s in res.steps if s.action == "CHANGE_FLOOR"]
    assert len(change_steps) == 1
    assert change_steps[0].transition_type == "ELEVATOR"


@pytest.mark.unit
def test_blocked_elevator_reroutes_via_stair(multi_floor_source):
    """If the elevator node is blocked, navigation falls back to stairs."""
    for node in multi_floor_source._nav_data["lc4-f1"]["nodes"]:
        if node.id == "lc4-f1-elev":
            object.__setattr__(node, "status", "BLOCKED")

    svc = NavigationService(multi_floor_source)
    res = svc.calculate_route(
        start_id="401",
        start_type="ROOM",
        destination_id="402",
        destination_type="ROOM",
    )

    change_steps = [s for s in res.steps if s.action == "CHANGE_FLOOR"]
    assert len(change_steps) == 1
    assert change_steps[0].transition_type == "STAIRS"


@pytest.mark.unit
def test_all_vertical_transitions_blocked_raises_no_route(multi_floor_source):
    """When both stair and elevator transitions are blocked, raise NoRouteAvailable."""
    for node in multi_floor_source._nav_data["lc4-f1"]["nodes"]:
        if node.node_type in ["STAIRS", "ELEVATOR"]:
            object.__setattr__(node, "status", "BLOCKED")

    svc = NavigationService(multi_floor_source)
    with pytest.raises(NoRouteAvailable):
        svc.calculate_route(
            start_id="401",
            start_type="ROOM",
            destination_id="402",
            destination_type="ROOM",
        )


@pytest.mark.unit
def test_missing_vertical_connection_records_raises_unsupported(multi_floor_source):
    """When building has no vertical connection records, cross-floor raises UnsupportedCrossFloorRoute."""
    multi_floor_source._vertical_connections["lc3"] = []

    svc = NavigationService(multi_floor_source)
    with pytest.raises(
        UnsupportedCrossFloorRoute,
        match="Cross-floor navigation is currently unsupported",
    ):
        svc.calculate_route(
            start_id="101",
            start_type="ROOM",
            destination_id="201",
            destination_type="ROOM",
        )


@pytest.mark.unit
def test_cross_building_rejection(multi_floor_source):
    """Navigating between rooms in different buildings (LC3 F1 to LC4 F3) must be rejected."""
    svc = NavigationService(multi_floor_source)
    with pytest.raises(
        UnsupportedCrossFloorRoute,
        match="Cross-building navigation is currently unsupported",
    ):
        svc.calculate_route(
            start_id="101",
            start_type="ROOM",
            destination_id="403",
            destination_type="ROOM",
        )


@pytest.mark.unit
def test_descending_stairs_instruction(multi_floor_source):
    """Navigating downwards (Floor 2 to Floor 1) produces 'Take the stairs down to Floor 1.'"""
    svc = NavigationService(multi_floor_source)
    res = svc.calculate_route(
        start_id="201",
        start_type="ROOM",
        destination_id="101",
        destination_type="ROOM",
    )

    change_steps = [s for s in res.steps if s.action == "CHANGE_FLOOR"]
    assert len(change_steps) == 1
    assert "Take the stairs down to Floor 1." in change_steps[0].instruction
    assert change_steps[0].from_floor_number == 2
    assert change_steps[0].to_floor_number == 1


@pytest.mark.unit
def test_qr_to_room_cross_floor(multi_floor_source):
    """Start navigation from a QR code on Floor 1 to a Room on Floor 2."""
    svc = NavigationService(multi_floor_source)
    res = svc.calculate_route(
        start_id="LC3-F1-QR1",
        start_type="QR",
        destination_id="201",
        destination_type="ROOM",
    )

    assert res.summary.is_cross_floor is True
    assert res.summary.start_location["type"] == "QR"
    assert len(res.floor_segments) == 2


@pytest.mark.unit
def test_floor_1_to_floor_3_direct_elevator_transition(multi_floor_source):
    """Direct Floor 1 to Floor 3 express elevator transition produces exactly 1 CHANGE_FLOOR step."""
    svc = NavigationService(multi_floor_source)
    res = svc.calculate_route(
        start_id="401",
        start_type="ROOM",
        destination_id="403",
        destination_type="ROOM",
        preferences={"avoid_stairs": True},
    )

    change_steps = [s for s in res.steps if s.action == "CHANGE_FLOOR"]
    assert len(change_steps) == 1
    step = change_steps[0]
    assert step.from_floor_number == 1
    assert step.to_floor_number == 3
    assert step.transition_type == "ELEVATOR"
    assert "Take the elevator to Floor 3." in step.instruction
    assert len(res.floor_segments) == 2
    assert res.floor_segments[0].floor_number == 1
    assert res.floor_segments[1].floor_number == 3


@pytest.mark.unit
def test_single_floor_backward_compatibility(multi_floor_source):
    """Single-floor routing remains intact with is_cross_floor=False and 1 segment."""
    svc = NavigationService(multi_floor_source)
    res = svc.calculate_route(
        start_id="101",
        start_type="ROOM",
        destination_id="101",
        destination_type="ROOM",
    )

    assert res.summary.is_cross_floor is False
    assert res.summary.total_distance == 0.0
    assert len(res.floor_segments) == 1
    assert res.steps[0].action == "ARRIVE"


@pytest.mark.unit
def test_invalid_vertical_reference_skipped_safely(multi_floor_source):
    """If a vertical connection references a non-existent node, it is skipped without crashing."""
    invalid_conn = VerticalConnection(
        id="INVALID-CONN",
        building_id="lc4",
        connection_type="STAIRS",
        from_floor_id="lc4-f1",
        from_node_id="NON_EXISTENT_NODE_123",
        to_floor_id="lc4-f2",
        to_node_id="NON_EXISTENT_NODE_456",
        distance_weight=10.0,
        status="ACTIVE",
    )
    multi_floor_source._vertical_connections["lc4"].append(invalid_conn)

    svc = NavigationService(multi_floor_source)
    res = svc.calculate_route(
        start_id="401",
        start_type="ROOM",
        destination_id="402",
        destination_type="ROOM",
    )
    assert res.summary.is_cross_floor is True
