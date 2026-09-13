import json
from unittest.mock import patch
import pytest

from tests.conftest import make_apigw_event


@pytest.mark.unit
@pytest.mark.handler
def test_handler_cors_preflight(invoke_handler):
    """OPTIONS request returns 204 with CORS headers."""
    event = make_apigw_event(
        method="OPTIONS",
        path="/api/v1/buildings",
        route_key="OPTIONS /api/v1/buildings",
    )

    result = invoke_handler(event)

    assert result["statusCode"] == 204
    assert result["headers"]["Access-Control-Allow-Origin"] == "*"
    assert "GET" in result["headers"]["Access-Control-Allow-Methods"]


@pytest.mark.unit
@pytest.mark.handler
def test_handler_route_not_found(invoke_handler):
    """Unmapped routes return 404 with ROUTE_NOT_FOUND."""
    event = make_apigw_event(
        method="GET",
        path="/api/v1/unmapped-resource",
        route_key="GET /api/v1/unmapped-resource",
    )

    result = invoke_handler(event)

    assert result["statusCode"] == 404
    body = json.loads(result["body"])
    assert "error" in body
    assert body["error"]["code"] == "ROUTE_NOT_FOUND"


@pytest.mark.unit
@pytest.mark.handler
def test_handler_fallback_regex_matching(invoke_handler):
    """Fallback regex matches path when routeKey is missing from event."""
    event = {
        "version": "2.0",
        "rawPath": "/api/v1/buildings/LC3",
        "requestContext": {
            "http": {
                "method": "GET",
                "path": "/api/v1/buildings/LC3",
            }
        },
    }

    result = invoke_handler(event)

    assert result["statusCode"] == 200
    body = json.loads(result["body"])
    assert body["id"] == "lc3"


@pytest.mark.unit
@pytest.mark.handler
def test_handler_unhandled_exception(invoke_handler):
    """Unhandled unexpected exceptions are trapped and returned as 500 INTERNAL_ERROR."""
    event = make_apigw_event(
        method="GET",
        path="/api/v1/buildings",
        route_key="GET /api/v1/buildings",
    )

    # Simulate an unexpected crash (e.g. division by zero or bug)
    with patch("handler.ROUTES") as mock_routes:
        mock_routes.__getitem__.side_effect = RuntimeError("Catastrophic failure")

        result = invoke_handler(event)

        assert result["statusCode"] == 500
        body = json.loads(result["body"])
        assert "error" in body
        assert body["error"]["code"] == "INTERNAL_ERROR"
