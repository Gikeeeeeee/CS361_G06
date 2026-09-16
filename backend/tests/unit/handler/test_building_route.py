import json
import pytest

from tests.conftest import make_apigw_event

ROUTE_KEY = "GET /api/v1/buildings/{buildingId}"


@pytest.mark.unit
@pytest.mark.handler
def test_get_building_success(invoke_handler):
    event = make_apigw_event(
        method="GET",
        path="/api/v1/buildings/LC3",
        route_key=ROUTE_KEY,
        path_parameters={"buildingId": "LC3"},
    )

    result = invoke_handler(event)

    assert result["statusCode"] == 200
    body = json.loads(result["body"])
    assert body["id"] == "lc3"
    assert body["code"] == "LC3"
    assert "floors" in body
    assert isinstance(body["floors"], list)


@pytest.mark.unit
@pytest.mark.handler
def test_get_building_case_insensitive(invoke_handler):
    event = make_apigw_event(
        method="GET",
        path="/api/v1/buildings/lc3",
        route_key=ROUTE_KEY,
        path_parameters={"buildingId": "lc3"},
    )

    result = invoke_handler(event)

    assert result["statusCode"] == 200
    body = json.loads(result["body"])
    assert body["id"] == "lc3"


@pytest.mark.unit
@pytest.mark.handler
def test_get_building_not_found(invoke_handler):
    event = make_apigw_event(
        method="GET",
        path="/api/v1/buildings/NONEXISTENT",
        route_key=ROUTE_KEY,
        path_parameters={"buildingId": "NONEXISTENT"},
    )

    result = invoke_handler(event)

    assert result["statusCode"] == 404
    body = json.loads(result["body"])
    assert "error" in body
    assert body["error"]["code"] == "BUILDING_NOT_FOUND"


@pytest.mark.unit
@pytest.mark.handler
def test_get_building_missing_param(invoke_handler):
    event = make_apigw_event(
        method="GET",
        path="/api/v1/buildings/",
        route_key=ROUTE_KEY,
        path_parameters={"buildingId": ""},
    )

    result = invoke_handler(event)

    assert result["statusCode"] == 400
    body = json.loads(result["body"])
    assert "error" in body
    assert body["error"]["code"] == "MISSING_PARAMETER"
