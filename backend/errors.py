"""
Application errors (domain layer).

Pure Python: no HTTP library, no AWS SDK, no framework.

Every error carries the HTTP status code the inbound adapter should use, so
`handler.py` maps *all* failures with a single `except AppError` instead of a
`if not result: return response(404, ...)` check per endpoint.

Layer: domain / core.
"""


class AppError(Exception):
    """Base class for every expected application failure."""

    status_code = 500
    code = "INTERNAL_ERROR"

    def __init__(self, message: str = "Internal server error"):
        super().__init__(message)
        self.message = message

    def to_dict(self) -> dict:
        return {"code": self.code, "message": self.message}


# ---------------------------------------------------------------------------
# Categories (map 1:1 onto HTTP status codes)
# ---------------------------------------------------------------------------


class ValidationError(AppError):
    """The caller sent something we cannot work with."""

    status_code = 400
    code = "VALIDATION_ERROR"


class NotFoundError(AppError):
    """The requested resource does not exist."""

    status_code = 404
    code = "NOT_FOUND"


class UpstreamError(AppError):
    """A dependency we rely on (S3) failed or is misconfigured."""

    status_code = 502
    code = "UPSTREAM_ERROR"


# ---------------------------------------------------------------------------
# Concrete errors
#
# Messages live here (not at the call sites) so two people adding endpoints
# never edit the same block of inline f-strings -> fewer merge conflicts.
# ---------------------------------------------------------------------------


class MissingParameters(ValidationError):
    code = "MISSING_PARAMETER"

    def __init__(self, names):
        self.names = list(names)
        super().__init__(
            "Missing required parameter(s): " + ", ".join(self.names)
        )


class RouteNotFound(NotFoundError):
    code = "ROUTE_NOT_FOUND"

    def __init__(self, route_key: str):
        self.route_key = route_key
        super().__init__(f"Route not found: {route_key}")


class BuildingNotFound(NotFoundError):
    code = "BUILDING_NOT_FOUND"

    def __init__(self, building_id: str):
        self.building_id = building_id
        super().__init__(f"Building '{building_id}' not found")


class FloorNotFound(NotFoundError):
    code = "FLOOR_NOT_FOUND"

    def __init__(self, building_id: str, floor_id: str):
        self.building_id = building_id
        self.floor_id = floor_id
        super().__init__(
            f"Floor '{floor_id}' in building '{building_id}' not found"
        )


class RoomNotFound(NotFoundError):
    code = "ROOM_NOT_FOUND"

    def __init__(self, building_id: str, floor_id: str, room_id: str):
        self.building_id = building_id
        self.floor_id = floor_id
        self.room_id = room_id
        super().__init__(
            f"Room '{room_id}' not found on floor '{floor_id}' "
            f"in building '{building_id}'"
        )


class FacilityNotFound(NotFoundError):
    code = "FACILITY_NOT_FOUND"

    def __init__(self, building_id: str, floor_id: str, facility_id: str):
        self.building_id = building_id
        self.floor_id = floor_id
        self.facility_id = facility_id
        super().__init__(
            f"Facility '{facility_id}' not found on floor '{floor_id}' "
            f"in building '{building_id}'"
        )
