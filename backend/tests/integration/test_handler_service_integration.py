"""
Integration test: Verifies that the Composition Root (Dependencies),
Handler, Services, and Port contract wire together seamlessly.

This test does NOT touch S3 or DynamoDB -- it tests the hexagonal composition
across layers so that storage migrations do not require rewriting integration suites.
"""

import json
import pytest

from handler import Dependencies, lambda_handler, ROUTES
from tests.conftest import FakeBuildingSource, make_apigw_event


@pytest.mark.integration
def test_all_routes_registered_and_routable(campus_source: FakeBuildingSource):
    """
    Ensure every registered route in ROUTES can be resolved and invoked
    through the composition root without unhandled exceptions.
    """
    import handler

    original_deps = handler.DEPS
    handler.DEPS = Dependencies(campus_source)

    try:
        # 1. GET /api/v1/buildings
        event_buildings = make_apigw_event("GET", "/api/v1/buildings", "GET /api/v1/buildings")
        res1 = lambda_handler(event_buildings, None)
        assert res1["statusCode"] == 200
        body1 = json.loads(res1["body"])
        assert "buildings" in body1

        # 2. GET /api/v1/buildings/{buildingId}
        event_building = make_apigw_event(
            "GET",
            "/api/v1/buildings/LC3",
            "GET /api/v1/buildings/{buildingId}",
            {"buildingId": "LC3"},
        )
        res2 = lambda_handler(event_building, None)
        assert res2["statusCode"] == 200
        body2 = json.loads(res2["body"])
        assert body2["code"] == "LC3"

        # 3. GET /api/v1/floors/{floorId}
        event_floor = make_apigw_event(
            "GET",
            "/api/v1/floors/floor-uuid-1",
            "GET /api/v1/floors/{floorId}",
            {"floorId": "floor-uuid-1"},
        )
        res3 = lambda_handler(event_floor, None)
        assert res3["statusCode"] == 200
        body3 = json.loads(res3["body"])
        assert body3["id"] == "floor-uuid-1"

        # 4. GET /api/v1/rooms/{roomId}
        event_room = make_apigw_event(
            "GET",
            "/api/v1/rooms/room-uuid-1",
            "GET /api/v1/rooms/{roomId}",
            {"roomId": "room-uuid-1"},
        )
        res4 = lambda_handler(event_room, None)
        assert res4["statusCode"] == 200
        body4 = json.loads(res4["body"])
        assert body4["id"] == "room-uuid-1"

        # 5. GET /api/v1/facilities/{facilityId}
        event_facility = make_apigw_event(
            "GET",
            "/api/v1/facilities/facility-uuid-1",
            "GET /api/v1/facilities/{facilityId}",
            {"facilityId": "facility-uuid-1"},
        )
        res5 = lambda_handler(event_facility, None)
        assert res5["statusCode"] == 200
        body5 = json.loads(res5["body"])
        assert body5["id"] == "facility-uuid-1"

    finally:
        handler.DEPS = original_deps


@pytest.mark.integration
def test_integration_error_propagation_format(campus_source: FakeBuildingSource):
    """
    Ensure typed domain errors raised from deep in services properly bubble up
    and format into the standard API error contract { error: { code, message } }.
    """
    import handler

    original_deps = handler.DEPS
    handler.DEPS = Dependencies(campus_source)

    try:
        event = make_apigw_event(
            "GET",
            "/api/v1/buildings/UNKNOWN",
            "GET /api/v1/buildings/{buildingId}",
            {"buildingId": "UNKNOWN"},
        )
        res = lambda_handler(event, None)
        assert res["statusCode"] == 404
        body = json.loads(res["body"])
        assert body == {
            "error": {
                "code": "BUILDING_NOT_FOUND",
                "message": "Building 'UNKNOWN' not found",
            }
        }
    finally:
        handler.DEPS = original_deps
