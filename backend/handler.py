"""
AWS Lambda entry point -- the inbound (driving) adapter.

Its whole job is: API Gateway event -> use case -> HTTP response. It contains
no business rules, and no endpoint has its own copy of the request lifecycle.

Adding an endpoint means adding ONE entry to ROUTES (plus its Terraform route
and its service method). See backend/README.md.

Layer: driving adapter (inbound) + composition root.
"""

import logging
import re
from collections import namedtuple

import response
from errors import AppError, MissingParameters, RouteNotFound
from repositories.building_repository import BuildingRepository
from services.building_service import BuildingService
from services.facility_service import FacilityService
from services.floor_service import FloorService
from services.room_service import RoomService

logger = logging.getLogger()
logger.setLevel(logging.INFO)


# ---------------------------------------------------------------------------
# Composition root -- the one place adapters are wired into services.
# ---------------------------------------------------------------------------


class Dependencies:
    """Every use case the routes can call, built over one data source."""

    def __init__(self, source=None):
        source = source if source is not None else BuildingRepository()

        self.buildings = BuildingService(source)
        self.floors = FloorService(source)
        self.rooms = RoomService(source)
        self.facilities = FacilityService(source)


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

# A floor is addressed by its uuid alone -- the building is no longer in the
# path. Rooms and facilities are still nested under a building; when they are
# flattened too, NESTED_FLOOR disappears with them.
FLOOR = "/api/v1/floors/{floorId}"
NESTED_FLOOR = f"{BUILDING}/floors/{{floorId}}"

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
    f"GET {NESTED_FLOOR}/rooms/{{roomId}}": Route(
        ("buildingId", "floorId", "roomId"),
        lambda deps, p: deps.rooms.get_room(
            p["buildingId"], p["floorId"], p["roomId"]
        ),
    ),
    f"GET {NESTED_FLOOR}/facilities/{{facilityId}}": Route(
        ("buildingId", "floorId", "facilityId"),
        lambda deps, p: deps.facilities.get_facility(
            p["buildingId"], p["floorId"], p["facilityId"]
        ),
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

      - GET /api/v1/buildings
      - GET /api/v1/buildings/{buildingId}
      - GET /api/v1/floors/{floorId}
      - GET /api/v1/buildings/{buildingId}/floors/{floorId}/rooms/{roomId}
      - GET /api/v1/buildings/{buildingId}/floors/{floorId}/facilities/{facilityId}
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

        return response.ok(route.action(DEPS, params))

    except AppError as exc:
        logger.warning("%s: %s", exc.code, exc.message)

        return response.error(exc)

    except Exception:
        logger.exception("Unhandled error while processing %s %s", method, path)

        return response.error(AppError())
