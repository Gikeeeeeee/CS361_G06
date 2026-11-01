"""Unit tests for StatusRepository (V4-US2)."""

from unittest.mock import MagicMock
import pytest

from errors import (
    CorridorEdgeNotFound,
    FloorNotFound,
    InvalidStatusValue,
    NavigationNodeNotFound,
    RoomNotFound,
)
from repositories.status_repository import StatusRepository


@pytest.mark.unit
def test_get_floor_status_overlay_success():
    table = MagicMock()
    reader = MagicMock()
    reader.find_by_id.return_value = {"id": "FL_BR2_04"}

    table.query.return_value = {
        "Items": [
            {
                "PK": "FLOOR#FL_BR2_04",
                "SK": "ROOM#RM_BR2_401",
                "id": "RM_BR2_401",
                "room_code": "BR2-401",
                "status": "CLOSED",
                "status_note": "แอร์เสีย ย้ายไปเรียนห้อง BR2-405",
                "updated_at": "2026-10-27T15:30:00Z",
            },
            {
                "PK": "FLOOR#FL_BR2_04",
                "SK": "ROOM#RM_BR2_402",
                "id": "RM_BR2_402",
                "room_code": "BR2-402",
                # Legacy item without status
            },
            {
                "PK": "FLOOR#FL_BR2_04",
                "SK": "CORRIDOR_EDGE#EDGE_CORR_N4",
                "id": "EDGE_CORR_N4",
                "status": "BLOCKED",
                "status_note": "ปิดปรับปรุงพื้นทางเดินช่วง 13:00 - 17:00",
            },
            {
                "PK": "FLOOR#FL_BR2_04",
                "SK": "NAV_NODE#NODE_ELEV_04",
                "id": "NODE_ELEV_04",
                "status": "ACTIVE",
            },
        ]
    }

    repo = StatusRepository(table=table, reader=reader)
    overlay = repo.get_floor_status_overlay("FL_BR2_04")

    assert overlay["floor_id"] == "FL_BR2_04"
    assert overlay["updated_at"] == "2026-10-27T15:30:00Z"

    # Rooms
    assert len(overlay["rooms"]) == 2
    assert overlay["rooms"][0]["room_id"] == "RM_BR2_401"
    assert overlay["rooms"][0]["status"] == "CLOSED"
    assert overlay["rooms"][0]["status_note"] == "แอร์เสีย ย้ายไปเรียนห้อง BR2-405"
    # Legacy room defaults to ACTIVE and status_note to None
    assert overlay["rooms"][1]["room_id"] == "RM_BR2_402"
    assert overlay["rooms"][1]["status"] == "ACTIVE"
    assert overlay["rooms"][1]["status_note"] is None

    # Corridor edges
    assert len(overlay["corridor_edges"]) == 1
    assert overlay["corridor_edges"][0]["edge_id"] == "EDGE_CORR_N4"
    assert overlay["corridor_edges"][0]["status"] == "BLOCKED"

    # Navigation nodes
    assert len(overlay["navigation_nodes"]) == 1
    assert overlay["navigation_nodes"][0]["node_id"] == "NODE_ELEV_04"
    assert overlay["navigation_nodes"][0]["status"] == "ACTIVE"
    assert overlay["navigation_nodes"][0]["status_note"] is None


@pytest.mark.unit
def test_get_floor_status_overlay_floor_not_found():
    table = MagicMock()
    reader = MagicMock()
    reader.find_by_id.return_value = None
    table.query.return_value = {"Items": []}

    repo = StatusRepository(table=table, reader=reader)
    with pytest.raises(FloorNotFound) as exc_info:
        repo.get_floor_status_overlay("NON_EXISTENT")
    assert "Floor with ID NON_EXISTENT does not exist." in str(exc_info.value)


@pytest.mark.unit
def test_update_room_status_conditional_update():
    table = MagicMock()
    # Mock _find_item
    table.query.return_value = {
        "Items": [
            {
                "PK": "FLOOR#FL_BR2_04",
                "SK": "ROOM#RM_BR2_401",
                "id": "RM_BR2_401",
                "room_code": "BR2-401",
            }
        ]
    }

    repo = StatusRepository(table=table)
    result = repo.update_room_status(
        room_id="RM_BR2_401",
        status="CLOSED",
        status_note="แอร์เสีย",
        updated_by="user-uuid-1234",
    )

    assert result["room_id"] == "RM_BR2_401"
    assert result["room_code"] == "BR2-401"
    assert result["status"] == "CLOSED"
    assert result["status_note"] == "แอร์เสีย"
    assert result["updated_by"] == "user-uuid-1234"
    assert "updated_at" in result

    # Check DynamoDB update_item call
    table.update_item.assert_called_once()
    call_kwargs = table.update_item.call_args[1]
    assert call_kwargs["Key"] == {"PK": "FLOOR#FL_BR2_04", "SK": "ROOM#RM_BR2_401"}
    assert call_kwargs["ConditionExpression"] == "attribute_exists(PK)"
    assert call_kwargs["ExpressionAttributeValues"][":s"] == "CLOSED"
    assert call_kwargs["ExpressionAttributeValues"][":s_note"] == "แอร์เสีย"
    assert call_kwargs["ExpressionAttributeValues"][":u_by"] == "user-uuid-1234"


@pytest.mark.unit
def test_update_room_status_invalid_value():
    table = MagicMock()
    repo = StatusRepository(table=table)

    with pytest.raises(InvalidStatusValue) as exc_info:
        repo.update_room_status("RM_101", status="INVALID_STATUS")
    assert "Status must be one of: ACTIVE, CLOSED, MAINTENANCE." in str(exc_info.value)


@pytest.mark.unit
def test_update_room_status_not_found():
    table = MagicMock()
    table.query.return_value = {"Items": []}
    table.scan.return_value = {"Items": []}

    repo = StatusRepository(table=table)
    with pytest.raises(RoomNotFound) as exc_info:
        repo.update_room_status("UNKNOWN_ROOM", status="CLOSED")
    assert "Room with ID UNKNOWN_ROOM does not exist." in str(exc_info.value)


@pytest.mark.unit
def test_update_corridor_edge_status_success():
    table = MagicMock()
    table.query.return_value = {
        "Items": [
            {
                "PK": "FLOOR#FL_BR2_04",
                "SK": "CORRIDOR_EDGE#EDGE_CORR_N4",
                "id": "EDGE_CORR_N4",
            }
        ]
    }

    repo = StatusRepository(table=table)
    result = repo.update_corridor_edge_status(
        edge_id="EDGE_CORR_N4",
        status="BLOCKED",
        status_note="ปิดซ่อม",
        updated_by="staff-123",
    )

    assert result["edge_id"] == "EDGE_CORR_N4"
    assert result["status"] == "BLOCKED"
    assert result["status_note"] == "ปิดซ่อม"
    table.update_item.assert_called_once()


@pytest.mark.unit
def test_update_corridor_edge_status_invalid_value():
    table = MagicMock()
    repo = StatusRepository(table=table)

    with pytest.raises(InvalidStatusValue) as exc_info:
        repo.update_corridor_edge_status("EDGE_1", status="CLOSED")
    assert "Status must be one of: ACTIVE, BLOCKED." in str(exc_info.value)


@pytest.mark.unit
def test_update_corridor_edge_status_not_found():
    table = MagicMock()
    table.query.return_value = {"Items": []}
    table.scan.return_value = {"Items": []}

    repo = StatusRepository(table=table)
    with pytest.raises(CorridorEdgeNotFound) as exc_info:
        repo.update_corridor_edge_status("NON_EXISTENT", status="BLOCKED")
    assert "Corridor edge with ID NON_EXISTENT does not exist." in str(exc_info.value)


@pytest.mark.unit
def test_update_navigation_node_status_success():
    table = MagicMock()
    table.query.return_value = {
        "Items": [
            {
                "PK": "FLOOR#FL_BR2_04",
                "SK": "NAV_NODE#NODE_ELEV_04",
                "id": "NODE_ELEV_04",
            }
        ]
    }

    repo = StatusRepository(table=table)
    result = repo.update_navigation_node_status(
        node_id="NODE_ELEV_04",
        status="BLOCKED",
        status_note="ลิฟต์เสีย",
        updated_by="staff-123",
    )

    assert result["node_id"] == "NODE_ELEV_04"
    assert result["status"] == "BLOCKED"
    assert result["status_note"] == "ลิฟต์เสีย"
    table.update_item.assert_called_once()


@pytest.mark.unit
def test_update_navigation_node_status_invalid_value():
    table = MagicMock()
    repo = StatusRepository(table=table)

    with pytest.raises(InvalidStatusValue) as exc_info:
        repo.update_navigation_node_status("NODE_1", status="MAINTENANCE")
    assert "Status must be one of: ACTIVE, BLOCKED." in str(exc_info.value)


@pytest.mark.unit
def test_update_navigation_node_status_not_found():
    table = MagicMock()
    table.query.return_value = {"Items": []}
    table.scan.return_value = {"Items": []}

    repo = StatusRepository(table=table)
    with pytest.raises(NavigationNodeNotFound) as exc_info:
        repo.update_navigation_node_status("NON_EXISTENT", status="BLOCKED")
    assert "Navigation node with ID NON_EXISTENT does not exist." in str(exc_info.value)

