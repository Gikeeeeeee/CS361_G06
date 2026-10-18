"""Bookmark routes: any signed-in user (not only STAFF), scoped to the JWT `sub`."""
import json
import time

import jwt
import pytest

import auth
import handler
from tests.conftest import make_apigw_event

SECRET = "test-secret"
USER = "a1b2c3d4-e5f6-7890-1234-56789abcdef0"


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    monkeypatch.setattr(auth, "SUPABASE_JWT_SECRET", SECRET)


@pytest.fixture(autouse=True)
def _deps(monkeypatch, fake_bookmark_source):
    monkeypatch.setattr(handler, "DEPS", handler.Dependencies(bookmark_source=fake_bookmark_source))


def _token(role="STUDENT", sub=USER):
    claims = {"sub": sub, "aud": "authenticated", "exp": int(time.time()) + 60,
              "user_metadata": {"role": role}}
    return jwt.encode(claims, SECRET, algorithm="HS256")


def _call(method, route_key, path, token=None, body=None, path_parameters=None):
    headers = {"authorization": f"Bearer {token}"} if token else {}
    event = make_apigw_event(method=method, path=path, route_key=route_key, headers=headers,
                             body=body, path_parameters=path_parameters)
    result = handler.lambda_handler(event, None)
    return result["statusCode"], json.loads(result["body"])


def _post(body, token=None):
    return _call("POST", "POST /api/v1/bookmarks", "/api/v1/bookmarks", token or _token(), body)


def _delete(entity_id, token=None):
    return _call("DELETE", "DELETE /api/v1/bookmarks/{entityId}", f"/api/v1/bookmarks/{entity_id}",
                 token or _token(), path_parameters={"entityId": entity_id})


def _get(token=None):
    return _call("GET", "GET /api/v1/bookmarks", "/api/v1/bookmarks", token or _token())


@pytest.mark.unit
@pytest.mark.handler
def test_student_can_post_list_and_delete():
    status, body = _post({"entity_id": "SCH-9988", "entity_type": "SCHEDULE"})
    assert status == 201
    assert body == {"success": True, "data": {
        "id": "bm-1", "user_id": USER, "entity_id": "SCH-9988",
        "entity_type": "SCHEDULE", "saved_at": "2026-10-14T10:30:00Z",
    }}

    status, body = _get()
    assert status == 200
    assert [b["entity_id"] for b in body["data"]] == ["SCH-9988"]

    status, body = _delete("SCH-9988")
    assert status == 200
    assert body == {"success": True, "message": "Bookmark removed successfully."}
    assert _get()[1]["data"] == []


@pytest.mark.unit
@pytest.mark.handler
def test_duplicate_post_is_409():
    _post({"entity_id": "SCH-1", "entity_type": "SCHEDULE"})
    status, body = _post({"entity_id": "SCH-1", "entity_type": "SCHEDULE"})
    assert status == 409
    assert body == {"success": False, "error": {
        "code": "ALREADY_BOOKMARKED", "message": "This item is already saved.",
    }}


@pytest.mark.unit
@pytest.mark.handler
def test_room_bookmark_is_201():
    status, body = _post({"entity_id": "ROOM-204", "entity_type": "ROOM"})
    assert status == 201
    assert body["data"]["entity_type"] == "ROOM"
    assert body["data"]["entity_id"] == "ROOM-204"


@pytest.mark.unit
@pytest.mark.handler
def test_invalid_entity_type_is_400():
    status, body = _post({"entity_id": "ROOM-204", "entity_type": "INVALID"})
    assert status == 400
    assert body["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.unit
@pytest.mark.handler
def test_delete_unknown_is_404():
    status, body = _delete("SCH-404")
    assert status == 404
    assert body == {
        "success": False,
        "error": {
            "code": "NOT_FOUND",
            "message": "Bookmark not found.",
        },
    }


@pytest.mark.unit
@pytest.mark.handler
def test_users_only_see_their_own():
    _post({"entity_id": "SCH-1", "entity_type": "SCHEDULE"}, _token(sub="other"))
    assert _get()[1]["data"] == []
    assert _delete("SCH-1")[0] == 404


@pytest.mark.unit
@pytest.mark.handler
@pytest.mark.parametrize("method, route_key, path", [
    ("GET", "GET /api/v1/bookmarks", "/api/v1/bookmarks"),
    ("POST", "POST /api/v1/bookmarks", "/api/v1/bookmarks"),
    ("DELETE", "DELETE /api/v1/bookmarks/{entityId}", "/api/v1/bookmarks/SCH-1"),
])
def test_missing_token_is_401(method, route_key, path):
    status, body = _call(method, route_key, path, body={"entity_id": "SCH-1"},
                         path_parameters={"entityId": "SCH-1"})
    assert status == 401
    assert body["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.unit
@pytest.mark.handler
def test_bookmark_path_cannot_unlock_staff_route():
    """A STAFF routeKey still needs STAFF even if the path looks like a bookmark."""
    status, _ = _call("DELETE", "DELETE /api/v1/rooms/{roomId}/schedules/{scheduleId}",
                      "/api/v1/bookmarks/x", _token(),
                      path_parameters={"roomId": "r", "scheduleId": "s"})
    assert status == 403
