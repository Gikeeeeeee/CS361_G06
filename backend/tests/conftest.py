import os
from typing import Any
import pytest


def pytest_addoption(parser):
    parser.addoption(
        "--api-url",
        action="store",
        default="",
        help="Base URL of the deployed API Gateway for live API tests (e.g. --api-url https://...)",
    )


@pytest.fixture(scope="session")
def api_base_url(request) -> str:
    """
    Returns the target API base URL from either:
    1. CLI argument `--api-url <url>`
    2. Environment variable `API_BASE_URL`
    If neither is provided, automatically skips the test.
    """
    url = request.config.getoption("--api-url") or os.getenv("API_BASE_URL", "")
    if not url:
        pytest.skip("Neither --api-url CLI argument nor API_BASE_URL env var was provided")
    return url.rstrip("/")


class FakeBuildingSource:
    """In-memory fake implementation of ports.building_source.BuildingSource."""

    def __init__(self, buildings: dict[str, dict[str, Any]] | None = None):
        self._buildings = buildings or {}

    def list_buildings(self) -> list[dict[str, Any]]:
        return list(self._buildings.values())

    def get_building(self, building_id: str) -> dict[str, Any] | None:
        for candidate in [building_id, building_id.upper(), building_id.lower()]:
            if candidate in self._buildings:
                return self._buildings[candidate]
        return None

    def get_floor(self, floor_id: str) -> dict[str, Any] | None:
        """
        Walks the buildings in insertion order, mirroring the real adapter's
        scan -- so a test can assert the search does not stop at the first
        building that lacks the floor.
        """
        for building in self._buildings.values():
            for floor in building.get("floors") or []:
                if str(floor.get("id")) == str(floor_id):
                    return floor
        return None

    def presigned_url(self, key: str, expires_in: int = 3600) -> str:
        return f"https://mock-bucket.s3.amazonaws.com/{key}?expires={expires_in}"


@pytest.fixture
def sample_building_raw() -> dict[str, Any]:
    """Sample raw building data matching the S3 JSON format."""
    return {
        "id": "lc3",
        "code": "LC3",
        "name": {
            "th": "อาคารบรรยายรวม 3",
            "en": "Lecture Classroom 3",
        },
        "description": {
            "th": "อาคารเรียนรวม...",
            "en": "A lecture building...",
        },
        "image_key": "image/building/LC3.webp",
        "opening_hours": "08:00-18:00",
        "latitude": 14.0726,
        "longitude": 100.6062,
        "floors": [
            {
                "id": "floor-uuid-1",
                "floor_number": 1,
                "floor_plan_key": "floor-plan/LC3/floor1.svg",
                "rooms": [
                    {
                        "id": "room-uuid-1",
                        "room_number": "101",
                        "name": {"th": "ห้อง 101", "en": "Room 101"},
                        "type": "CLASSROOM",
                        "latitude": 14.07269,
                        "longitude": 100.60614,
                        # Present in storage, absent from the floor contract --
                        # the projection has to drop these three.
                        "facilities": {"projector": True, "wifi": True},
                        "image_key": "image/room/CLASSROOM.webp",
                        "description": {"th": None, "en": "A lecture room"},
                    }
                ],
                "facilities": [
                    {
                        "id": "facility-uuid-1",
                        "name": {"th": "ห้องน้ำ", "en": "Restroom"},
                        "type": "TOILET",
                        "latitude": 14.07257,
                        "longitude": 100.60569,
                        # Storage-only, as above.
                        "description": {"th": None, "en": None},
                    }
                ],
            }
        ],
    }


@pytest.fixture
def sample_building_lc4_raw() -> dict[str, Any]:
    """A second building, so a floor lookup has somewhere to scan past LC3 to."""
    return {
        "id": "lc4",
        "code": "LC4",
        "name": {"th": "อาคาร LC4", "en": "LC4 Building"},
        "image_key": "image/building/LC4.webp",
        "latitude": 14.0726,
        "longitude": 100.6077,
        "floors": [
            {
                "id": "lc4-floor-uuid-2",
                "floor_number": 2,
                "floor_plan_key": "floor-plan/LC4/LC4-floor2-neutral.svg",
                "rooms": [
                    {
                        "id": "lc4-room-uuid-1",
                        "room_number": "201",
                        "name": {"th": None, "en": "Lab 201"},
                        "type": "LAB",
                        "latitude": 14.07261,
                        "longitude": 100.60772,
                        "image_key": "image/room/LAB.webp",
                    }
                ],
                "facilities": [],
            }
        ],
    }


@pytest.fixture
def fake_source(sample_building_raw: dict[str, Any]) -> FakeBuildingSource:
    return FakeBuildingSource({"lc3": sample_building_raw})


@pytest.fixture
def campus_source(
    sample_building_raw: dict[str, Any],
    sample_building_lc4_raw: dict[str, Any],
) -> FakeBuildingSource:
    """Two buildings, LC3 first -- an LC4 floor is only reachable by scanning."""
    return FakeBuildingSource(
        {"lc3": sample_building_raw, "lc4": sample_building_lc4_raw}
    )


def make_apigw_event(
    method: str = "GET",
    path: str = "/api/v1/buildings",
    route_key: str | None = None,
    path_parameters: dict[str, str] | None = None,
    headers: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Helper to generate an API Gateway HTTP API v2 event payload."""
    event: dict[str, Any] = {
        "version": "2.0",
        "routeKey": route_key or f"{method} {path}",
        "rawPath": path,
        "requestContext": {
            "http": {
                "method": method,
                "path": path,
            }
        },
        "headers": headers or {},
    }
    if path_parameters is not None:
        event["pathParameters"] = path_parameters
    return event


@pytest.fixture
def invoke_handler(campus_source: FakeBuildingSource):
    """
    Fixture to invoke lambda_handler with Dependencies wired to a fake source.
    Safely restores original handler.DEPS after execution.
    """
    import handler
    from handler import Dependencies, lambda_handler

    def _invoke(event: dict[str, Any], source: FakeBuildingSource | None = None):
        target_source = source if source is not None else campus_source
        original_deps = handler.DEPS
        handler.DEPS = Dependencies(target_source)
        try:
            return lambda_handler(event, None)
        finally:
            handler.DEPS = original_deps

    return _invoke
