import json
import pytest

import handler
from tests.conftest import make_apigw_event


@pytest.fixture
def invoke_nav_handler(sample_navigation_source):
    """Invokes lambda_handler with Dependencies wired to sample_navigation_source."""

    def _invoke(event):
        original_deps = handler.DEPS
        deps = handler.Dependencies(navigation_source=sample_navigation_source)
        handler.DEPS = deps
        try:
            return handler.lambda_handler(event, None)
        finally:
            handler.DEPS = original_deps

    return _invoke


@pytest.mark.unit
@pytest.mark.handler
def test_post_routes_search_success(invoke_nav_handler):
    event = make_apigw_event(
        method="POST",
        path="/api/v1/routes/search",
        route_key="POST /api/v1/routes/search",
        body={
            "start_id": "N1",
            "start_type": "NODE",
            "destination_id": "104",
            "destination_type": "ROOM",
        },
    )

    result = invoke_nav_handler(event)

    assert result["statusCode"] == 200
    body = json.loads(result["body"])
    assert body["success"] is True
    assert "data" in body
    data = body["data"]

    assert "summary" in data
    assert data["summary"]["floor_id"] == "floor-lc3-1"
    assert data["summary"]["total_distance"] > 0

    assert "svg_path" in data
    assert "nodes" in data["svg_path"]
    assert len(data["svg_path"]["nodes"]) >= 3

    assert "steps" in data
    assert len(data["steps"]) >= 2
    assert data["steps"][0]["action"] == "DEPART"
    assert data["steps"][-1]["action"] == "ARRIVE"


@pytest.mark.unit
@pytest.mark.handler
def test_post_routes_search_without_prefix(invoke_nav_handler):
    event = make_apigw_event(
        method="POST",
        path="/routes/search",
        route_key="POST /routes/search",
        body={
            "start_id": "QR-01",
            "start_type": "QR",
            "destination_id": "102",
            "destination_type": "ROOM",
        },
    )

    result = invoke_nav_handler(event)

    assert result["statusCode"] == 200
    body = json.loads(result["body"])
    assert body["success"] is True
    assert body["data"]["summary"]["start_location"]["type"] == "QR"


@pytest.mark.unit
@pytest.mark.handler
def test_get_routes_success(invoke_nav_handler):
    event = make_apigw_event(
        method="GET",
        path="/api/v1/routes",
        route_key="GET /api/v1/routes",
        query={
            "start_node": "N1",
            "destination_room": "104",
        },
    )

    result = invoke_nav_handler(event)

    assert result["statusCode"] == 200
    body = json.loads(result["body"])
    assert "summary" in body
    assert "path_nodes" in body
    assert "instructions" in body
    assert "is_rerouted" in body
    assert "svg_path" in body
    assert "steps" in body


@pytest.mark.unit
@pytest.mark.handler
def test_get_routes_without_prefix(invoke_nav_handler):
    event = make_apigw_event(
        method="GET",
        path="/routes",
        route_key="GET /routes",
        query={
            "start_node": "N1",
            "destination_room": "104",
        },
    )

    result = invoke_nav_handler(event)

    assert result["statusCode"] == 200
    body = json.loads(result["body"])
    assert "summary" in body
    assert "path_nodes" in body


@pytest.mark.unit
@pytest.mark.handler
def test_post_routes_search_missing_parameters(invoke_nav_handler):
    event = make_apigw_event(
        method="POST",
        path="/api/v1/routes/search",
        route_key="POST /api/v1/routes/search",
        body={
            "start_id": "N1",
            # missing start_type and destination_id
        },
    )

    result = invoke_nav_handler(event)

    assert result["statusCode"] == 400
    body = json.loads(result["body"])
    assert body["success"] is False
    assert body["error"]["code"] == "MISSING_PARAMETER"


@pytest.mark.unit
@pytest.mark.handler
def test_get_routes_missing_parameters(invoke_nav_handler):
    event = make_apigw_event(
        method="GET",
        path="/api/v1/routes",
        route_key="GET /api/v1/routes",
        query={
            "start_node": "N1",
            # missing destination_room
        },
    )

    result = invoke_nav_handler(event)

    assert result["statusCode"] == 400
    body = json.loads(result["body"])
    assert body["success"] is False
    assert body["error"]["code"] == "MISSING_PARAMETER"


@pytest.mark.unit
@pytest.mark.handler
def test_post_routes_search_room_not_found(invoke_nav_handler):
    event = make_apigw_event(
        method="POST",
        path="/api/v1/routes/search",
        route_key="POST /api/v1/routes/search",
        body={
            "start_id": "N1",
            "start_type": "NODE",
            "destination_id": "99999",
            "destination_type": "ROOM",
        },
    )

    result = invoke_nav_handler(event)

    assert result["statusCode"] == 404
    body = json.loads(result["body"])
    assert body["success"] is False
    assert body["error"]["code"] == "ROOM_NOT_FOUND"


@pytest.mark.unit
@pytest.mark.handler
def test_public_route_access_requires_no_auth(invoke_nav_handler):
    # Ensure POST /api/v1/routes/search is completely public (no Authorization header provided)
    event = make_apigw_event(
        method="POST",
        path="/api/v1/routes/search",
        route_key="POST /api/v1/routes/search",
        headers={},  # no auth
        body={
            "start_id": "N1",
            "start_type": "NODE",
            "destination_id": "101",
            "destination_type": "ROOM",
        },
    )

    result = invoke_nav_handler(event)
    assert result["statusCode"] == 200
