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

    def __init__(self, message: str = "Internal server error", details: list | None = None):
        super().__init__(message)
        self.message = message
        self.details = details

    def to_dict(self) -> dict:
        body = {"code": self.code, "message": self.message}

        if self.details is not None:
            body["details"] = self.details

        return body


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

    def __init__(self, floor_id: str, building_id: str | None = None):
        """
        `building_id` is optional: `GET /api/v1/floors/{floorId}` has no
        building in its path, so naming one in the message would be inventing
        it. The nested room and facility routes still pass it.
        """
        self.building_id = building_id
        self.floor_id = floor_id
        super().__init__(
            f"Floor '{floor_id}' in building '{building_id}' not found"
            if building_id is not None
            else f"Floor '{floor_id}' not found"
        )


class RoomNotFound(NotFoundError):
    code = "ROOM_NOT_FOUND"

    def __init__(self, room_id: str):
        self.room_id = room_id
        super().__init__(f"Room '{room_id}' not found")


class ScheduleConflict(AppError):
    """
    - 409 schedule conflict
    - 400 wrong format
    - 404 room does not exist
    """

    status_code = 409
    code = "SCHEDULE_CONFLICT"

    def __init__(self, room_id: str, start_at: str, end_at: str):
        self.room_id = room_id
        super().__init__(
            f"Schedule conflict detected for room '{room_id}' between "
            f"{start_at} and {end_at}. Please choose another time."
        )


class FacilityNotFound(NotFoundError):

    code = "FACILITY_NOT_FOUND"

    def __init__(self, facility_id: str):

        self.facility_id = facility_id

        super().__init__(
            f"Facility '{facility_id}' not found"
        )


class ScheduleNotFound(NotFoundError):
    code = "SCHEDULE_NOT_FOUND"

    def __init__(self, schedule_id: str):
        super().__init__(
            f"Schedule not found: {schedule_id}"
        )


class InvalidSchedule(ValidationError):
    code = "INVALID_SCHEDULE"

    def __init__(self, message: str):
        super().__init__(message)

class SearchServiceUnavailable(AppError):
    status_code = 503
    code = "SEARCH_SERVICE_UNAVAILABLE"

    def __init__(
        self,
        message: str = "Search service is temporarily unavailable.",
    ):
        super().__init__(message)

"""
    ERROR FOR SERACH PARAMETER
"""
class InvalidParameter(AppError):
    status_code = 400
    code = "INVALID_PARAMETER"

    def __init__(self, message: str):
        super().__init__(message)

# ---------------------------------------------------------------------------
# CSV schedule import
# ---------------------------------------------------------------------------


def _span(start, end) -> str:
    return f"{start:%Y-%m-%d %H:%M}\u2013{end:%H:%M}"


class CsvNotUtf8(ValidationError):
    def __init__(self):
        super().__init__(
            'File is not UTF-8. In Excel use Save As \u2192 "CSV UTF-8 (Comma delimited)".'
        )


class CsvEmpty(ValidationError):
    def __init__(self):
        super().__init__("File has no data rows.")


class CsvMissingColumns(ValidationError):
    def __init__(self, names):
        super().__init__(
            f"Missing column(s): {', '.join(names)}. "
            "Download the template for the full header."
        )


class CsvTooManyRows(ValidationError):
    def __init__(self, count: int, limit: int):
        super().__init__(
            f"File has {count} rows; the limit is {limit}. Split it into smaller files."
        )


class CsvTooManyOccurrences(ValidationError):
    def __init__(self, count: int, limit: int):
        super().__init__(
            f"File expands to {count} bookings; the limit is {limit}. "
            "Split it into smaller files."
        )


class RoomTypeNotAllowed(ValidationError):
    def __init__(self, room: str, room_type, allowed):
        rule = (
            f"only allows {', '.join(sorted(allowed))}" if allowed else "cannot be booked"
        )
        super().__init__(f"Room '{room}' ({room_type}) {rule}.")


class RowOverlap(ValidationError):
    def __init__(self, other_row: int, start, end):
        super().__init__(f"Overlaps row {other_row} ({_span(start, end)}).")


class BookingConflict(ValidationError):
    def __init__(self, title, start, end):
        super().__init__(f"Overlaps existing booking '{title}' ({_span(start, end)}).")


class ImportRejected(ValidationError):
    def __init__(self, details: list):
        super().__init__(
            f"File rejected: {len(details)} row(s) have problems. Nothing was imported.",
            details,
        )


class ImportConflict(AppError):
    status_code = 409
    code = "SCHEDULE_CONFLICT"

    def __init__(self, details: list):
        super().__init__(
            f"File rejected: {len(details)} row(s) overlap other bookings. "
            "Nothing was imported.",
            details,
        )
