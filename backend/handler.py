"""
AWS Lambda entry point -- the inbound (driving) adapter.

Its whole job is: API Gateway event -> use case -> HTTP response. It contains
no business rules, and no endpoint has its own copy of the request lifecycle.

Adding an endpoint means adding ONE entry to ROUTES (plus its Terraform route
and its service method). See backend/README.md.

Layer: driving adapter (inbound) + composition root.
"""

import base64
import json
import logging
import re
from collections import namedtuple

import response
from errors import (
    AppError,
    InvalidParameter,
    InvalidSchedule,
    MissingParameters,
    RouteNotFound,
    ValidationError,
)
from repositories.building_repository import BuildingRepository
from repositories.ScheduleRepo import ScheduleRepository
from repositories.opensearch_repository import OpenSearchRepository

from services.building_service import BuildingService
from services.facility_service import FacilityService
from services.floor_service import FloorService
from services.room_service import RoomService
from services.schedule_import_service import ScheduleImportService
from services.schedule_service import ScheduleService
from services.search_service import SearchService
from models.schedule import TYPES

logger = logging.getLogger()
logger.setLevel(logging.INFO)


# ---------------------------------------------------------------------------
# Composition root -- the one place adapters are wired into services.
# ---------------------------------------------------------------------------


class Dependencies:
    """Every use case the routes can call, built over data sources."""

    def __init__(self, source=None, schedule_source=None):
        self.buildings = BuildingService(
            source if source is not None else BuildingRepository()
        )
        self.floors = FloorService(
            source if source is not None else BuildingRepository()
        )
        self.rooms = RoomService(
            source if source is not None else BuildingRepository()
        )
        self.facilities = FacilityService(
            source if source is not None else BuildingRepository()
        )

        self._schedule_source = schedule_source
        self._schedules = (
            ScheduleService(schedule_source)
            if schedule_source is not None
            else None
        )
        self.search = None

    @property
    def schedules(self) -> ScheduleService:
        if self._schedules is None:
            source = (
                self._schedule_source
                if self._schedule_source is not None
                else ScheduleRepository()
            )
            self._schedules = ScheduleService(source)
        return self._schedules

    @schedules.setter
    def schedules(self, value: ScheduleService):
        self._schedules = value

    def ensure_schedules(self) -> ScheduleService:
        return self.schedules
    def ensure_search(self):
        if self.search is None:
            self.search = SearchService(
                OpenSearchRepository()
            )
        return self.search

    @property
    def schedule_imports(self) -> ScheduleImportService:
        return ScheduleImportService(self.buildings.source, self.schedules.source)


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
ROOM_SCHEDULES = "/api/v1/rooms/{roomId}/schedules"
SCHEDULE = f"{ROOM_SCHEDULES}/{{scheduleId}}"
SCHEDULES = "/api/v1/schedules"
SCHEDULE_IMPORTS = "POST /api/v1/schedules/imports"


def _dry_run(params: dict) -> bool:
    return params.get("dry_run") == "true"


# V2 Schedule API
SEARCH = "/api/v1/search"


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
        lambda deps, p: deps.ensure_schedules().get_room_schedules(
            p["roomId"], p["start"], p["end"], p.get("type")
        ),
    ),
    f"GET {SCHEDULES}": Route(
        (),
        lambda deps, p: deps.ensure_schedules().get_schedules(
            p["pageSize"], p.get("nextToken"), p.get("type")
        ),
    ),
    f"POST {ROOM_SCHEDULES}": Route(
        ("roomId", "body"),
        lambda deps, p: deps.ensure_schedules().create_schedule(p["roomId"], p["body"]),
    ),
    f"PUT {SCHEDULE}": Route(
        ("roomId", "scheduleId"),
        lambda deps, p: deps.ensure_schedules().update_schedule(
            p["roomId"],
            p["scheduleId"],
            p["body"],
        ),
    ),
    f"DELETE {SCHEDULE}": Route(
        ("roomId", "scheduleId"),
        lambda deps, p: deps.ensure_schedules().delete_schedule(
            p["roomId"],
            p["scheduleId"],
        ),
    ),
    f"GET {SEARCH}": Route(
        (),
        lambda deps, p: deps.ensure_search().search(
            p["query"],
            entity_type=p.get("type"),
            building_id=p.get("buildingId"),
            page=p.get("page", 1),
            page_size=p.get("pageSize", 20),
        ).to_dict(),
    ),
    SCHEDULE_IMPORTS: Route(
        ("body",),
        lambda deps, p: deps.schedule_imports.import_csv(p["body"], _dry_run(p)),
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


def _raw_body(event: dict) -> bytes:
    """Body as bytes, base64-decoded when API Gateway encoded it."""
    body = event["body"]

    return base64.b64decode(body) if event.get("isBase64Encoded") else body.encode("utf-8")


def _json_body(body) -> dict:
    if isinstance(body, dict):
        return body

    if not isinstance(body, str):
        raise ValidationError("Request body must be a JSON object")

    try:
        return json.loads(body)
    except json.JSONDecodeError as exc:
        raise ValidationError("Request body is not valid JSON") from exc


def _route_key(event: dict, method: str, path: str, params: dict) -> str | None:
    """Prefer API Gateway's routeKey; fall back to matching the path."""
    route_key = event.get("routeKey")

    if route_key in ROUTES:
        return route_key

    for pattern_method, pattern, key in _PATTERNS:
        match = pattern_method == method and pattern.search(path)

        if match:
            for name, value in match.groupdict().items():
                params.setdefault(name, value)

            return key

    return None


def _resolve(
    event: dict,
    method: str,
    path: str,
) -> tuple[str | None, dict]:
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
    route_key = _route_key(event, method, path, params)

    # Route first: the CSV import body is raw bytes, not JSON.
    if event.get("body"):
        params["body"] = (
            _raw_body(event)
            if route_key == SCHEDULE_IMPORTS
            else _json_body(event["body"])
        )

    return route_key, params


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def lambda_handler(event, context):
    """
    Handles every route in ROUTES:

      - GET    /api/v1/buildings
      - GET    /api/v1/buildings/{buildingId}
      - GET    /api/v1/floors/{floorId}
      - GET    /api/v1/rooms/{roomId}
      - GET    /api/v1/facilities/{facilityId}
      - GET    /api/v1/rooms/{roomId}/schedules
      - POST   /api/v1/rooms/{roomId}/schedules
      - PUT    /api/v1/rooms/{roomId}/schedules/{scheduleId}
      - DELETE /api/v1/rooms/{roomId}/schedules/{scheduleId}
      - POST   /api/v1/schedules/imports[?dry_run=true]
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

        if route_key == f"GET {SEARCH}":
            query_params = (
                event.get("queryStringParameters")
                or {}
            )

            params["query"] = query_params.get("q")

            if params["query"] is None:
                raise MissingParameters(["q"])

            params["type"] = query_params.get("type")
            params["buildingId"] = query_params.get("buildingId")
            try:
                params["page"] = int(
                    query_params.get("page", 1)
                )

                params["pageSize"] = int(
                    query_params.get("pageSize", 20)
                )
            except ValueError as exc:
                raise AppError(
                    "INVALID_PARAMETER"
                    "page and pageSize must be integers"
                ) from exc

        if route_key == f"GET {SCHEDULES}":
            if params.get("type") is not None:
                params["type"] = params["type"].upper()
            if params.get("type") is not None and params["type"] not in TYPES:
                raise InvalidParameter("type must be one of COURSE, EXAM, or ACTIVITY.")

            try:
                params["pageSize"] = int(params.get("pageSize", 20))
            except (TypeError, ValueError) as exc:
                raise InvalidParameter("pageSize must be an integer between 1 and 100.") from exc

            if not 1 <= params["pageSize"] <= 100:
                raise InvalidParameter("pageSize must be an integer between 1 and 100.")
        # ---------------------------------------------------------------
        # PUT request body
        #
        # API Gateway HTTP API sends `body` as a JSON string.
        # Convert it to a Python dict before passing it to the service.
        # ---------------------------------------------------------------

        if method == "PUT":
            body = params.get("body")
            if body is None:
                body = event.get("body")
                if isinstance(body, str):
                    try:
                        body = json.loads(body)
                    except json.JSONDecodeError:
                        raise InvalidSchedule("Request body must be valid JSON")
            if not isinstance(body, dict):
                raise InvalidSchedule("Request body must be a JSON object")
            params["body"] = body

        preview = route_key == SCHEDULE_IMPORTS and _dry_run(params)

        return response.ok(
            route.action(DEPS, params), 201 if method == "POST" and not preview else 200
        )

    except AppError as exc:
        logger.warning("%s: %s", exc.code, exc.message)

        return response.error(exc)

    except Exception:
        logger.exception("Unhandled error while processing %s %s", method, path)

        return response.error(AppError())
