import json
import pytest

from tests.conftest import make_apigw_event

ROUTE_KEY = "GET /api/v1/facilities/{facilityId}"


@pytest.mark.unit
@pytest.mark.handler
def test_get_facility_success(invoke_handler):
    event = make_apigw_event(
        method="GET",
        path="/api/v1/facilities/facility-uuid-1",
        route_key=ROUTE_KEY,
        path_parameters={"facilityId": "facility-uuid-1"},
    )

    result = invoke_handler(event)

    assert result["statusCode"] == 200
    body = json.loads(result["body"])
    assert body["id"] == "facility-uuid-1"
    assert body["type"] == "TOILET"
    assert body["building"]["code"] == "LC3"
    assert body["floor"]["floor_number"] == 1


@pytest.mark.unit
@pytest.mark.handler
def test_get_facility_not_found(invoke_handler):
    event = make_apigw_event(
        method="GET",
        path="/api/v1/facilities/nonexistent-facility",
        route_key=ROUTE_KEY,
        path_parameters={"facilityId": "nonexistent-facility"},
    )

    result = invoke_handler(event)

    assert result["statusCode"] == 404
    body = json.loads(result["body"])
    assert "error" in body
    assert body["error"]["code"] == "FACILITY_NOT_FOUND"


@pytest.mark.unit
@pytest.mark.handler
def test_get_facility_missing_param(invoke_handler):
    event = make_apigw_event(
        method="GET",
        path="/api/v1/facilities/",
        route_key=ROUTE_KEY,
        path_parameters={"facilityId": ""},
    )

    result = invoke_handler(event)

    assert result["statusCode"] == 400
    body = json.loads(result["body"])
    assert "error" in body
    assert body["error"]["code"] == "MISSING_PARAMETER"
