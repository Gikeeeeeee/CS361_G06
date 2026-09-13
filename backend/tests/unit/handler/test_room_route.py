import json
import pytest

from tests.conftest import make_apigw_event

ROUTE_KEY = "GET /api/v1/rooms/{roomId}"


@pytest.mark.unit
@pytest.mark.handler
def test_get_room_by_id_success(invoke_handler):
    event = make_apigw_event(
        method="GET",
        path="/api/v1/rooms/room-uuid-1",
        route_key=ROUTE_KEY,
        path_parameters={"roomId": "room-uuid-1"},
    )

    result = invoke_handler(event)

    assert result["statusCode"] == 200
    body = json.loads(result["body"])
    assert body["id"] == "room-uuid-1"
    assert body["room_number"] == "101"
    assert body["type"] == "CLASSROOM"
    assert body["building"]["code"] == "LC3"
    assert body["floor"]["floor_number"] == 1
    assert "facilities" in body


@pytest.mark.unit
@pytest.mark.handler
def test_get_room_by_room_number_success(invoke_handler):
    event = make_apigw_event(
        method="GET",
        path="/api/v1/rooms/101",
        route_key=ROUTE_KEY,
        path_parameters={"roomId": "101"},
    )

    result = invoke_handler(event)

    assert result["statusCode"] == 200
    body = json.loads(result["body"])
    assert body["id"] == "room-uuid-1"


@pytest.mark.unit
@pytest.mark.handler
def test_get_room_in_second_building(invoke_handler):
    event = make_apigw_event(
        method="GET",
        path="/api/v1/rooms/201",
        route_key=ROUTE_KEY,
        path_parameters={"roomId": "201"},
    )

    result = invoke_handler(event)

    assert result["statusCode"] == 200
    body = json.loads(result["body"])
    assert body["id"] == "lc4-room-uuid-1"
    assert body["building"]["code"] == "LC4"


@pytest.mark.unit
@pytest.mark.handler
def test_get_room_not_found(invoke_handler):
    event = make_apigw_event(
        method="GET",
        path="/api/v1/rooms/nonexistent-room",
        route_key=ROUTE_KEY,
        path_parameters={"roomId": "nonexistent-room"},
    )

    result = invoke_handler(event)

    assert result["statusCode"] == 404
    body = json.loads(result["body"])
    assert "error" in body
    assert body["error"]["code"] == "ROOM_NOT_FOUND"


@pytest.mark.unit
@pytest.mark.handler
def test_get_room_missing_param(invoke_handler):
    event = make_apigw_event(
        method="GET",
        path="/api/v1/rooms/",
        route_key=ROUTE_KEY,
        path_parameters={"roomId": ""},
    )

    result = invoke_handler(event)

    assert result["statusCode"] == 400
    body = json.loads(result["body"])
    assert "error" in body
    assert body["error"]["code"] == "MISSING_PARAMETER"
