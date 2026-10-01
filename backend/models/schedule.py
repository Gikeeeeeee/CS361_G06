"""
Schedule domain
- parse_time()  string -> datetime
- to_utc()      datetime or string -> UTC ISO string for DynamoDB
- overlaps()    check time overlap
- occurrences() expand the RRULE
- validate()    entry point: check and normalize a schedule
- to_contract() shape the API response
- parse_csv()   CSV bytes -> numbered rows (bulk import)
"""

import csv
import io
from datetime import datetime, timezone
from itertools import islice
from typing import Any

from dateutil.rrule import rrulestr

from errors import (
    CsvEmpty,
    CsvMissingColumns,
    CsvNotUtf8,
    CsvTooManyRows,
    MissingParameters,
    RoomTypeNotAllowed,
    ValidationError,
)

TYPES = {"COURSE", "EXAM", "ACTIVITY"}
STATUSES = {"CONFIRM", "TENTATIVE", "CANCELLED"}

_REQUIRED = ("type", "title", "start_at", "end_at", "time_zone", "status")
_OPTIONAL = ("description", "course_code", "organizer", "recurrence_rule")

CONTRACT_FIELDS = (
    "id",
    "type",
    "title",
    "description",
    "course_code",
    "organizer",
    "start_at",
    "end_at",
    "time_zone",
    "recurrence_rule",
    "room_id",
    "status",
)

MAX_OCCURRENCES = 200

CSV_HEADER = (
    "building",
    "room",
    "type",
    "title",
    "start_at",
    "end_at",
    "course_code",
    "organizer",
    "recurrence_rule",
)
MAX_IMPORT_ROWS = 300
MAX_IMPORT_OCCURRENCES = 2000

# Room type -> schedule types it may hold. Any other room type cannot be booked.
ROOM_TYPE_RULES = {
    "CLASSROOM": TYPES,
    "LAB": TYPES,
    "OFFICE": {"ACTIVITY"},
    "MEETING_ROOM": {"ACTIVITY"},
    "COMMON_ROOM": {"ACTIVITY"},
}


def parse_time(value: Any) -> datetime:
    """String -> datetime, so Python can do time math."""
    try:
        moment = datetime.fromisoformat(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError(f"'{value}' is not an ISO 8601 datetime") from exc

    if moment.tzinfo is None:
        raise ValidationError(f"'{value}' must carry a UTC offset")

    return moment


def to_utc(value: str | datetime) -> str:
    """Convert to a UTC string for the DynamoDB sort key."""
    moment = value if isinstance(value, datetime) else parse_time(value)

    return moment.astimezone(timezone.utc).isoformat(timespec="seconds")


def overlaps(
    a_start: datetime,
    a_end: datetime,
    b_start: datetime,
    b_end: datetime,
) -> bool:
    """Check time overlap."""
    return a_start < b_end and b_start < a_end


def occurrences(
    start_at: str,
    end_at: str,
    recurrence_rule: str | None = None,
) -> list[tuple[datetime, datetime]]:
    """Expand the RRULE into (start, end) occurrences."""
    start = parse_time(start_at)
    end = parse_time(end_at)

    if not recurrence_rule:
        return [(start, end)]

    rule_text = str(recurrence_rule).upper()

    # Check COUNT or UNTIL so the rule cannot repeat forever.
    if "COUNT=" not in rule_text and "UNTIL=" not in rule_text:
        raise ValidationError("recurrence_rule must carry COUNT or UNTIL")

    try:
        rule = rrulestr(str(recurrence_rule), dtstart=start)
        moments = list(islice(rule, MAX_OCCURRENCES + 1))
    except (ValueError, TypeError) as exc:
        raise ValidationError(f"'{recurrence_rule}' is not a valid RRULE") from exc

    if not moments:
        raise ValidationError(f"'{recurrence_rule}' has no occurrences")

    if len(moments) > MAX_OCCURRENCES:
        raise ValidationError(f"recurrence_rule expands past {MAX_OCCURRENCES}")

    duration = end - start

    return [(moment, moment + duration) for moment in moments]


def validate(payload: Any) -> dict[str, Any]:
    """Validate and normalize a schedule."""
    if not isinstance(payload, dict):
        raise ValidationError("Request body must be a JSON object")

    missing = [name for name in _REQUIRED if payload.get(name) in (None, "")]

    if missing:
        raise MissingParameters(missing)

    schedule = {name: payload.get(name) for name in _REQUIRED + _OPTIONAL}
    schedule["type"] = str(schedule["type"]).upper()
    schedule["status"] = str(schedule["status"]).upper()

    if schedule["type"] not in TYPES:
        raise ValidationError(f"type must be one of: {', '.join(sorted(TYPES))}")

    if schedule["status"] not in STATUSES:
        raise ValidationError(f"status must be one of: {', '.join(sorted(STATUSES))}")

    if not isinstance(schedule["title"], str) or not schedule["title"].strip():
        raise ValidationError("title must be a non-empty string")

    if parse_time(schedule["start_at"]) >= parse_time(schedule["end_at"]):
        raise ValidationError("start_at must be before end_at")

    slots = occurrences(
        schedule["start_at"], schedule["end_at"], schedule["recurrence_rule"]
    )
    schedule["series_end_at"] = to_utc(slots[-1][1])

    return schedule


def to_contract(item: dict[str, Any]) -> dict[str, Any]:
    """Stored schedule -> API object."""
    return {name: item.get(name) for name in CONTRACT_FIELDS}


def can_share(a_type: str | None, b_type: str | None) -> bool:
    """An exam may take over a lecture slot (midterm/final week)."""
    return {a_type, b_type} == {"EXAM", "COURSE"}


def check_room_type(room: str, room_type: str | None, schedule_type: str) -> None:
    """Raise unless this room type may hold this schedule type."""
    allowed = ROOM_TYPE_RULES.get(room_type, set())

    if schedule_type not in allowed:
        raise RoomTypeNotAllowed(room, room_type, allowed)


def parse_csv(data: bytes) -> list[tuple[int, dict[str, str | None]]]:
    """CSV bytes -> [(Excel row number, row)]. Cells stripped, blank rows skipped."""
    try:
        lines = csv.reader(io.StringIO(data.decode("utf-8-sig")))
    except UnicodeDecodeError as exc:
        raise CsvNotUtf8() from exc

    header = [name.strip() for name in next(lines, [])]

    if not header:
        raise CsvEmpty()

    missing = [name for name in CSV_HEADER if name not in header]

    if missing:
        raise CsvMissingColumns(missing)

    rows = [
        (number, {name: cell.strip() or None for name, cell in zip(header, cells)})
        for number, cells in enumerate(lines, start=2)
        if any(cell.strip() for cell in cells)
    ]

    if not rows:
        raise CsvEmpty()

    if len(rows) > MAX_IMPORT_ROWS:
        raise CsvTooManyRows(len(rows), MAX_IMPORT_ROWS)

    return rows
