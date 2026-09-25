import json
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


class FakeScheduleSource:
    """
    In-memory fake implementation of ports.schedule_source.ScheduleSource.

    Mirrors the GSI4 semantics of the real adapter: a schedule matches on its
    `start_at` alone, over the half-open window [start, end). Also supports
    single item get, update and delete.
    """

    def __init__(
        self,
        schedules: list[dict[str, Any]] | dict[tuple[str, str], dict[str, Any]] | None = None,
    ):
        if isinstance(schedules, dict):
            self.schedules = list(schedules.values())
        else:
            self.schedules = list(schedules or [])
        self.updated_schedule = None
        self.deleted_schedule = None

    def get_schedule_by_room_and_time_range(
        self,
        room_id: str,
        start: str,
        end: str,
        schedule_type: str | None = None,
    ) -> list[dict[str, Any]]:
        return [
            schedule
            for schedule in self.schedules
            if schedule.get("room_id") == room_id
            and start <= schedule["start_at"] < end
            and (
                schedule_type is None
                or schedule["type"] == schedule_type.upper()
            )
        ]

    find_by_room_and_time_range = get_schedule_by_room_and_time_range

    def save_schedule(self, schedules: list[dict[str, Any]]) -> None:
        self.schedules.extend(schedules)

    save = save_schedule

    def get_schedule(
        self,
        room_id: str,
        schedule_id: str,
    ) -> dict[str, Any] | None:
        for s in self.schedules:
            if s.get("room_id") == room_id and s.get("id") == schedule_id:
                return s
        return None

    def update_schedule(
        self,
        schedule: dict[str, Any],
    ) -> dict[str, Any]:
        self.updated_schedule = schedule
        for i, s in enumerate(self.schedules):
            if s.get("room_id") == schedule.get("room_id") and s.get("id") == schedule.get("id"):
                self.schedules[i] = schedule
                return schedule
        self.schedules.append(schedule)
        return schedule

    def delete_schedule(
        self,
        room_id: str,
        schedule_id: str,
    ) -> None:
        self.deleted_schedule = (room_id, schedule_id)
        self.schedules = [
            s
            for s in self.schedules
            if not (s.get("room_id") == room_id and s.get("id") == schedule_id)
        ]


@pytest.fixture
def sample_schedule_raw() -> dict[str, Any]:
    """One stored schedule, shaped like the seeded DynamoDB item."""
    return {
        "id": "550e8400-e29b-41d4-a716-446655440050",
        "room_id": "room-uuid-1",
        "type": "COURSE",
        "title": "Software Engineering",
        "course_code": "CS361",
        "organizer": "Aj. Example",
        "time_zone": "Asia/Bangkok",
        "status": "CONFIRM",
        "start_at": "2026-09-16T13:00:00+07:00",
        "end_at": "2026-09-16T16:00:00+07:00",
    }


@pytest.fixture
def schedule_source(sample_schedule_raw: dict[str, Any]) -> FakeScheduleSource:
    return FakeScheduleSource([sample_schedule_raw])


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
    query: dict[str, str] | None = None,
    body: Any = None,
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
    if query is not None:
        event["queryStringParameters"] = query
    if body is not None:
        event["body"] = body if isinstance(body, str) else json.dumps(body)
    return event


@pytest.fixture
def invoke_handler(
    campus_source: FakeBuildingSource,
    schedule_source: FakeScheduleSource,
):
    """
    Fixture to invoke lambda_handler with Dependencies wired to a fake source.
    Safely restores original handler.DEPS after execution.
    """
    import handler
    from handler import Dependencies, lambda_handler

    def _invoke(event: dict[str, Any], source: FakeBuildingSource | None = None):
        target_source = source if source is not None else campus_source
        original_deps = handler.DEPS
        handler.DEPS = Dependencies(target_source, schedule_source)
        try:
            return lambda_handler(event, None)
        finally:
            handler.DEPS = original_deps

    return _invoke


@pytest.fixture
def fake_schedule_source():
    """Factory fixture for creating an in-memory ScheduleSource."""
    return FakeScheduleSource


@pytest.fixture
def sample_schedule() -> dict[str, Any]:
    """Sample schedule data for Schedule service tests."""
    return {
        "id": "schedule-001",
        "type": "COURSE",
        "title": "Cloud-Based Software Architecture",
        "description": "CS361 lecture",
        "course_code": "CS361",
        "organizer": "Computer Science Department",
        "start_at": "2026-09-14T09:00:00+07:00",
        "end_at": "2026-09-14T12:00:00+07:00",
        "time_zone": "Asia/Bangkok",
        "is_all_day": False,
        "recurrence_rule": (
            "RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=15"
        ),
        "room_id": "room-lc3-301",
        "location_text": None,
        "status": "CONFIRMED",
        "source_id": "csv-row-001",
        "source_type": "CSV",
    }