import json
import pytest

from tests.conftest import make_apigw_event

ROUTE_KEY = "GET /api/v1/floors/{floorId}"


@pytest.mark.unit
@pytest.mark.handler
def test_get_floor_success(invoke_handler):
    event = make_apigw_event(
        method="GET",
        path="/api/v1/floors/floor-uuid-1",
        route_key=ROUTE_KEY,
        path_parameters={"floorId": "floor-uuid-1"},
    )

    result = invoke_handler(event)

    assert result["statusCode"] == 200
    body = json.loads(result["body"])
    assert body["id"] == "floor-uuid-1"
    assert body["floor_number"] == 1
    assert "floor_plan" in body
    assert "rooms" in body
    assert "facilities" in body
    assert isinstance(body["rooms"], list)
    assert isinstance(body["facilities"], list)


@pytest.mark.unit
@pytest.mark.handler
def test_get_floor_scans_to_second_building(invoke_handler):
    event = make_apigw_event(
        method="GET",
        path="/api/v1/floors/lc4-floor-uuid-2",
        route_key=ROUTE_KEY,
        path_parameters={"floorId": "lc4-floor-uuid-2"},
    )

    result = invoke_handler(event)

    assert result["statusCode"] == 200
    body = json.loads(result["body"])
    assert body["id"] == "lc4-floor-uuid-2"
    assert body["floor_number"] == 2


@pytest.mark.unit
@pytest.mark.handler
def test_get_floor_not_found(invoke_handler):
    event = make_apigw_event(
        method="GET",
        path="/api/v1/floors/nonexistent-uuid",
        route_key=ROUTE_KEY,
        path_parameters={"floorId": "nonexistent-uuid"},
    )

    result = invoke_handler(event)

    assert result["statusCode"] == 404
    body = json.loads(result["body"])
    assert "error" in body
    assert body["error"]["code"] == "FLOOR_NOT_FOUND"


@pytest.mark.unit
@pytest.mark.handler
def test_get_floor_missing_param(invoke_handler):
    event = make_apigw_event(
        method="GET",
        path="/api/v1/floors/",
        route_key=ROUTE_KEY,
        path_parameters={"floorId": ""},
    )

    result = invoke_handler(event)

    assert result["statusCode"] == 400
    body = json.loads(result["body"])
    assert "error" in body
    assert body["error"]["code"] == "MISSING_PARAMETER"
