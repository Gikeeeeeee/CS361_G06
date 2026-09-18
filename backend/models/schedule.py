"""
Schedule domain rules.

Layer: domain / core. Knows nothing about HTTP or DynamoDB -- the PK/SK/GSI
layout for a schedule lives in `repositories/`, not here.
"""

from datetime import datetime, timedelta
from typing import Any

from dateutil.rrule import rrulestr

from errors import MissingParameters, ValidationError

TYPES = {"COURSE", "EXAM", "ACTIVITY"}
STATUSES = {"CONFIRM", "TENTATIVE", "CANCELLED"}

_REQUIRED = ("type", "title", "start_at", "end_at")

# Fields a caller may set. Anything else in the payload is dropped, so a POST
# cannot inject its own `id`, `PK` or `created_at`.
_ALLOWED = _REQUIRED + (
    "description",
    "course_code",
    "organizer",
    "time_zone",
    "recurrence_rule",
    "status",
)

# Expand-on-write turns one POST into one DynamoDB item per occurrence, so the
# rule has to be finite and the count has to be bounded.
MAX_OCCURRENCES = 200


def parse_time(value: str) -> datetime:
    """`"2026-09-16T13:00:00+07:00"` -> an aware datetime."""
    try:
        return datetime.fromisoformat(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError(
            f"'{value}' is not an ISO 8601 datetime"
        ) from exc


def overlaps(
    a_start: datetime,
    a_end: datetime,
    b_start: datetime,
    b_end: datetime,
) -> bool:
    """True when the half-open intervals [a) and [b) share any instant."""
    return a_start < b_end and b_start < a_end


def validate(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Check an inbound POST body and return the normalised schedule.

    Raises ValidationError / MissingParameters -- never returns a partial
    record and never returns None.
    """
    if not isinstance(payload, dict):
        raise ValidationError("Request body must be a JSON object")

    missing = [name for name in _REQUIRED if not payload.get(name)]

    if missing:
        raise MissingParameters(missing)

    schedule_type = str(payload["type"]).upper()

    if schedule_type not in TYPES:
        raise ValidationError(
            f"type must be one of: {', '.join(sorted(TYPES))}"
        )

    status = str(payload.get("status") or "CONFIRM").upper()

    if status not in STATUSES:
        raise ValidationError(
            f"status must be one of: {', '.join(sorted(STATUSES))}"
        )

    if parse_time(payload["start_at"]) >= parse_time(payload["end_at"]):
        raise ValidationError("start_at must be before end_at")

    schedule = {
        name: payload[name] for name in _ALLOWED if payload.get(name)
    }
    schedule["type"] = schedule_type
    schedule["status"] = status

    return schedule


def occurrences(
    start_at: str,
    end_at: str,
    recurrence_rule: str | None = None,
) -> list[tuple[str, str]]:
    """
    `[(start, end), ...]` -- one pair per occurrence, each the same length as
    the first. No rule means a single occurrence.
    """
    if not recurrence_rule:
        return [(start_at, end_at)]

    start = parse_time(start_at)
    duration = parse_time(end_at) - start
    rule_text = str(recurrence_rule).upper()

    # An RRULE with neither COUNT nor UNTIL repeats forever, and expanding it
    # on write would never terminate.
    if "COUNT=" not in rule_text and "UNTIL=" not in rule_text:
        raise ValidationError(
            "recurrence_rule must carry COUNT or UNTIL so the series is finite"
        )

    try:
        rule = rrulestr(recurrence_rule, dtstart=start)
    except (ValueError, TypeError) as exc:
        raise ValidationError(
            f"'{recurrence_rule}' is not a valid RFC 5545 RRULE"
        ) from exc

    slots = [
        (moment.isoformat(), (moment + duration).isoformat())
        for moment in rule
    ]

    if len(slots) > MAX_OCCURRENCES:
        raise ValidationError(
            f"recurrence_rule expands to {len(slots)} occurrences; "
            f"the limit is {MAX_OCCURRENCES}"
        )

    return slots


def series_window(slots: list[tuple[str, str]]) -> tuple[str, str]:
    """
    The GSI4 query window that covers every occurrence in `slots`.

    GSI4 is keyed on `start_at`, so the lower bound is widened by a day to
    catch a booking that started before the series and is still running.

    ponytail: the 24h lookback assumes no single booking is longer than a day.
    If that stops holding, put `end_at` in the sort key instead of widening.
    """
    lower = parse_time(slots[0][0]) - timedelta(days=1)

    return lower.isoformat(), slots[-1][1]
