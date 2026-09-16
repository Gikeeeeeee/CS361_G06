"""
Unit tests for GET /api/v1/floors/{floorId}.

Every 200 body is validated against docs/contract/floor.json rather than
field-by-field. The schema is `additionalProperties: false` all the way down,
so it is what catches a stored field (room amenities, image_key, description)
leaking through into the response.
"""

import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

import handler
from errors import FloorNotFound
from handler import Dependencies, lambda_handler
from services.floor_service import FloorService

ROUTE = "GET /api/v1/floors/{floorId}"

_CONTRACT = (
    Path(__file__).resolve().parents[4] / "docs" / "contract" / "floor.json"
)


@pytest.fixture(scope="module")
def floor_contract() -> Draft202012Validator:
    schema = json.loads(_CONTRACT.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)

    return Draft202012Validator(schema)


def _event(route_key, **params):
    return {
        "routeKey": route_key,
        "pathParameters": params,
        "requestContext": {"http": {"method": "GET"}},
    }


def _call(monkeypatch, source, **params):
    """Invoke the real route with the fake source wired into the handler."""
    monkeypatch.setattr(handler, "DEPS", Dependencies(source))

    result = lambda_handler(_event(ROUTE, **params), None)

    return result["statusCode"], json.loads(result["body"])


# ---------------------------------------------------------------------------
# 200
# ---------------------------------------------------------------------------


def test_get_floor_matches_contract(monkeypatch, campus_source, floor_contract):
    status, body = _call(monkeypatch, campus_source, floorId="floor-uuid-1")

    assert status == 200
    floor_contract.validate(body)

    assert body["id"] == "floor-uuid-1"
    assert body["floor_number"] == 1
    assert body["floor_plan"]["url"].startswith(
        "https://mock-bucket.s3.amazonaws.com/floor-plan/LC3/floor1.svg"
    )


def test_get_floor_in_second_building_scanned(
    monkeypatch, campus_source, floor_contract
):
    """
    The LC4 floor is only reachable by looking past LC3, which does not hold
    it -- so a lookup that stopped at the first building would 404 here.
    """
    status, body = _call(monkeypatch, campus_source, floorId="lc4-floor-uuid-2")

    assert status == 200
    floor_contract.validate(body)

    assert body["id"] == "lc4-floor-uuid-2"
    assert body["floor_number"] == 2
    assert body["rooms"][0]["id"] == "lc4-room-uuid-1"


def test_floor_plan_url_comes_from_floor_plan_key(campus_source):
    """The stored key is used directly; no name is reconstructed from the building."""
    details = FloorService(campus_source).get_details("lc4-floor-uuid-2")

    assert details["floor_plan"] == {
        "type": "svg",
        "url": (
            "https://mock-bucket.s3.amazonaws.com/"
            "floor-plan/LC4/LC4-floor2-neutral.svg?expires=3600"
        ),
    }


# ---------------------------------------------------------------------------
# 404 / 400
# ---------------------------------------------------------------------------


def test_unknown_floor_uuid_is_404(monkeypatch, campus_source):
    status, body = _call(monkeypatch, campus_source, floorId="no-such-uuid")

    assert status == 404
    assert body["error"]["code"] == "FLOOR_NOT_FOUND"
    assert body["error"]["message"] == "Floor 'no-such-uuid' not found"


def test_floor_number_is_no_longer_accepted(monkeypatch, campus_source):
    """
    `{floorId}` is the uuid only. A floor number is ambiguous now that the
    building is out of the path, so "1" resolves to nothing.
    """
    status, body = _call(monkeypatch, campus_source, floorId="1")

    assert status == 404
    assert body["error"]["code"] == "FLOOR_NOT_FOUND"


def test_missing_floor_id_is_400(monkeypatch, campus_source):
    status, body = _call(monkeypatch, campus_source)

    assert status == 400
    assert body["error"]["code"] == "MISSING_PARAMETER"
    assert "floorId" in body["error"]["message"]


def test_service_raises_floor_not_found_without_a_building(campus_source):
    with pytest.raises(FloorNotFound) as exc_info:
        FloorService(campus_source).get_details("no-such-uuid")

    assert exc_info.value.building_id is None
