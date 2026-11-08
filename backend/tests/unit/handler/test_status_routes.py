"""Unit tests for Dynamic Status APIs (V4-US2)."""

import json
import time
from typing import Any

import jwt
import pytest

import auth
from errors import (
    CorridorEdgeNotFound,
    FloorNotFound,
    InvalidStatusValue,
    NavigationNodeNotFound,
    RoomNotFound,
)
import handler
from tests.conftest import make_apigw_event

SECRET = "test-status-secret"
USER_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6"


class FakeStatusRepository:
    def __init__(self):
        self.floors = {"FL_BR2_04"}
        self.rooms = {
            "RM_BR2_401": {
                "room_id": "RM_BR2_401",
                "room_code": "BR2-401",
                "status": "CLOSED",
                "status_note": "แอร์เสีย ย้ายไปเรียนห้อง BR2-405",
            },
            "RM_BR2_402": {
                "room_id": "RM_BR2_402",
                "room_code": "BR2-402",
                "status": "ACTIVE",
                "status_note": None,
            },
        }
        self.edges = {
            "EDGE_CORR_N4": {
                "edge_id": "EDGE_CORR_N4",
                "status": "BLOCKED",
                "status_note": "ปิดปรับปรุงพื้นทางเดินช่วง 13:00 - 17:00",
            }
        }
        self.nodes = {
            "NODE_ELEV_04": {
                "node_id": "NODE_ELEV_04",
                "status": "ACTIVE",
                "status_note": None,
            }
        }

    def get_floor_status_overlay(self, floor_id: str) -> dict[str, Any]:
        if floor_id not in self.floors:
            raise FloorNotFound(
                floor_id, message=f"Floor with ID {floor_id} does not exist."
            )
        return {
            "floor_id": floor_id,
            "updated_at": "2026-10-27T15:30:00Z",
            "rooms": list(self.rooms.values()),
            "corridor_edges": list(self.edges.values()),
            "navigation_nodes": list(self.nodes.values()),
        }

    def update_room_status(
        self,
        room_id: str,
        status: str,
        status_note: str | None = None,
        updated_by: str | None = None,
    ) -> dict[str, Any]:
        clean_status = (status or "").upper()
        if clean_status not in {"ACTIVE", "CLOSED", "MAINTENANCE"}:
            raise InvalidStatusValue(
                "Status must be one of: ACTIVE, CLOSED, MAINTENANCE."
            )
        if room_id not in self.rooms:
            raise RoomNotFound(
                room_id, message=f"Room with ID {room_id} does not exist."
            )
        self.rooms[room_id]["status"] = clean_status
        self.rooms[room_id]["status_note"] = status_note
        return {
            "room_id": room_id,
            "room_code": self.rooms[room_id]["room_code"],
            "status": clean_status,
            "status_note": status_note,
            "updated_by": updated_by or USER_ID,
            "updated_at": "2026-10-27T15:45:00Z",
        }

    def update_corridor_edge_status(
        self,
        edge_id: str,
        status: str,
        status_note: str | None = None,
        updated_by: str | None = None,
    ) -> dict[str, Any]:
        clean_status = (status or "").upper()
        if clean_status not in {"ACTIVE", "BLOCKED"}:
            raise InvalidStatusValue("Status must be one of: ACTIVE, BLOCKED.")
        if edge_id not in self.edges:
            raise CorridorEdgeNotFound(edge_id)
        self.edges[edge_id]["status"] = clean_status
        self.edges[edge_id]["status_note"] = status_note
        return {
            "edge_id": edge_id,
            "status": clean_status,
            "status_note": status_note,
            "updated_by": updated_by or USER_ID,
            "updated_at": "2026-10-27T15:46:12Z",
        }

    def update_navigation_node_status(
        self,
        node_id: str,
        status: str,
        status_note: str | None = None,
        updated_by: str | None = None,
    ) -> dict[str, Any]:
        clean_status = (status or "").upper()
        if clean_status not in {"ACTIVE", "BLOCKED"}:
            raise InvalidStatusValue("Status must be one of: ACTIVE, BLOCKED.")
        if node_id not in self.nodes:
            raise NavigationNodeNotFound(node_id)
        self.nodes[node_id]["status"] = clean_status
        self.nodes[node_id]["status_note"] = status_note
        return {
            "node_id": node_id,
            "status": clean_status,
            "status_note": status_note,
            "updated_by": updated_by or USER_ID,
            "updated_at": "2026-10-27T15:47:00Z",
        }


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    monkeypatch.setattr(auth, "SUPABASE_JWT_SECRET", SECRET)


@pytest.fixture
def fake_repo():
    return FakeStatusRepository()


@pytest.fixture(autouse=True)
def _deps(monkeypatch, fake_repo):
    from services.status_service import StatusService

    deps = handler.Dependencies()
    deps.status = StatusService(fake_repo)
    monkeypatch.setattr(handler, "DEPS", deps)


def _token(role="STAFF", sub=USER_ID):
    claims = {
        "sub": sub,
        "aud": "authenticated",
        "exp": int(time.time()) + 120,
        "user_metadata": {"role": role},
    }
    return jwt.encode(claims, SECRET, algorithm="HS256")


def _call(method, route_key, path, token=None, body=None, path_params=None):
    headers = {"authorization": f"Bearer {token}"} if token else {}
    event = make_apigw_event(
        method=method,
        path=path,
        route_key=route_key,
        headers=headers,
        body=body,
        path_parameters=path_params,
    )
    res = handler.lambda_handler(event, None)
    return res["statusCode"], json.loads(res["body"])


# ---------------------------------------------------------------------------
# 1. GET /api/v1/floors/{floor_id}/status-overlay
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.handler
def test_get_floor_status_overlay_success():
    status, body = _call(
        "GET",
        "GET /api/v1/floors/{floor_id}/status-overlay",
        "/api/v1/floors/FL_BR2_04/status-overlay",
        path_params={"floor_id": "FL_BR2_04"},
    )
    assert status == 200
    assert body["success"] is True
    data = body["data"]
    assert data["floor_id"] == "FL_BR2_04"
    assert "updated_at" in data
    assert len(data["rooms"]) == 2
    assert len(data["corridor_edges"]) == 1
    assert len(data["navigation_nodes"]) == 1
    assert data["corridor_edges"][0]["status"] == "BLOCKED"


@pytest.mark.unit
@pytest.mark.handler
def test_get_floor_status_overlay_not_found():
    status, body = _call(
        "GET",
        "GET /api/v1/floors/{floor_id}/status-overlay",
        "/api/v1/floors/NON_EXISTENT_FLOOR/status-overlay",
        path_params={"floor_id": "NON_EXISTENT_FLOOR"},
    )
    assert status == 404
    assert body["success"] is False
    assert body["error"]["code"] == "FLOOR_NOT_FOUND"
    assert (
        body["error"]["message"] == "Floor with ID NON_EXISTENT_FLOOR does not exist."
    )


# ---------------------------------------------------------------------------
# 2. PATCH /api/v1/locations/rooms/{room_id}/status
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.handler
def test_patch_room_status_staff_success():
    status, body = _call(
        "PATCH",
        "PATCH /api/v1/locations/rooms/{room_id}/status",
        "/api/v1/locations/rooms/RM_BR2_401/status",
        token=_token(role="STAFF"),
        body={"status": "CLOSED", "status_note": "แอร์เสีย ย้ายไปเรียนห้อง BR2-405"},
        path_params={"room_id": "RM_BR2_401"},
    )
    assert status == 200
    assert body["success"] is True
    assert body["data"]["room_id"] == "RM_BR2_401"
    assert body["data"]["room_code"] == "BR2-401"
    assert body["data"]["status"] == "CLOSED"
    assert body["data"]["status_note"] == "แอร์เสีย ย้ายไปเรียนห้อง BR2-405"
    assert body["data"]["updated_by"] == USER_ID


@pytest.mark.unit
@pytest.mark.handler
def test_patch_room_status_admin_success():
    status, body = _call(
        "PATCH",
        "PATCH /api/v1/locations/rooms/{room_id}/status",
        "/api/v1/locations/rooms/RM_BR2_402/status",
        token=_token(role="ADMIN"),
        body={"status": "MAINTENANCE", "status_note": "ทาสีใหม่"},
        path_params={"room_id": "RM_BR2_402"},
    )
    assert status == 200
    assert body["success"] is True
    assert body["data"]["status"] == "MAINTENANCE"


@pytest.mark.unit
@pytest.mark.handler
def test_patch_room_status_unauthorized_missing_token():
    status, body = _call(
        "PATCH",
        "PATCH /api/v1/locations/rooms/{room_id}/status",
        "/api/v1/locations/rooms/RM_BR2_401/status",
        token=None,
        body={"status": "CLOSED"},
        path_params={"room_id": "RM_BR2_401"},
    )
    assert status == 401
    assert body["success"] is False
    assert body["error"]["code"] == "UNAUTHORIZED"
    assert body["error"]["message"] == "Missing or invalid authentication token."


@pytest.mark.unit
@pytest.mark.handler
def test_patch_room_status_forbidden_student():
    status, body = _call(
        "PATCH",
        "PATCH /api/v1/locations/rooms/{room_id}/status",
        "/api/v1/locations/rooms/RM_BR2_401/status",
        token=_token(role="STUDENT"),
        body={"status": "CLOSED"},
        path_params={"room_id": "RM_BR2_401"},
    )
    assert status == 403
    assert body["success"] is False
    assert body["error"]["code"] == "FORBIDDEN"
    assert (
        body["error"]["message"] == "You do not have permission to update room status."
    )


@pytest.mark.unit
@pytest.mark.handler
def test_patch_room_status_invalid_value():
    status, body = _call(
        "PATCH",
        "PATCH /api/v1/locations/rooms/{room_id}/status",
        "/api/v1/locations/rooms/RM_BR2_401/status",
        token=_token(role="STAFF"),
        body={"status": "BLOCKED"},
        path_params={"room_id": "RM_BR2_401"},
    )
    assert status == 400
    assert body["success"] is False
    assert body["error"]["code"] == "INVALID_STATUS_VALUE"
    assert (
        body["error"]["message"]
        == "Status must be one of: ACTIVE, CLOSED, MAINTENANCE."
    )


@pytest.mark.unit
@pytest.mark.handler
def test_patch_room_status_not_found():
    status, body = _call(
        "PATCH",
        "PATCH /api/v1/locations/rooms/{room_id}/status",
        "/api/v1/locations/rooms/NON_EXISTENT/status",
        token=_token(role="STAFF"),
        body={"status": "CLOSED"},
        path_params={"room_id": "NON_EXISTENT"},
    )
    assert status == 404
    assert body["success"] is False
    assert body["error"]["code"] == "ROOM_NOT_FOUND"
    assert body["error"]["message"] == "Room with ID NON_EXISTENT does not exist."


# ---------------------------------------------------------------------------
# 3. PATCH /api/v1/routes/corridor-edges/{edge_id}/status
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.handler
def test_patch_corridor_edge_status_success():
    status, body = _call(
        "PATCH",
        "PATCH /api/v1/routes/corridor-edges/{edge_id}/status",
        "/api/v1/routes/corridor-edges/EDGE_CORR_N4/status",
        token=_token(role="STAFF"),
        body={"status": "BLOCKED", "status_note": "ปิดปรับปรุงพื้นทางเดิน"},
        path_params={"edge_id": "EDGE_CORR_N4"},
    )
    assert status == 200
    assert body["success"] is True
    assert body["data"]["edge_id"] == "EDGE_CORR_N4"
    assert body["data"]["status"] == "BLOCKED"
    assert body["data"]["status_note"] == "ปิดปรับปรุงพื้นทางเดิน"


@pytest.mark.unit
@pytest.mark.handler
def test_patch_corridor_edge_status_forbidden():
    status, body = _call(
        "PATCH",
        "PATCH /api/v1/routes/corridor-edges/{edge_id}/status",
        "/api/v1/routes/corridor-edges/EDGE_CORR_N4/status",
        token=_token(role="STUDENT"),
        body={"status": "BLOCKED"},
        path_params={"edge_id": "EDGE_CORR_N4"},
    )
    assert status == 403
    assert body["success"] is False
    assert body["error"]["code"] == "FORBIDDEN"
    assert (
        body["error"]["message"]
        == "You do not have permission to update corridor edge status."
    )


@pytest.mark.unit
@pytest.mark.handler
def test_patch_corridor_edge_invalid_value():
    status, body = _call(
        "PATCH",
        "PATCH /api/v1/routes/corridor-edges/{edge_id}/status",
        "/api/v1/routes/corridor-edges/EDGE_CORR_N4/status",
        token=_token(role="STAFF"),
        body={"status": "CLOSED"},
        path_params={"edge_id": "EDGE_CORR_N4"},
    )
    assert status == 400
    assert body["success"] is False
    assert body["error"]["code"] == "INVALID_STATUS_VALUE"
    assert body["error"]["message"] == "Status must be one of: ACTIVE, BLOCKED."


@pytest.mark.unit
@pytest.mark.handler
def test_patch_corridor_edge_not_found():
    status, body = _call(
        "PATCH",
        "PATCH /api/v1/routes/corridor-edges/{edge_id}/status",
        "/api/v1/routes/corridor-edges/NON_EXISTENT_EDGE/status",
        token=_token(role="STAFF"),
        body={"status": "BLOCKED"},
        path_params={"edge_id": "NON_EXISTENT_EDGE"},
    )
    assert status == 404
    assert body["success"] is False
    assert body["error"]["code"] == "EDGE_NOT_FOUND"
    assert (
        body["error"]["message"]
        == "Corridor edge with ID NON_EXISTENT_EDGE does not exist."
    )


# ---------------------------------------------------------------------------
# 4. PATCH /api/v1/routes/navigation-nodes/{node_id}/status
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.handler
def test_patch_navigation_node_status_success():
    status, body = _call(
        "PATCH",
        "PATCH /api/v1/routes/navigation-nodes/{node_id}/status",
        "/api/v1/routes/navigation-nodes/NODE_ELEV_04/status",
        token=_token(role="STAFF"),
        body={"status": "BLOCKED", "status_note": "ลิฟต์ขัดข้องกำลังรอช่าง"},
        path_params={"node_id": "NODE_ELEV_04"},
    )
    assert status == 200
    assert body["success"] is True
    assert body["data"]["node_id"] == "NODE_ELEV_04"
    assert body["data"]["status"] == "BLOCKED"
    assert body["data"]["status_note"] == "ลิฟต์ขัดข้องกำลังรอช่าง"


@pytest.mark.unit
@pytest.mark.handler
def test_patch_navigation_node_forbidden():
    status, body = _call(
        "PATCH",
        "PATCH /api/v1/routes/navigation-nodes/{node_id}/status",
        "/api/v1/routes/navigation-nodes/NODE_ELEV_04/status",
        token=_token(role="STUDENT"),
        body={"status": "BLOCKED"},
        path_params={"node_id": "NODE_ELEV_04"},
    )
    assert status == 403
    assert body["success"] is False
    assert body["error"]["code"] == "FORBIDDEN"
    assert (
        body["error"]["message"]
        == "You do not have permission to update navigation node status."
    )


@pytest.mark.unit
@pytest.mark.handler
def test_patch_navigation_node_invalid_value():
    status, body = _call(
        "PATCH",
        "PATCH /api/v1/routes/navigation-nodes/{node_id}/status",
        "/api/v1/routes/navigation-nodes/NODE_ELEV_04/status",
        token=_token(role="STAFF"),
        body={"status": "BROKEN"},
        path_params={"node_id": "NODE_ELEV_04"},
    )
    assert status == 400
    assert body["success"] is False
    assert body["error"]["code"] == "INVALID_STATUS_VALUE"
    assert body["error"]["message"] == "Status must be one of: ACTIVE, BLOCKED."


@pytest.mark.unit
@pytest.mark.handler
def test_patch_navigation_node_not_found():
    status, body = _call(
        "PATCH",
        "PATCH /api/v1/routes/navigation-nodes/{node_id}/status",
        "/api/v1/routes/navigation-nodes/NON_EXISTENT_NODE/status",
        token=_token(role="STAFF"),
        body={"status": "BLOCKED"},
        path_params={"node_id": "NON_EXISTENT_NODE"},
    )
    assert status == 404
    assert body["success"] is False
    assert body["error"]["code"] == "NODE_NOT_FOUND"
    assert (
        body["error"]["message"]
        == "Navigation node with ID NON_EXISTENT_NODE does not exist."
    )
