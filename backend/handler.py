"""
AWS Lambda entry point -- the inbound (driving) adapter.

Its whole job is: API Gateway event -> use case -> HTTP response. It contains
no business rules, and no endpoint has its own copy of the request lifecycle.

Adding an endpoint means adding ONE entry to ROUTES (plus its Terraform route
and its service method). See backend/README.md.

Layer: driving adapter (inbound) + composition root.
"""

import json
import logging
import re
from collections import namedtuple

import response
from errors import (
    AppError,
    MissingParameters,
    RouteNotFound,
    ValidationError,
)
from repositories.building_repository import BuildingRepository
from repositories.dynamodb_schedule_repository import (
    DynamoDBScheduleRepository,
)
from services.building_service import BuildingService
from services.facility_service import FacilityService
from services.floor_service import FloorService
from services.room_service import RoomService
from services.schedule_service import ScheduleService

logger = logging.getLogger()
logger.setLevel(logging.INFO)


# ---------------------------------------------------------------------------
# Composition root -- the one place adapters are wired into services.
# ---------------------------------------------------------------------------


class Dependencies:
    """Every use case the routes can call, built over one data source."""

    def __init__(self, source=None, schedule_source=None):
        source = source if source is not None else BuildingRepository()

        if schedule_source is None:
            schedule_source = DynamoDBScheduleRepository()

        self.buildings = BuildingService(source)
        self.floors = FloorService(source)
        self.rooms = RoomService(source)
        self.facilities = FacilityService(source)
        self.schedules = ScheduleService(schedule_source)


# Built once per Lambda container (kept warm across invocations).
DEPS = Dependencies()


# ---------------------------------------------------------------------------
# Route table
#
# Keys are API Gateway route keys -- byte-for-byte the `route_key` values
# declared in terraform/terraform-backend/modules/api_gateway/main.tf.
# ---------------------------------------------------------------------------

Route = namedtuple("Route", "required_params action")


BUILDINGS = "/api/v1/buildings"
BUILDING = f"{BUILDINGS}/{{buildingId}}"

# Flattening is finished: a floor, room or facility is addressed by its uuid
# alone. Only a building keeps a nested child ({buildingId} in BUILDING).
FLOOR = "/api/v1/floors/{floorId}"
ROOM = "/api/v1/rooms/{roomId}"
FACILITY = "/api/v1/facilities/{facilityId}"
ROOM_SCHEDULES = f"{ROOM}/schedules"
ROUTES = {
    f"GET {BUILDINGS}": Route(
        (),
        lambda deps, p: {"buildings": deps.buildings.list_buildings()},
    ),
    f"GET {BUILDING}": Route(
        ("buildingId",),
        lambda deps, p: deps.buildings.get_summary(p["buildingId"]),
    ),
    f"GET {FLOOR}": Route(
        ("floorId",),
        lambda deps, p: deps.floors.get_details(p["floorId"]),
    ),
    f"GET {ROOM}": Route(
        ("roomId",),
        lambda deps, p: deps.rooms.get_room(p["roomId"]),
    ),
    f"GET {FACILITY}": Route(
        ("facilityId",),
        lambda deps, p: deps.facilities.get_facility(p["facilityId"]),
    ),
    f"GET {ROOM_SCHEDULES}": Route(
        ("roomId", "start", "end"),
        lambda deps, p: deps.schedules.get_room_schedules(
            p["roomId"], p["start"], p["end"], p.get("type")
        ),
    ),
    f"POST {ROOM_SCHEDULES}": Route(
        ("roomId", "body"),
        lambda deps, p: deps.schedules.create_schedule(p["roomId"], p["body"]),
    ),
}


def _compile(route_key: str) -> tuple[str, re.Pattern]:
    """`"GET /a/{b}"` -> `("GET", re.compile("/a/(?P<b>[^/]+)/?$"))`."""
    method, template = route_key.split(" ", 1)
    pattern = re.sub(r"\{(\w+)\}", r"(?P<\1>[^/]+)", template)

    return method, re.compile(pattern + "/?$")


# Fallback matchers, used only when the event carries no usable `routeKey`
# (REST/v1 payloads, or a direct Lambda invoke from the smoke script).
_PATTERNS = [(*_compile(key), key) for key in ROUTES]


# ---------------------------------------------------------------------------
# Request parsing
# ---------------------------------------------------------------------------


def _method(event: dict) -> str:
    http_info = (event.get("requestContext") or {}).get("http") or {}

    return (
        http_info.get("method")
        or event.get("httpMethod")
        or ""
    ).upper()


def _path(event: dict) -> str:
    return event.get("rawPath") or event.get("path") or ""


def _resolve(event: dict, method: str, path: str) -> tuple[str | None, dict]:
    """
    Identify the route and collect its path parameters.

    Prefers the `routeKey` API Gateway already resolved (exact, and impossible
    to confuse with a similar path); falls back to matching the path itself.
    """
    params = {
        key: value
        for key, value in (event.get("pathParameters") or {}).items()
        if value
    }

    params.update(event.get("queryStringParameters") or {})

    if event.get("body"):
        try:
            params["body"] = json.loads(event["body"])
        except json.JSONDecodeError as exc:
            raise ValidationError("Request body is not valid JSON") from exc

    route_key = event.get("routeKey")

    if route_key in ROUTES:
        return route_key, params

    for pattern_method, pattern, key in _PATTERNS:
        if pattern_method != method:
            continue

        match = pattern.search(path)

        if match:
            for name, value in match.groupdict().items():
                params.setdefault(name, value)

            return key, params

    return None, params


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def lambda_handler(event, context):
    """
    Handles every route in ROUTES:

      - GET  /api/v1/buildings
      - GET  /api/v1/buildings/{buildingId}
      - GET  /api/v1/floors/{floorId}
      - GET  /api/v1/rooms/{roomId}
      - GET  /api/v1/facilities/{facilityId}
      - GET  /api/v1/rooms/{roomId}/schedules
      - POST /api/v1/rooms/{roomId}/schedules
    """
    method = _method(event)
    path = _path(event)

    logger.info("Incoming Request -> Method: %s, Path: %s", method, path)

    if method == "OPTIONS":
        return response.preflight()

    try:
        route_key, params = _resolve(event, method, path)

        if route_key is None:
            raise RouteNotFound(f"{method} {path}")

        route = ROUTES[route_key]

        missing = [
            name for name in route.required_params if not params.get(name)
        ]

        if missing:
            raise MissingParameters(missing)

        # A POST creates a schedule; everything else reads one.
        return response.ok(
            route.action(DEPS, params), 201 if method == "POST" else 200
        )

    except AppError as exc:
        logger.warning("%s: %s", exc.code, exc.message)

        return response.error(exc)

    except Exception:
        logger.exception("Unhandled error while processing %s %s", method, path)

        return response.error(AppError())
