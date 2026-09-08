"""
HTTP response formatting for API Gateway.

The single place that knows about status codes, CORS and JSON encoding.

Layer: driving adapter (inbound).
"""

import json
from typing import Any

from errors import AppError

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
}


def _build(status_code: int, body: str) -> dict:
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": body,
    }


def ok(body: Any, status_code: int = 200) -> dict:
    """A successful JSON response."""
    return _build(status_code, json.dumps(body, ensure_ascii=False))


def error(exc: AppError) -> dict:
    """
    A failed response, in one consistent shape:

        {"error": {"code": "BUILDING_NOT_FOUND", "message": "..."}}
    """
    return ok({"error": exc.to_dict()}, exc.status_code)


def preflight() -> dict:
    """CORS preflight: 204 with the CORS headers and an empty body."""
    return _build(204, "")
