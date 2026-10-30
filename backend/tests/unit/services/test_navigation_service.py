import pytest

from errors import (
    BlockedLocationError,
    InvalidNavigationInput,
    LocationNotFound,
    MissingCorridorAttachment,
    NoRouteAvailable,
    RoomNotFound,
    UnsupportedCrossFloorRoute,
)
from services.navigation_service import NavigationService


@pytest.mark.unit
def test_calculate_route_node_to_room(sample_navigation_source):
    svc = NavigationService(sample_navigation_source)
    res = svc.calculate_route(
        start_id="N1",
        start_type="NODE",
        destination_id="104",
        destination_type="ROOM",
    )

    assert res.summary.floor_id == "floor-lc3-1"
    assert res.summary.building_id == "lc3"
    assert res.summary.total_distance > 0.0
    assert len(res.svg_path["nodes"]) >= 3
    assert res.steps[0].action == "DEPART"
    assert res.steps[-1].action == "ARRIVE"
    assert "Room 104" in res.steps[-1].instruction


@pytest.mark.unit
def test_calculate_route_qr_to_room(sample_navigation_source):
    svc = NavigationService(sample_navigation_source)
    res = svc.calculate_route(
        start_id="QR-01",
        start_type="QR",
        destination_id="room-104",
        destination_type="ROOM",
    )

    assert res.summary.start_location["type"] == "QR"
    assert res.summary.destination["id"] == "room-104"
    assert len(res.steps) >= 2


@pytest.mark.unit
def test_calculate_route_same_edge_rooms(sample_navigation_source):
    svc = NavigationService(sample_navigation_source)
    res = svc.calculate_route(
        start_id="101",
        start_type="ROOM",
        destination_id="102",
        destination_type="ROOM",
    )

    assert res.summary.total_distance == pytest.approx(30.0, rel=1e-2)
    assert res.steps[0].action == "DEPART"
    assert res.steps[1].action == "ARRIVE"
    assert "door 2" in res.steps[1].instruction


@pytest.mark.unit
def test_calculate_route_room_to_room_across_edges(sample_navigation_source):
    svc = NavigationService(sample_navigation_source)
    res = svc.calculate_route(
        start_id="101",
        start_type="ROOM",
        destination_id="104",
        destination_type="ROOM",
    )

    # Room 101 on E1 -> N2 -> N3 -> Room 104 on E3
    actions = [s.action for s in res.steps]
    assert "DEPART" in actions
    assert (
        "TURN_RIGHT" in actions
    )  # N2 (200, 100) -> N3 (300, 100) -> N4 (300, 200) is a right turn
    assert "ARRIVE" in actions


@pytest.mark.unit
def test_calculate_route_same_location(sample_navigation_source):
    svc = NavigationService(sample_navigation_source)
    res = svc.calculate_route(
        start_id="101",
        start_type="ROOM",
        destination_id="101",
        destination_type="ROOM",
    )

    assert res.summary.total_distance == 0.0
    assert len(res.steps) == 1
    assert res.steps[0].action == "ARRIVE"
    assert "already at" in res.steps[0].instruction


@pytest.mark.unit
def test_calculate_route_blocked_destination_raises(sample_navigation_source):
    svc = NavigationService(sample_navigation_source)
    with pytest.raises(BlockedLocationError, match="blocked or unavailable"):
        svc.calculate_route(
            start_id="N1",
            start_type="NODE",
            destination_id="999",
            destination_type="ROOM",
        )


@pytest.mark.unit
def test_calculate_route_missing_corridor_attachment_raises(sample_navigation_source):
    svc = NavigationService(sample_navigation_source)
    with pytest.raises(MissingCorridorAttachment, match="not attached to any corridor"):
        svc.calculate_route(
            start_id="N1",
            start_type="NODE",
            destination_id="000",
            destination_type="ROOM",
        )


@pytest.mark.unit
def test_calculate_route_unreachable_destination_raises(sample_navigation_source):
    svc = NavigationService(sample_navigation_source)
    with pytest.raises(NoRouteAvailable, match="No navigable route found"):
        svc.calculate_route(
            start_id="N_DISCONNECTED",
            start_type="NODE",
            destination_id="104",
            destination_type="ROOM",
        )


@pytest.mark.unit
def test_calculate_route_unsupported_cross_floor_raises(sample_navigation_source):
    svc = NavigationService(sample_navigation_source)
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
def test_calculate_route_nonexistent_start_or_destination_raises(
    sample_navigation_source,
):
    svc = NavigationService(sample_navigation_source)
    with pytest.raises(RoomNotFound):
        svc.calculate_route(
            start_id="N1",
            start_type="NODE",
            destination_id="NONEXISTENT",
            destination_type="ROOM",
        )

    with pytest.raises(LocationNotFound):
        svc.calculate_route(
            start_id="NONEXISTENT_NODE",
            start_type="NODE",
            destination_id="101",
            destination_type="ROOM",
        )


@pytest.mark.unit
def test_calculate_route_invalid_inputs_raises(sample_navigation_source):
    svc = NavigationService(sample_navigation_source)
    with pytest.raises(InvalidNavigationInput):
        svc.calculate_route(start_id="", start_type="NODE", destination_id="101")

    with pytest.raises(InvalidNavigationInput):
        svc.calculate_route(
            start_id="N1", start_type="INVALID_TYPE", destination_id="101"
        )
