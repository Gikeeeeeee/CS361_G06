"""
Black-box API Contract Tests against a deployed API Gateway HTTP API.

Features:
- Accepts target URL via CLI argument `--api-url <url>` or env var `API_BASE_URL`.
- Skipped automatically if no URL is provided (safe for local / PR runs).
- Supports AWS SigV4 signing via IAM Credentials (set USE_IAM_AUTH=true or provide credentials).
- Verifies HTTP response codes, CORS headers, and standard contract formats.
- Omits volatile fields (schedule/event) to avoid brittleness.
"""

import os
import uuid
from typing import Any
import boto3
from boto3.dynamodb.conditions import Key
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest
import pytest
import requests
from urllib.parse import quote

USE_IAM_AUTH = os.getenv("USE_IAM_AUTH", "false").lower() in ("true", "1", "yes")
AWS_REGION = os.getenv("AWS_DEFAULT_REGION", "us-east-1")

pytestmark = [pytest.mark.api]


def _request(
    method: str,
    path: str,
    base_url: str,
    headers: dict[str, str] | None = None,
    json_body: Any = None,
) -> requests.Response:
    url = f"{base_url}{path}"
    req_headers: dict[str, str] = {
        "Accept": "application/json",
    }
    if json_body is not None:
        req_headers["Content-Type"] = "application/json"
    if headers:
        req_headers.update(headers)

    if USE_IAM_AUTH:
        session = boto3.Session()
        creds = session.get_credentials()
        if creds:
            frozen = creds.get_frozen_credentials()
            aws_req = AWSRequest(method=method, url=url, headers=req_headers)
            SigV4Auth(frozen, "execute-api", AWS_REGION).add_auth(aws_req)
            req_headers = dict(aws_req.headers)

    return requests.request(
        method=method,
        url=url,
        headers=req_headers,
        json=json_body,
        timeout=10,
    )


def test_api_get_buildings_contract(api_base_url: str):
    """Live API contract: GET /api/v1/buildings returns 200 and list of buildings."""
    res = _request("GET", "/api/v1/buildings", api_base_url)

    assert res.status_code == 200
    data = res.json()
    assert "buildings" in data
    assert isinstance(data["buildings"], list)


def test_api_get_building_summary_contract(api_base_url: str):
    """Live API contract: GET /api/v1/buildings/LC3 returns 200 and building summary."""
    res = _request("GET", "/api/v1/buildings/LC3", api_base_url)

    assert res.status_code == 200
    data = res.json()
    assert data["id"].lower() == "lc3"
    assert "code" in data
    assert "floors" in data
    assert isinstance(data["floors"], list)


def test_api_get_building_not_found_contract(api_base_url: str):
    """Live API contract: Non-existent building returns 404 with standard error body."""
    res = _request("GET", "/api/v1/buildings/NON_EXISTENT_BUILDING_XYZ", api_base_url)

    assert res.status_code == 404
    data = res.json()
    assert "error" in data
    assert data["error"]["code"] == "BUILDING_NOT_FOUND"


def test_api_cors_preflight_contract(api_base_url: str):
    """Live API contract: OPTIONS returns 200/204 with CORS headers."""
    res = _request(
        "OPTIONS",
        "/api/v1/buildings",
        api_base_url,
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert res.status_code in (200, 204)
    assert res.headers.get("Access-Control-Allow-Origin") in ("*", "http://localhost:3000")


def test_api_route_not_found_contract(api_base_url: str):
    """Live API contract: Unknown route returns 404 ROUTE_NOT_FOUND."""
    res = _request("GET", "/api/v1/unknown-endpoint-contract-test", api_base_url)

    assert res.status_code == 404
    data = res.json()
    assert "error" in data
    assert data["error"]["code"] == "ROUTE_NOT_FOUND"


# ---------------------------------------------------------------------------
# Schedules
#
# POST writes real items. Every test below books a throwaway room id, so it can
# never collide with seeded data, and deletes what it wrote afterwards.
# ---------------------------------------------------------------------------


def _schedule(**overrides: Any) -> dict[str, Any]:
    payload = {
        "type": "ACTIVITY",
        "title": "Smoke test booking",
        "start_at": "2030-01-01T09:00:00+07:00",
        "end_at": "2030-01-01T11:00:00+07:00",
    }
    payload.update(overrides)
    return payload


@pytest.fixture
def throwaway_room(api_base_url: str):
    """A room id nothing else uses, emptied again when the test finishes."""
    room_id = f"smoke-{uuid.uuid4()}"

    yield room_id

    table_name = os.getenv("DYNAMODB_TABLE_NAME")

    if not table_name:
        return

    table = boto3.resource("dynamodb").Table(table_name)
    written = table.query(
        IndexName="GSI4",
        KeyConditionExpression=Key("GSI4PK").eq(f"ROOM#{room_id}"),
    ).get("Items", [])

    with table.batch_writer() as batch:
        for item in written:
            batch.delete_item(Key={"PK": item["PK"], "SK": item["SK"]})


def _schedules(base_url: str, room_id: str, **params: str) -> requests.Response:
    query = {
        "start": "2030-01-01T00:00:00+07:00",
        "end": "2030-12-31T00:00:00+07:00",
    }
    query.update(params)
    query_string = "&".join(f"{k}={quote(v)}" for k, v in query.items())

    return _request(
        "GET", f"/api/v1/rooms/{room_id}/schedules?{query_string}", base_url
    )


def test_api_get_schedules_contract(api_base_url: str, throwaway_room: str):
    """Live API contract: an unbooked room returns 200 and an empty list."""
    res = _schedules(api_base_url, throwaway_room)

    assert res.status_code == 200
    assert res.json() == {"schedules": []}


def test_api_get_schedules_requires_a_window(api_base_url: str, throwaway_room: str):
    """Live API contract: start/end are required."""
    res = _request("GET", f"/api/v1/rooms/{throwaway_room}/schedules", api_base_url)

    assert res.status_code == 400
    assert res.json()["error"]["code"] == "MISSING_PARAMETER"


def test_api_post_schedule_contract(api_base_url: str, throwaway_room: str):
    """Live API contract: POST creates, and the new booking is readable."""
    res = _request(
        "POST",
        f"/api/v1/rooms/{throwaway_room}/schedules",
        api_base_url,
        json_body=_schedule(),
    )

    assert res.status_code == 201
    assert res.json() == "created"

    stored = _schedules(api_base_url, throwaway_room).json()["schedules"]
    assert len(stored) == 1
    assert stored[0]["title"] == "Smoke test booking"
    assert stored[0]["room_id"] == throwaway_room
    assert stored[0]["status"] == "CONFIRM"
    # Storage keys never leak into the contract.
    assert not any(key.startswith("GSI") or key in ("PK", "SK") for key in stored[0])


def test_api_post_schedule_conflict_contract(api_base_url: str, throwaway_room: str):
    """Live API contract: a second booking on the same slot is 409."""
    path = f"/api/v1/rooms/{throwaway_room}/schedules"

    assert _request("POST", path, api_base_url, json_body=_schedule()).status_code == 201

    res = _request(
        "POST",
        path,
        api_base_url,
        json_body=_schedule(start_at="2030-01-01T10:00:00+07:00"),
    )

    assert res.status_code == 409
    assert res.json()["error"]["code"] == "SCHEDULE_CONFLICT"


def test_api_post_schedule_expands_a_recurrence_rule(
    api_base_url: str, throwaway_room: str
):
    """Live API contract: one POST with an RRULE becomes one item per week."""
    res = _request(
        "POST",
        f"/api/v1/rooms/{throwaway_room}/schedules",
        api_base_url,
        json_body=_schedule(recurrence_rule="FREQ=WEEKLY;BYDAY=TU;COUNT=15"),
    )

    assert res.status_code == 201
    assert len(_schedules(api_base_url, throwaway_room).json()["schedules"]) == 15


@pytest.mark.parametrize(
    "payload, code",
    [
        ({"type": "ACTIVITY"}, "MISSING_PARAMETER"),
        (_schedule(type="PARTY"), "VALIDATION_ERROR"),
        (_schedule(start_at="2030-01-01T23:00:00+07:00"), "VALIDATION_ERROR"),
        (_schedule(recurrence_rule="FREQ=WEEKLY;BYDAY=TU"), "VALIDATION_ERROR"),
    ],
)
def test_api_post_schedule_rejects_a_bad_payload(
    api_base_url: str, throwaway_room: str, payload: dict[str, Any], code: str
):
    res = _request(
        "POST",
        f"/api/v1/rooms/{throwaway_room}/schedules",
        api_base_url,
        json_body=payload,
    )

    assert res.status_code == 400
    assert res.json()["error"]["code"] == code
