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
from typing import Any
import boto3
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest
import pytest
import requests

USE_IAM_AUTH = os.getenv("USE_IAM_AUTH", "false").lower() in ("true", "1", "yes")
AWS_REGION = os.getenv("AWS_DEFAULT_REGION", "us-east-1")

pytestmark = [pytest.mark.api]


def _request(
    method: str,
    path: str,
    base_url: str,
    headers: dict[str, str] | None = None,
) -> requests.Response:
    url = f"{base_url}{path}"
    req_headers: dict[str, str] = {
        "Accept": "application/json",
    }
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

    return requests.request(method=method, url=url, headers=req_headers, timeout=10)


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
