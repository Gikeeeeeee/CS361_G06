"""
Schedule domain rules.

Layer: domain / core. Knows nothing about HTTP or DynamoDB -- the PK/SK/GSI
layout for a schedule lives in `repositories/`, not here.

A recurring schedule is stored ONCE, with its RFC 5545 `recurrence_rule`. The
frontend expands it; the backend only expands it to check for conflicts.
"""

from datetime import datetime, timezone
from itertools import islice
from typing import Any

from dateutil.rrule import rrulestr

from errors import MissingParameters, ValidationError

TYPES = {"COURSE", "EXAM", "ACTIVITY"}
STATUSES = {"CONFIRM", "TENTATIVE", "CANCELLED"}

_REQUIRED = ("type", "title", "start_at", "end_at", "time_zone", "status")
_OPTIONAL = ("description", "course_code", "organizer", "recurrence_rule")

# The v2 contract. Anything else stored on the item (created_at,
# series_end_at, ...) never leaves the API.
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

# Bounds the conflict check, which expands every series it compares.
MAX_OCCURRENCES = 200


def parse_time(value: Any) -> datetime:
    """`"2026-09-16T13:00:00+07:00"` -> an aware datetime."""
    try:
        moment = datetime.fromisoformat(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError(f"'{value}' is not an ISO 8601 datetime") from exc

    if moment.tzinfo is None:
        raise ValidationError(f"'{value}' must carry a UTC offset")

    return moment


def to_utc(value: str | datetime) -> str:
    """
    One fixed-width UTC form, so DynamoDB can compare instants as strings:
    `"2026-09-16T13:00:00+07:00"` -> `"2026-09-16T06:00:00+00:00"`.
    """
    moment = value if isinstance(value, datetime) else parse_time(value)

    return moment.astimezone(timezone.utc).isoformat(timespec="seconds")


def overlaps(
    a_start: datetime,
    a_end: datetime,
    b_start: datetime,
    b_end: datetime,
) -> bool:
    """True when the half-open intervals [a) and [b) share any instant."""
    return a_start < b_end and b_start < a_end


def occurrences(
    start_at: str,
    end_at: str,
    recurrence_rule: str | None = None,
) -> list[tuple[datetime, datetime]]:
    """
    `[(start, end), ...]` -- one pair per occurrence, each as long as the
    first. No rule means the single slot itself.
    """
    start = parse_time(start_at)
    end = parse_time(end_at)

    if not recurrence_rule:
        return [(start, end)]

    rule_text = str(recurrence_rule).upper()

    # A rule with neither COUNT nor UNTIL repeats forever.
    if "COUNT=" not in rule_text and "UNTIL=" not in rule_text:
        raise ValidationError(
            "recurrence_rule must carry COUNT or UNTIL so the series is finite"
        )

    try:
        rule = rrulestr(str(recurrence_rule), dtstart=start)
        # islice: COUNT=10**9 must fail fast, not expand a billion dates.
        moments = list(islice(rule, MAX_OCCURRENCES + 1))
    except (ValueError, TypeError) as exc:
        raise ValidationError(
            f"'{recurrence_rule}' is not a valid RFC 5545 RRULE"
        ) from exc

    if not moments:
        raise ValidationError(f"'{recurrence_rule}' has no occurrences")

    if len(moments) > MAX_OCCURRENCES:
        raise ValidationError(
            f"recurrence_rule expands past {MAX_OCCURRENCES} occurrences"
        )

    duration = end - start

    return [(moment, moment + duration) for moment in moments]


def validate(payload: Any) -> dict[str, Any]:
    """
    Check a POST/PUT body and return the schedule to store.

    Only contract fields are kept, so a caller cannot set its own `id`, `PK`
    or `created_at`. Adds `series_end_at` (UTC end of the last occurrence),
    which lets a time-window query find a series that started earlier.
    """
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
        raise ValidationError(
            f"status must be one of: {', '.join(sorted(STATUSES))}"
        )

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
    """A stored schedule -> exactly the v2 contract fields, missing as null."""
    return {name: item.get(name) for name in CONTRACT_FIELDS}
