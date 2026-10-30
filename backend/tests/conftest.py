import base64
import binascii
import json
import os
from typing import Any
import pytest

from models.navigation import CorridorEdge, NavigationNode, QRLocation, RoomAttachment
from ports.navigation_source import NavigationSource


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
    """In-memory fake source for building, floor, room and facility tests."""

    def __init__(
        self,
        buildings: dict[str, dict[str, Any]] | None = None,
    ):
        self._buildings = buildings or {}

    def list_buildings(self) -> list[dict[str, Any]]:
        return list(self._buildings.values())

    def get_building(self, building_id: str) -> dict[str, Any] | None:
        # Support lookup by dictionary key or building ID.
        for candidate in (
            building_id,
            building_id.upper(),
            building_id.lower(),
        ):
            if candidate in self._buildings:
                return self._buildings[candidate]

        for building in self._buildings.values():
            if str(building.get("id")) == str(building_id):
                return building

        return None

    def _iter_entities(self):
        """Yield rooms and facilities with their parent IDs."""
        for building in self._buildings.values():
            building_id = building.get("id")

            for floor in building.get("floors") or []:
                floor_id = floor.get("id")

                for room in floor.get("rooms") or []:
                    yield "ROOM", {
                        **room,
                        "building_id": room.get(
                            "building_id", building_id
                        ),
                        "floor_id": room.get("floor_id", floor_id),
                    }

                for facility in floor.get("facilities") or []:
                    yield "FACILITY", {
                        **facility,
                        "building_id": facility.get(
                            "building_id", building_id
                        ),
                        "floor_id": facility.get("floor_id", floor_id),
                    }

    def get_room(self, room_id: str) -> dict[str, Any] | None:
        for entity_type, entity in self._iter_entities():
            if entity_type != "ROOM":
                continue

            if str(entity.get("id")) == str(room_id):
                return entity

            # Compatibility with legacy tests that use room_number.
            if str(entity.get("room_number")) == str(room_id):
                return entity

        return None

    def get_facility(self, facility_id: str) -> dict[str, Any] | None:
        for entity_type, entity in self._iter_entities():
            if entity_type != "FACILITY":
                continue

            if str(entity.get("id")) == str(facility_id):
                return entity

        return None

    def get_floor(self, floor_id: str) -> dict[str, Any] | None:
        for building in self._buildings.values():
            for floor in building.get("floors") or []:
                if str(floor.get("id")) == str(floor_id):
                    return {
                        **floor,
                        "building_id": floor.get(
                            "building_id", building.get("id")
                        ),
                    }

        return None

    def presigned_url(
        self,
        key: str,
        expires_in: int = 3600,
    ) -> str:
        # Retained for unrelated legacy tests.
        return (
            f"https://mock-bucket.s3.amazonaws.com/"
            f"{key}?expires={expires_in}"
        )

class FakeScheduleSource:
    """
    In-memory fake of ports.schedule_source.ScheduleSource.

    Mirrors the real adapter: a series matches a window when it starts before
    `end` and its `series_end_at` is after `start` (UTC strings).
    """

    def __init__(
        self,
        schedules: list[dict[str, Any]] | dict[tuple[str, str], dict[str, Any]] | None = None,
    ):
        if isinstance(schedules, dict):
            self.schedules = list(schedules.values())
        else:
            self.schedules = list(schedules or [])
        self.deleted_schedule = None

    def list_schedules(
        self,
        limit: int,
        next_token: str | None = None,
        schedule_type: str | None = None,
    ) -> tuple[list[dict[str, Any]], str | None]:
        try:
            start = (
                json.loads(base64.urlsafe_b64decode(next_token).decode())["index"]
                if next_token else 0
            )
        except (binascii.Error, KeyError, TypeError, ValueError, UnicodeDecodeError) as exc:
            from errors import InvalidParameter

            raise InvalidParameter("Invalid nextToken.") from exc

        filtered = [
            schedule for schedule in self.schedules
            if schedule_type is None or schedule.get("type") == schedule_type
        ]
        page = filtered[start:start + limit]
        end = start + len(page)
        token = (
            base64.urlsafe_b64encode(json.dumps({"index": end}).encode()).decode()
            if end < len(filtered)
            else None
        )
        return page, token

    def find_overlapping(
        self,
        room_id: str,
        start: str,
        end: str,
        schedule_type: str | None = None,
    ) -> list[dict[str, Any]]:
        from models.schedule import to_utc

        return [
            schedule
            for schedule in self.schedules
            if schedule.get("room_id") == room_id
            and to_utc(schedule["start_at"]) < end
            and schedule.get("series_end_at", to_utc(schedule["end_at"])) > start
            and (schedule_type is None or schedule["type"] == schedule_type)
        ]

    def save_schedule(self, schedule: dict[str, Any]) -> None:
        existing = self.get_schedule(schedule["room_id"], schedule["id"])
        if existing is not None:
            self.schedules.remove(existing)
        self.schedules.append(schedule)

    def save_schedules(self, schedules: list[dict[str, Any]]) -> None:
        self.schedules.extend(schedules)

    def get_schedule(
        self,
        room_id: str,
        schedule_id: str,
    ) -> dict[str, Any] | None:
        for s in self.schedules:
            if s.get("room_id") == room_id and s.get("id") == schedule_id:
                return s
        return None

    def get_schedule_by_id(
        self,
        schedule_id: str,
    ) -> dict[str, Any] | None:
        for s in self.schedules:
            if s.get("id") == schedule_id:
                return s
        return None

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
                    },
                    {
                        "id": "lc4-room-uuid-2",
                        "room_number": "205",
                        "name": {"th": None, "en": "Office 205"},
                        "type": "OFFICE",
                        "latitude": 14.07262,
                        "longitude": 100.60773,
                    },
                    {
                        "id": "lc4-room-uuid-3",
                        "room_number": "R2",
                        "name": {"th": None, "en": "Restroom"},
                        "type": "RESTROOM",
                        "latitude": 14.07262,
                        "longitude": 100.60773,
                    },
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


class FakeBookmarkSource:
    """In-memory fake of ports.bookmark_source.BookmarkSource."""

    def __init__(self):
        self.rows = []

    def list_bookmarks(self, user_id, auth_token=None):
        return [b for b in reversed(self.rows) if b.user_id == user_id]

    def add_bookmark(self, user_id, entity_id, entity_type, auth_token=None):
        from errors import AlreadyBookmarked
        from models.bookmark import Bookmark

        if any(b.user_id == user_id and b.entity_id == entity_id for b in self.rows):
            raise AlreadyBookmarked()
        bookmark = Bookmark(
            id=f"bm-{len(self.rows) + 1}",
            user_id=user_id,
            entity_id=entity_id,
            entity_type=entity_type,
            saved_at="2026-10-14T10:30:00Z",
        )
        self.rows.append(bookmark)
        return bookmark

    def remove_bookmark(self, user_id, entity_id, auth_token=None):
        for b in self.rows:
            if b.user_id == user_id and b.entity_id == entity_id:
                self.rows.remove(b)
                return b
        return None


@pytest.fixture
def fake_bookmark_source() -> FakeBookmarkSource:
    return FakeBookmarkSource()


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
        "recurrence_rule": (
            "RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=15"
        ),
        "room_id": "room-lc3-301",
        "status": "CONFIRM",
        "series_end_at": "2026-12-21T05:00:00+00:00",
        "created_at": "2026-09-01T00:00:00+00:00",
    }




class FakeNavigationSource(NavigationSource):
    """In-memory fake navigation source for unit testing."""

    def __init__(
        self,
        floors: dict[str, dict[str, Any]] | None = None,
        rooms: dict[str, dict[str, Any]] | None = None,
        nav_data: dict[str, dict[str, Any]] | None = None,
    ):
        self._floors = floors or {}
        self._rooms = rooms or {}
        self._nav_data = nav_data or {}

    def get_floor_navigation_data(self, floor_id: str) -> dict[str, Any]:
        return self._nav_data.get(
            floor_id,
            {"nodes": [], "edges": [], "qrs": [], "rooms": []},
        )

    def get_room(self, room_id: str) -> dict[str, Any] | None:
        for r in self._rooms.values():
            if r.get("id") == room_id or r.get("room_number") == room_id:
                return r
        return self._rooms.get(room_id)

    def get_floor(self, floor_id: str) -> dict[str, Any] | None:
        return self._floors.get(floor_id)

    def find_qr(self, qr_id: str, floor_id: str | None = None) -> dict[str, Any] | None:
        for fid, data in self._nav_data.items():
            if floor_id and fid != floor_id:
                continue
            for qr in data.get("qrs", []):
                if qr.id == qr_id:
                    return {
                        "id": qr.id,
                        "node_id": qr.node_id,
                        "floor_id": fid,
                        "location_description": qr.location_description,
                    }
        return None

    def find_node(self, node_id: str, floor_id: str | None = None) -> dict[str, Any] | None:
        for fid, data in self._nav_data.items():
            if floor_id and fid != floor_id:
                continue
            for n in data.get("nodes", []):
                if n.id == node_id:
                    return {
                        "id": n.id,
                        "name": n.name,
                        "node_type": n.node_type,
                        "status": n.status,
                        "svg_x": n.svg_x,
                        "svg_y": n.svg_y,
                        "floor_id": fid,
                    }
        return None


@pytest.fixture
def sample_navigation_source() -> FakeNavigationSource:
    floor_id = "floor-lc3-1"
    floors = {
        floor_id: {
            "id": floor_id,
            "floor_number": 1,
            "building_id": "lc3",
            "floor_plan_key": "floor-plan/LC3/LC3-floor1-neutral.svg",
        },
        "floor-lc3-2": {
            "id": "floor-lc3-2",
            "floor_number": 2,
            "building_id": "lc3",
            "floor_plan_key": "floor-plan/LC3/LC3-floor2-neutral.svg",
        },
    }

    nodes = [
        NavigationNode(id="N1", name="West Entrance", svg_x=100.0, svg_y=100.0, floor_id=floor_id),
        NavigationNode(id="N2", name="Hallway Junction", svg_x=200.0, svg_y=100.0, floor_id=floor_id),
        NavigationNode(id="N3", name="Corner Corridor", svg_x=300.0, svg_y=100.0, floor_id=floor_id),
        NavigationNode(id="N4", name="South Hub", svg_x=300.0, svg_y=200.0, floor_id=floor_id),
        NavigationNode(id="N_DISCONNECTED", name="Isolated Node", svg_x=800.0, svg_y=800.0, floor_id=floor_id),
    ]

    edges = [
        CorridorEdge(id="E1", from_node_id="N1", to_node_id="N2", distance_weight=100.0, floor_id=floor_id),
        CorridorEdge(id="E2", from_node_id="N2", to_node_id="N3", distance_weight=100.0, floor_id=floor_id),
        CorridorEdge(id="E3", from_node_id="N3", to_node_id="N4", distance_weight=100.0, floor_id=floor_id),
    ]

    qrs = [
        QRLocation(id="QR-01", node_id="N1", location_description="West Entrance QR", floor_id=floor_id),
    ]

    rooms_data = {
        "room-101": {
            "id": "room-101",
            "room_number": "101",
            "floor_id": floor_id,
            "building_id": "lc3",
            "corridor_edge_id": "E1",
            "door_svg_x": 150.0,
            "door_svg_y": 80.0,
            "side": "LEFT",
            "sequence_order": 1,
            "status": "ACTIVE",
        },
        "room-102": {
            "id": "room-102",
            "room_number": "102",
            "floor_id": floor_id,
            "building_id": "lc3",
            "corridor_edge_id": "E1",
            "door_svg_x": 180.0,
            "door_svg_y": 80.0,
            "side": "LEFT",
            "sequence_order": 2,
            "status": "ACTIVE",
        },
        "room-104": {
            "id": "room-104",
            "room_number": "104",
            "floor_id": floor_id,
            "building_id": "lc3",
            "corridor_edge_id": "E3",
            "door_svg_x": 320.0,
            "door_svg_y": 150.0,
            "side": "RIGHT",
            "sequence_order": 1,
            "status": "ACTIVE",
        },
        "room-blocked": {
            "id": "room-blocked",
            "room_number": "999",
            "floor_id": floor_id,
            "building_id": "lc3",
            "corridor_edge_id": "E1",
            "door_svg_x": 120.0,
            "door_svg_y": 80.0,
            "side": "LEFT",
            "status": "BLOCKED",
        },
        "room-no-corridor": {
            "id": "room-no-corridor",
            "room_number": "000",
            "floor_id": floor_id,
            "building_id": "lc3",
            "status": "ACTIVE",
        },
        "room-floor2": {
            "id": "room-floor2",
            "room_number": "201",
            "floor_id": "floor-lc3-2",
            "building_id": "lc3",
            "corridor_edge_id": "E-F2-1",
            "status": "ACTIVE",
        },
    }

    room_attachments = [
        RoomAttachment(
            room_id=r["id"],
            room_number=r.get("room_number"),
            corridor_edge_id=r.get("corridor_edge_id", ""),
            door_svg_x=r.get("door_svg_x"),
            door_svg_y=r.get("door_svg_y"),
            side=r.get("side", "RIGHT"),
            sequence_order=r.get("sequence_order"),
            floor_id=r["floor_id"],
            building_id=r["building_id"],
            status=r.get("status", "ACTIVE"),
        )
        for r in rooms_data.values()
        if r.get("corridor_edge_id")
    ]

    nav_data = {
        floor_id: {
            "nodes": nodes,
            "edges": edges,
            "qrs": qrs,
            "rooms": room_attachments,
        }
    }

    return FakeNavigationSource(floors=floors, rooms=rooms_data, nav_data=nav_data)
